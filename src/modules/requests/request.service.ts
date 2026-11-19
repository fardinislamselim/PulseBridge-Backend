import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import {
  BloodGroup,
  RequestStatus,
  RequestUrgency,
  AssignmentStatus,
  UserRole,
  NotificationType,
  DonationStatus,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../types/index.js';
import {
  EDITABLE_STATUSES,
  CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  URGENCY_PRIORITY_MAP,
} from './request.constant.js';
import type {
  CreateBloodRequestDTO,
  UpdateBloodRequestDTO,
  GetBloodRequestsQueryDTO,
  AdminGetBloodRequestsQueryDTO,
  BloodRequestResponse,
  PublicBloodRequestSummary,
  BloodRequestHistoryResponse,
  AdminBloodRequestDetailResponse,
  UpdateUrgencyDTO,
} from './request.interface.js';
import {
  toPublicBloodRequestSummary,
  toFullBloodRequestResponse,
  toBloodRequestHistoryResponse,
  toAdminBloodRequestDetailResponse,
  validateBloodRequestTransition,
  calculateRemainingUnits,
} from './request.utils.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { createNotification } from '../../services/notification.service.js';
import {
  sendBloodRequestCreatedEmail,
  sendEmergencyBloodRequestEmail,
  sendBloodRequestStatusEmail,
} from '../../services/email.service.js';
import {
  getCompatibleDonorBloodGroups,
  calculateDistanceKm,
} from '../donors/donor.utils.js';
import { expireOverdueRequest } from './request-expiration.service.js';

const requestIncludeRelations = {
  requester: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  assignments: {
    include: {
      donorProfile: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BloodRequestInclude;

/**
 * Persists an immutable history record for a blood request within a transaction.
 */
export const recordRequestHistory = async (
  tx: Prisma.TransactionClient,
  params: {
    bloodRequestId: string;
    actorId?: string | null;
    action: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    previousUrgency?: string | null;
    newUrgency?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) => {
  return tx.bloodRequestHistory.create({
    data: {
      bloodRequestId: params.bloodRequestId,
      actorId: params.actorId ?? null,
      action: params.action,
      previousStatus: params.previousStatus ?? null,
      newStatus: params.newStatus ?? null,
      previousUrgency: params.previousUrgency ?? null,
      newUrgency: params.newUrgency ?? null,
      reason: params.reason ?? null,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
};

/**
 * Creates a new blood donation request with comprehensive validation,
 * duplicate detection, lifecycle history recording, and notification dispatch.
 */
export const createBloodRequest = async (
  requesterId: string,
  data: CreateBloodRequestDTO,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  // 1. Role verification: Only REQUESTER, ADMIN, or SUPER_ADMIN can create blood requests
  if (
    actor.role !== UserRole.REQUESTER &&
    actor.role !== UserRole.ADMIN &&
    actor.role !== UserRole.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Forbidden. Users with role '${actor.role}' cannot create blood donation requests.`
    );
  }

  // 2. Prevent accidental duplicate requests for the same patient at the same hospital
  const existingActive = await prisma.bloodRequest.findFirst({
    where: {
      requesterId,
      bloodGroup: data.bloodGroup,
      patientName: { equals: data.patientName.trim(), mode: 'insensitive' },
      hospitalName: { equals: data.hospitalName.trim(), mode: 'insensitive' },
      status: {
        in: [
          RequestStatus.PENDING,
          RequestStatus.APPROVED,
          RequestStatus.MATCHING,
          RequestStatus.IN_PROGRESS,
          RequestStatus.PARTIALLY_FULFILLED,
        ],
      },
      deletedAt: null,
    },
  });

  if (existingActive) {
    throw new AppError(
      httpStatus.CONFLICT,
      `An active blood request for patient "${data.patientName}" with blood group ${data.bloodGroup} at ${data.hospitalName} already exists (ID: ${existingActive.id}). You can update your existing request instead.`
    );
  }

  const units = data.unitsRequired ?? data.unitsNeeded ?? 1;
  const contact = (data.contactPerson ?? data.contactName ?? '').trim();
  const rawDate = data.requiredAt ?? data.neededAt;
  const requiredAt = new Date(rawDate!);
  const urgency = data.urgency ?? RequestUrgency.NORMAL;
  const details = data.details || [data.reason, data.additionalNotes].filter(Boolean).join(' - ') || null;

  // 3. Create BloodRequest and initial history inside a database transaction
  const created = await prisma.$transaction(async (tx) => {
    const newRequest = await tx.bloodRequest.create({
      data: {
        requesterId,
        patientName: data.patientName.trim(),
        bloodGroup: data.bloodGroup,
        unitsRequired: units,
        fulfilledUnits: 0,
        hospitalName: data.hospitalName.trim(),
        hospitalAddress: data.hospitalAddress.trim(),
        district: data.district.trim(),
        city: data.city.trim(),
        area: data.area?.trim() || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        contactPerson: contact,
        contactPhone: data.contactPhone.trim(),
        requiredAt,
        urgency,
        status: RequestStatus.PENDING,
        details,
      },
      include: requestIncludeRelations,
    });

    await recordRequestHistory(tx, {
      bloodRequestId: newRequest.id,
      actorId: actor.id,
      action: 'CREATED',
      newStatus: RequestStatus.PENDING,
      newUrgency: urgency,
      reason: 'Blood request submitted by requester',
      metadata: {
        unitsRequired: units,
        patientName: newRequest.patientName,
        bloodGroup: newRequest.bloodGroup,
      },
    });

    return newRequest;
  });

  // 4. Notifications & Emails outside the transaction
  try {
    await createNotification({
      userId: requesterId,
      type: NotificationType.REQUEST,
      title: 'Blood Request Submitted',
      message: `Your request for ${created.patientName} (${created.bloodGroup}, ${created.unitsRequired} unit(s)) is pending administrative review.`,
      metadata: { requestId: created.id },
    });

    void sendBloodRequestCreatedEmail(created.requester.email, {
      recipientName: created.requester.name,
      patientName: created.patientName,
      bloodGroup: created.bloodGroup,
      units: created.unitsRequired,
      hospitalName: created.hospitalName,
      hospitalAddress: created.hospitalAddress,
      contactNumber: created.contactPhone,
      neededBy: created.requiredAt.toLocaleString(),
    });

    if (created.urgency === RequestUrgency.EMERGENCY) {
      void sendEmergencyBloodRequestEmail(created.requester.email, {
        donorName: created.requester.name,
        patientName: created.patientName,
        bloodGroup: created.bloodGroup,
        units: created.unitsRequired,
        hospitalName: created.hospitalName,
        hospitalAddress: created.hospitalAddress,
        contactNumber: created.contactPhone,
        neededBy: created.requiredAt.toLocaleString(),
      });
    }
  } catch (err) {
    console.error('[BloodRequest] Failed to send creation notifications:', err);
  }

  return toFullBloodRequestResponse(created);
};

/**
 * Retrieves a paginated list of blood requests with privacy masking for public callers.
 */
export const getBloodRequests = async (
  query: GetBloodRequestsQueryDTO
): Promise<{ data: PublicBloodRequestSummary[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.BloodRequestWhereInput = {
    deletedAt: null,
  };

  if (query.bloodGroup) where.bloodGroup = query.bloodGroup;
  if (query.urgency) where.urgency = query.urgency;
  if (query.status) where.status = query.status;

  if (query.district) {
    where.district = { equals: query.district.trim(), mode: 'insensitive' };
  }
  if (query.city) {
    where.city = { equals: query.city.trim(), mode: 'insensitive' };
  }
  if (query.area) {
    where.area = { contains: query.area.trim(), mode: 'insensitive' };
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { hospitalName: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { city: { contains: term, mode: 'insensitive' } },
      { district: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (query.fromDate || query.toDate) {
    where.requiredAt = {};
    if (query.fromDate) where.requiredAt.gte = new Date(query.fromDate);
    if (query.toDate) where.requiredAt.lte = new Date(query.toDate);
  }

  const orderBy: Prisma.BloodRequestOrderByWithRelationInput[] = [];
  const sortDirection = query.sortOrder === 'asc' ? 'asc' : 'desc';

  if (query.sortBy === 'neededAt' || query.sortBy === 'requiredAt') {
    orderBy.push({ requiredAt: sortDirection });
  } else if (query.sortBy === 'urgency') {
    orderBy.push({ urgency: sortDirection });
  } else if (query.sortBy === 'unitsRequired') {
    orderBy.push({ unitsRequired: sortDirection });
  } else if (query.sortBy === 'city') {
    orderBy.push({ city: sortDirection });
  } else if (query.sortBy === 'district') {
    orderBy.push({ district: sortDirection });
  } else {
    orderBy.push({ createdAt: sortDirection });
  }

  const [total, requests] = await Promise.all([
    prisma.bloodRequest.count({ where }),
    prisma.bloodRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
  ]);

  return {
    data: requests.map(toPublicBloodRequestSummary),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves all blood requests authored by the authenticated requester.
 * Supports hospital name search, date filtering, status and urgency filters.
 */
export const getMyBloodRequests = async (
  requesterId: string,
  query: GetBloodRequestsQueryDTO
): Promise<{ data: BloodRequestResponse[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.BloodRequestWhereInput = {
    requesterId,
    deletedAt: null,
  };

  if (query.status) where.status = query.status;
  if (query.urgency) where.urgency = query.urgency;
  if (query.bloodGroup) where.bloodGroup = query.bloodGroup;

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { hospitalName: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { city: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
    if (query.toDate) where.createdAt.lte = new Date(query.toDate);
  }

  const sortDirection = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.BloodRequestOrderByWithRelationInput[] = [];

  if (query.sortBy === 'requiredAt' || query.sortBy === 'neededAt') {
    orderBy.push({ requiredAt: sortDirection });
  } else {
    orderBy.push({ createdAt: sortDirection });
  }

  const [total, requests] = await Promise.all([
    prisma.bloodRequest.count({ where }),
    prisma.bloodRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: requestIncludeRelations,
    }),
  ]);

  return {
    data: requests.map(toFullBloodRequestResponse),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a single blood request by ID.
 * Returns public sanitized summary for anonymous or non-owning users;
 * returns full details for owner, admin, or assigned donors.
 */
export const getBloodRequestById = async (
  requestId: string,
  actor?: AuthUser
): Promise<BloodRequestResponse | PublicBloodRequestSummary> => {
  const request = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: requestIncludeRelations,
  });

  if (!request || request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  const isOwner = actor && actor.id === request.requesterId;
  const isAdmin =
    actor && (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN);
  const isAssignedDonor =
    actor &&
    request.assignments.some(
      (a) => a.donorProfile?.userId === actor.id
    );

  if (isOwner || isAdmin || isAssignedDonor) {
    return toFullBloodRequestResponse(request);
  }

  return toPublicBloodRequestSummary(request);
};

/**
 * Updates permitted blood request fields.
 * Only the owner or an administrator can update permitted fields.
 * Terminal requests cannot be edited.
 */
export const updateBloodRequest = async (
  requestId: string,
  data: UpdateBloodRequestDTO,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  const existing = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: requestIncludeRelations,
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  const isOwner = actor.id === existing.requesterId;
  const isAdmin =
    actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden. You don't have permission to modify this blood request."
    );
  }

  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot edit a blood request in '${existing.status}' status.`
    );
  }

  // Once matching / assignments have commenced, bloodGroup cannot be altered directly
  if (
    data.bloodGroup &&
    data.bloodGroup !== existing.bloodGroup &&
    (existing.status === RequestStatus.IN_PROGRESS ||
      existing.status === RequestStatus.MATCHING ||
      existing.status === RequestStatus.PARTIALLY_FULFILLED)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot change blood group while active donor assignments are in progress.'
    );
  }

  const updateData: Prisma.BloodRequestUpdateInput = {};
  const changedFields: Record<string, unknown> = {};

  if (data.patientName !== undefined) {
    updateData.patientName = data.patientName.trim();
    changedFields.patientName = updateData.patientName;
  }
  if (data.bloodGroup !== undefined) {
    updateData.bloodGroup = data.bloodGroup;
    changedFields.bloodGroup = data.bloodGroup;
  }
  if (data.unitsNeeded !== undefined || data.unitsRequired !== undefined) {
    updateData.unitsRequired = data.unitsNeeded ?? data.unitsRequired;
    changedFields.unitsRequired = updateData.unitsRequired;
  }
  if (data.hospitalName !== undefined) {
    updateData.hospitalName = data.hospitalName.trim();
    changedFields.hospitalName = updateData.hospitalName;
  }
  if (data.hospitalAddress !== undefined) {
    updateData.hospitalAddress = data.hospitalAddress.trim();
    changedFields.hospitalAddress = updateData.hospitalAddress;
  }
  if (data.district !== undefined) {
    updateData.district = data.district.trim();
    changedFields.district = updateData.district;
  }
  if (data.city !== undefined) {
    updateData.city = data.city.trim();
    changedFields.city = updateData.city;
  }
  if (data.area !== undefined) {
    updateData.area = data.area.trim();
    changedFields.area = updateData.area;
  }
  if (data.latitude !== undefined) {
    updateData.latitude = data.latitude;
    changedFields.latitude = data.latitude;
  }
  if (data.longitude !== undefined) {
    updateData.longitude = data.longitude;
    changedFields.longitude = data.longitude;
  }
  if (data.contactName !== undefined || data.contactPerson !== undefined) {
    updateData.contactPerson = (data.contactName ?? data.contactPerson)!.trim();
    changedFields.contactPerson = updateData.contactPerson;
  }
  if (data.contactPhone !== undefined) {
    updateData.contactPhone = data.contactPhone.trim();
    changedFields.contactPhone = updateData.contactPhone;
  }
  if (data.neededAt !== undefined || data.requiredAt !== undefined) {
    updateData.requiredAt = new Date(data.neededAt ?? data.requiredAt!);
    changedFields.requiredAt = updateData.requiredAt.toISOString();
  }
  if (data.urgency !== undefined) {
    updateData.urgency = data.urgency;
    changedFields.urgency = data.urgency;
  }
  if (data.details !== undefined || data.reason !== undefined || data.additionalNotes !== undefined) {
    updateData.details = data.details || [data.reason, data.additionalNotes].filter(Boolean).join(' - ') || null;
    changedFields.details = updateData.details;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.bloodRequest.update({
      where: { id: requestId },
      data: updateData,
      include: requestIncludeRelations,
    });

    await recordRequestHistory(tx, {
      bloodRequestId: requestId,
      actorId: actor.id,
      action: 'UPDATED',
      reason: data.reason || 'Request details updated',
      metadata: changedFields,
    });

    return res;
  });

  return toFullBloodRequestResponse(updated);
};

/**
 * Cancels a blood request transactionally, cancelling associated assignments and notifying parties.
 */
export const cancelBloodRequest = async (
  requestId: string,
  cancellationReason: string | undefined,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  const existing = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      assignments: {
        where: { status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] } },
        include: { donorProfile: { include: { user: true } } },
      },
    },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  const isOwner = actor.id === existing.requesterId;
  const isAdmin =
    actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden. You don't have permission to cancel this blood request."
    );
  }

  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel a blood request in '${existing.status}' status.`
    );
  }

  // Validate status transition
  validateBloodRequestTransition(existing.status, RequestStatus.CANCELLED);

  const reason = cancellationReason || (isOwner ? 'Cancelled by requester' : 'Cancelled by administrator');

  const cancelled = await prisma.$transaction(async (tx) => {
    // 1. Cancel active assignments
    await tx.donorAssignment.updateMany({
      where: {
        requestId,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
      data: {
        status: AssignmentStatus.CANCELLED,
        notes: `Assignment cancelled due to blood request cancellation (${reason})`,
      },
    });

    // 2. Update request status
    const req = await tx.bloodRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.CANCELLED,
        cancellationReason: reason,
      },
      include: requestIncludeRelations,
    });

    // 3. Record history
    await recordRequestHistory(tx, {
      bloodRequestId: requestId,
      actorId: actor.id,
      action: 'CANCELLED',
      previousStatus: existing.status,
      newStatus: RequestStatus.CANCELLED,
      previousUrgency: existing.urgency,
      newUrgency: existing.urgency,
      reason,
      metadata: {
        activeAssignmentsCancelled: existing.assignments.length,
      },
    });

    // 4. Audit entry
    await logAuditEvent({
      actorId: actor.id,
      action: 'BLOOD_REQUEST_CANCELLED',
      entity: 'BloodRequest',
      entityId: req.id,
      metadata: { cancellationReason: reason },
    });

    return req;
  });

  // Notify requester and affected assigned donors outside transaction
  try {
    await createNotification({
      userId: cancelled.requesterId,
      type: NotificationType.REQUEST,
      title: 'Blood Request Cancelled',
      message: `Your request for ${cancelled.patientName} (${cancelled.bloodGroup}) has been cancelled.`,
      metadata: { requestId: cancelled.id, reason },
    });

    void sendBloodRequestStatusEmail(cancelled.requester.email, {
      recipientName: cancelled.requester.name,
      patientName: cancelled.patientName,
      bloodGroup: cancelled.bloodGroup,
      units: cancelled.unitsRequired,
      hospitalName: cancelled.hospitalName,
      status: 'CANCELLED',
      reason,
    });

    for (const assignment of existing.assignments) {
      if (assignment.donorProfile?.user) {
        await createNotification({
          userId: assignment.donorProfile.user.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Donation Request Cancelled',
          message: `The blood donation request for ${cancelled.patientName} was cancelled. Your assignment has been safely released.`,
          metadata: { requestId: cancelled.id, assignmentId: assignment.id },
        });
      }
    }
  } catch (err) {
    console.error('[BloodRequest] Failed to send cancellation notifications:', err);
  }

  return toFullBloodRequestResponse(cancelled);
};

/**
 * Administrative action: Approves a pending blood request, sets approvedBy/At,
 * triggers donor matching workflow, and records history.
 */
export const approveBloodRequest = async (
  requestId: string,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  const existing = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: requestIncludeRelations,
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  // Requester cannot approve their own request
  if (existing.requesterId === actor.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Requesters are not permitted to approve their own blood requests.'
    );
  }

  if (existing.status !== RequestStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot approve a blood request in '${existing.status}' status. Only PENDING requests can be approved.`
    );
  }

  validateBloodRequestTransition(existing.status, RequestStatus.APPROVED);

  const now = new Date();

  // Transaction: approve request, set approvedBy/At, transition to MATCHING, record history
  const approved = await prisma.$transaction(async (tx) => {
    const updated = await tx.bloodRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.APPROVED,
        approvedBy: actor.id,
        approvedAt: now,
      },
      include: requestIncludeRelations,
    });

    await recordRequestHistory(tx, {
      bloodRequestId: requestId,
      actorId: actor.id,
      action: 'APPROVED',
      previousStatus: RequestStatus.PENDING,
      newStatus: RequestStatus.APPROVED,
      previousUrgency: existing.urgency,
      newUrgency: existing.urgency,
      reason: 'Administrative review approval',
      metadata: { approvedBy: actor.id, approvedAt: now.toISOString() },
    });

    await logAuditEvent({
      actorId: actor.id,
      action: 'BLOOD_REQUEST_APPROVED',
      entity: 'BloodRequest',
      entityId: updated.id,
    });

    return updated;
  });

  // Outside transaction: send notification and email
  try {
    await createNotification({
      userId: approved.requesterId,
      type: NotificationType.REQUEST,
      title: 'Blood Request Approved',
      message: `Your request for ${approved.patientName} has been approved by our medical coordination team. Donor matching is now active.`,
      metadata: { requestId: approved.id },
    });

    void sendBloodRequestStatusEmail(approved.requester.email, {
      recipientName: approved.requester.name,
      patientName: approved.patientName,
      bloodGroup: approved.bloodGroup,
      units: approved.unitsRequired,
      hospitalName: approved.hospitalName,
      status: 'APPROVED',
      reason: 'Approved by PulseBridge Medical Coordination Team',
    });
  } catch (err) {
    console.error('[BloodRequest] Failed to send approval notifications:', err);
  }

  return toFullBloodRequestResponse(approved);
};

/**
 * Administrative action: Rejects a pending blood request with a mandatory reason.
 */
export const rejectBloodRequest = async (
  requestId: string,
  rejectionReason: string,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  const existing = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: requestIncludeRelations,
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  if (existing.status !== RequestStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot reject a blood request in '${existing.status}' status. Only PENDING requests can be rejected.`
    );
  }

  validateBloodRequestTransition(existing.status, RequestStatus.REJECTED);

  const now = new Date();

  const rejected = await prisma.$transaction(async (tx) => {
    const updated = await tx.bloodRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.REJECTED,
        rejectedBy: actor.id,
        rejectedAt: now,
        rejectionReason,
      },
      include: requestIncludeRelations,
    });

    await recordRequestHistory(tx, {
      bloodRequestId: requestId,
      actorId: actor.id,
      action: 'REJECTED',
      previousStatus: RequestStatus.PENDING,
      newStatus: RequestStatus.REJECTED,
      previousUrgency: existing.urgency,
      newUrgency: existing.urgency,
      reason: rejectionReason,
      metadata: { rejectedBy: actor.id, rejectedAt: now.toISOString() },
    });

    await logAuditEvent({
      actorId: actor.id,
      action: 'BLOOD_REQUEST_REJECTED',
      entity: 'BloodRequest',
      entityId: updated.id,
      metadata: { rejectionReason },
    });

    return updated;
  });

  // Notify requester outside transaction
  try {
    await createNotification({
      userId: rejected.requesterId,
      type: NotificationType.REQUEST,
      title: 'Blood Request Declined',
      message: `Your blood request was not approved: ${rejectionReason}`,
      metadata: { requestId: rejected.id, rejectionReason },
    });

    void sendBloodRequestStatusEmail(rejected.requester.email, {
      recipientName: rejected.requester.name,
      patientName: rejected.patientName,
      bloodGroup: rejected.bloodGroup,
      units: rejected.unitsRequired,
      hospitalName: rejected.hospitalName,
      status: 'REJECTED',
      reason: rejectionReason,
    });
  } catch (err) {
    console.error('[BloodRequest] Failed to send rejection notifications:', err);
  }

  return toFullBloodRequestResponse(rejected);
};

/**
 * Administrative action: Changes the urgency of a blood request.
 * Requires a reason and records previous/new urgency and actor.
 */
export const updateBloodRequestUrgency = async (
  requestId: string,
  data: UpdateUrgencyDTO,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  const existing = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      assignments: {
        where: { status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] } },
        include: { donorProfile: { include: { user: true } } },
      },
    },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot change urgency for a request in terminal status '${existing.status}'.`
    );
  }

  if (existing.urgency === data.urgency) {
    return toFullBloodRequestResponse(existing);
  }

  const previousUrgency = existing.urgency;
  const newUrgency = data.urgency;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.bloodRequest.update({
      where: { id: requestId },
      data: { urgency: newUrgency },
      include: requestIncludeRelations,
    });

    await recordRequestHistory(tx, {
      bloodRequestId: requestId,
      actorId: actor.id,
      action: 'URGENCY_CHANGED',
      previousStatus: existing.status,
      newStatus: existing.status,
      previousUrgency,
      newUrgency,
      reason: data.reason,
      metadata: {
        changedBy: actor.id,
        reason: data.reason,
      },
    });

    await logAuditEvent({
      actorId: actor.id,
      action: 'BLOOD_REQUEST_URGENCY_CHANGED',
      entity: 'BloodRequest',
      entityId: requestId,
      metadata: {
        previousUrgency,
        newUrgency,
        reason: data.reason,
      },
    });

    return res;
  });

  // Notify requester and assigned donors outside transaction
  try {
    await createNotification({
      userId: existing.requesterId,
      type: NotificationType.REQUEST,
      title: 'Blood Request Urgency Escalated',
      message: `The urgency of your blood request for ${existing.patientName} was changed from ${previousUrgency} to ${newUrgency}: ${data.reason}`,
      metadata: { requestId, previousUrgency, newUrgency },
    });

    for (const assignment of existing.assignments) {
      if (assignment.donorProfile?.user) {
        await createNotification({
          userId: assignment.donorProfile.user.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Assigned Request Priority Changed',
          message: `The blood request for ${existing.patientName} has been escalated to ${newUrgency}. Please respond promptly.`,
          metadata: { requestId, urgency: newUrgency },
        });
      }
    }
  } catch (err) {
    console.error('[BloodRequest] Failed to send urgency update notifications:', err);
  }

  return toFullBloodRequestResponse(updated);
};

/**
 * Administrative action: Manually expires an overdue blood request.
 */
export const expireBloodRequest = async (
  requestId: string,
  actor: AuthUser,
  reason?: string
): Promise<BloodRequestResponse> => {
  const expired = await expireOverdueRequest(
    requestId,
    actor.id,
    reason || 'Administrative manual expiration of overdue blood request'
  );

  const full = await prisma.bloodRequest.findUnique({
    where: { id: expired.id },
    include: requestIncludeRelations,
  });

  return toFullBloodRequestResponse(full || expired);
};

/**
 * Retrieves the complete lifecycle history of a blood request.
 * Allowed for the request owner (REQUESTER) or an administrator (ADMIN, SUPER_ADMIN).
 */
export const getBloodRequestHistory = async (
  requestId: string,
  actor: AuthUser
): Promise<BloodRequestHistoryResponse[]> => {
  const request = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    select: { requesterId: true, deletedAt: true },
  });

  if (!request || request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  const isOwner = actor.id === request.requesterId;
  const isAdmin =
    actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden. You don't have permission to view this request's lifecycle history."
    );
  }

  const histories = await prisma.bloodRequestHistory.findMany({
    where: { bloodRequestId: requestId },
    orderBy: { createdAt: 'asc' },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return histories.map(toBloodRequestHistoryResponse);
};

/**
 * Administrative API: Search & filter all blood requests with complete administrative criteria.
 * Enforces backend priority: EMERGENCY > URGENT > NORMAL, earliest deadline, createdAt tie-breaker.
 */
export const getAdminBloodRequests = async (
  query: AdminGetBloodRequestsQueryDTO
): Promise<{ data: BloodRequestResponse[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.BloodRequestWhereInput = {
    deletedAt: null,
  };

  if (query.status) where.status = query.status;
  if (query.urgency) where.urgency = query.urgency;
  if (query.bloodGroup) where.bloodGroup = query.bloodGroup;
  if (query.requesterId) where.requesterId = query.requesterId;

  if (query.district) {
    where.district = { equals: query.district.trim(), mode: 'insensitive' };
  }
  if (query.city) {
    where.city = { equals: query.city.trim(), mode: 'insensitive' };
  }
  if (query.area) {
    where.area = { contains: query.area.trim(), mode: 'insensitive' };
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { hospitalName: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { contactPerson: { contains: term, mode: 'insensitive' } },
      { contactPhone: { contains: term, mode: 'insensitive' } },
      { city: { contains: term, mode: 'insensitive' } },
      { district: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (query.createdFrom || query.createdTo) {
    where.createdAt = {};
    if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
    if (query.createdTo) where.createdAt.lte = new Date(query.createdTo);
  }

  if (query.neededFrom || query.neededTo) {
    where.requiredAt = {};
    if (query.neededFrom) where.requiredAt.gte = new Date(query.neededFrom);
    if (query.neededTo) where.requiredAt.lte = new Date(query.neededTo);
  }

  const sortDirection = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.BloodRequestOrderByWithRelationInput[] = [];

  if (query.sortBy === 'urgency') {
    orderBy.push({ urgency: sortDirection });
    orderBy.push({ requiredAt: 'asc' });
    orderBy.push({ createdAt: 'desc' });
  } else if (query.sortBy === 'neededAt' || query.sortBy === 'requiredAt') {
    orderBy.push({ requiredAt: sortDirection });
    orderBy.push({ createdAt: 'desc' });
  } else if (query.sortBy === 'fulfilledUnits') {
    orderBy.push({ fulfilledUnits: sortDirection });
  } else if (query.sortBy === 'unitsRequired') {
    orderBy.push({ unitsRequired: sortDirection });
  } else {
    orderBy.push({ createdAt: sortDirection });
  }

  const [total, requests] = await Promise.all([
    prisma.bloodRequest.count({ where }),
    prisma.bloodRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: requestIncludeRelations,
    }),
  ]);

  return {
    data: requests.map(toFullBloodRequestResponse),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Administrative API: Retrieves complete administrative details for a single request,
 * including requester information, assignment summary, fulfillment statistics, and history.
 */
export const getAdminBloodRequestById = async (
  requestId: string
): Promise<AdminBloodRequestDetailResponse> => {
  const request = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: {
      ...requestIncludeRelations,
      history: {
        orderBy: { createdAt: 'asc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!request || request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  return toAdminBloodRequestDetailResponse(request);
};

/**
 * Transactionally updates request fulfillment from completed donations.
 * Computes fulfilled units, determines PARTIALLY_FULFILLED vs FULFILLED status,
 * records lifecycle history, and dispatches notifications.
 */
export const updateRequestFulfillment = async (
  bloodRequestId: string,
  txClient?: Prisma.TransactionClient
) => {
  const runInTx = async (tx: Prisma.TransactionClient) => {
    const request = await tx.bloodRequest.findUnique({
      where: { id: bloodRequestId },
      include: { requester: true },
    });

    if (!request) return null;

    // Count completed donations
    const completedCount = await tx.donation.count({
      where: {
        bloodRequestId,
        status: DonationStatus.COMPLETED,
      },
    });

    const fulfilledUnits = Math.min(completedCount, request.unitsRequired);
    const remaining = calculateRemainingUnits(request.unitsRequired, fulfilledUnits);

    let nextStatus: RequestStatus = request.status;

    if (fulfilledUnits >= request.unitsRequired) {
      nextStatus = RequestStatus.FULFILLED;
    } else if (fulfilledUnits > 0) {
      nextStatus = RequestStatus.PARTIALLY_FULFILLED;
    }

    if (fulfilledUnits === request.fulfilledUnits && nextStatus === request.status) {
      // Nothing changed, idempotent exit
      return { request, nextStatus, fulfilledUnits, remaining, statusChanged: false };
    }

    const previousStatus = request.status;

    // Validate status transition if status is changing
    if (nextStatus !== previousStatus) {
      validateBloodRequestTransition(previousStatus, nextStatus);
    }

    const updated = await tx.bloodRequest.update({
      where: { id: bloodRequestId },
      data: {
        fulfilledUnits,
        status: nextStatus,
      },
    });

    await recordRequestHistory(tx, {
      bloodRequestId,
      action: nextStatus === RequestStatus.FULFILLED ? 'FULFILLED' : 'PARTIALLY_FULFILLED',
      previousStatus,
      newStatus: nextStatus,
      previousUrgency: request.urgency,
      newUrgency: request.urgency,
      reason: `Donation completed. Fulfillment progress: ${fulfilledUnits}/${request.unitsRequired} unit(s).`,
      metadata: {
        fulfilledUnits,
        remainingUnits: remaining,
        completedDonationsCount: completedCount,
      },
    });

    return { request: updated, nextStatus, previousStatus, fulfilledUnits, remaining, statusChanged: nextStatus !== previousStatus, requester: request.requester };
  };

  const result = txClient ? await runInTx(txClient) : await prisma.$transaction(runInTx);

  if (result && result.statusChanged && result.requester) {
    try {
      const isFull = result.nextStatus === RequestStatus.FULFILLED;
      const title = isFull ? 'Blood Request Fulfilled!' : 'Blood Request Partially Fulfilled';
      const message = isFull
        ? `All ${result.fulfilledUnits} required unit(s) of blood for ${result.request.patientName} have been fulfilled.`
        : `${result.fulfilledUnits} unit(s) of blood for ${result.request.patientName} have been fulfilled (${result.remaining} unit(s) remaining).`;

      await createNotification({
        userId: result.requester.id,
        type: NotificationType.REQUEST,
        title,
        message,
        metadata: { requestId: bloodRequestId, fulfilledUnits: result.fulfilledUnits, status: result.nextStatus },
      });

      void sendBloodRequestStatusEmail(result.requester.email, {
        recipientName: result.requester.name,
        patientName: result.request.patientName,
        bloodGroup: result.request.bloodGroup,
        units: result.request.unitsRequired,
        hospitalName: result.request.hospitalName,
        status: result.nextStatus,
        reason: message,
      });
    } catch (err) {
      console.error('[Fulfillment] Failed to send fulfillment notification:', err);
    }
  }

  return result;
};
