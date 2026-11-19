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
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../types/index.js';
import {
  EDITABLE_STATUSES,
  CANCELLABLE_STATUSES,
} from './request.constant.js';
import type {
  CreateBloodRequestDTO,
  UpdateBloodRequestDTO,
  GetBloodRequestsQueryDTO,
  BloodRequestResponse,
  PublicBloodRequestSummary,
} from './request.interface.js';
import {
  toPublicBloodRequestSummary,
  toFullBloodRequestResponse,
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
 * Creates a new blood donation request with comprehensive validation,
 * duplicate detection, and notification dispatch.
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
      status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.IN_PROGRESS] },
      deletedAt: null,
    },
  });

  if (existingActive) {
    throw new AppError(
      httpStatus.CONFLICT,
      `An active blood request for patient "${data.patientName}" with blood group ${data.bloodGroup} at ${data.hospitalName} already exists (ID: ${existingActive.id}). You can update your existing request instead.`
    );
  }

  // 3. Normalize input fields
  const unitsRequired = data.unitsNeeded ?? data.unitsRequired ?? 1;
  const requiredAt = new Date(data.neededAt ?? data.requiredAt!);
  const contactPerson = (data.contactName ?? data.contactPerson)!.trim();
  const details = data.details || [data.reason, data.additionalNotes].filter(Boolean).join(' - ') || null;
  const urgency = data.urgency || RequestUrgency.NORMAL;

  // 4. Create blood request in database
  const bloodRequest = await prisma.bloodRequest.create({
    data: {
      requesterId,
      patientName: data.patientName.trim(),
      bloodGroup: data.bloodGroup,
      unitsRequired,
      hospitalName: data.hospitalName.trim(),
      hospitalAddress: data.hospitalAddress.trim(),
      district: data.district.trim(),
      city: data.city.trim(),
      area: data.area ? data.area.trim() : '',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      contactPerson,
      contactPhone: data.contactPhone.trim(),
      requiredAt,
      urgency,
      status: RequestStatus.PENDING,
      details,
    },
    include: requestIncludeRelations,
  });

  // 5. In-app notification for requester
  await createNotification({
    userId: requesterId,
    type: NotificationType.REQUEST,
    title: 'Blood Request Submitted',
    message: `Your request for ${unitsRequired} unit(s) of ${data.bloodGroup} blood at ${data.hospitalName} has been received and is pending review.`,
    metadata: { requestId: bloodRequest.id },
  });

  // 6. Asynchronous email notification to requester
  sendBloodRequestCreatedEmail(actor.email, {
    recipientName: actor.name,
    patientName: bloodRequest.patientName,
    bloodGroup: bloodRequest.bloodGroup,
    units: bloodRequest.unitsRequired,
    hospitalName: bloodRequest.hospitalName,
    hospitalAddress: bloodRequest.hospitalAddress,
    contactNumber: bloodRequest.contactPhone,
    neededBy: bloodRequest.requiredAt.toISOString(),
    requestUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests/${bloodRequest.id}`,
  }).catch((err) => {
    console.error('[BloodRequestService] Failed to send creation confirmation email:', err);
  });

  // 7. If EMERGENCY urgency, notify nearby compatible donors immediately
  if (urgency === RequestUrgency.EMERGENCY) {
    const compatibleGroups = getCompatibleDonorBloodGroups(bloodRequest.bloodGroup);
    prisma.donorProfile
      .findMany({
        where: {
          bloodGroup: { in: compatibleGroups },
          isAvailable: true,
          hasMedicalRestriction: false,
          user: { status: 'ACTIVE', emailVerified: true },
          OR: [{ eligibleAt: null }, { eligibleAt: { lte: new Date() } }],
        },
        include: { user: true },
        take: 20,
      })
      .then((eligibleDonors) => {
        eligibleDonors.forEach((donor) => {
          sendEmergencyBloodRequestEmail(donor.user.email, {
            donorName: donor.user.name,
            patientName: bloodRequest.patientName,
            bloodGroup: bloodRequest.bloodGroup,
            units: bloodRequest.unitsRequired,
            hospitalName: bloodRequest.hospitalName,
            hospitalAddress: bloodRequest.hospitalAddress,
            contactNumber: bloodRequest.contactPhone,
            neededBy: bloodRequest.requiredAt.toISOString(),
            urgencyLevel: 'EMERGENCY',
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests/${bloodRequest.id}`,
          }).catch(() => {});
        });
      })
      .catch(() => {});
  }

  // 8. Audit log entry
  logAuditEvent({
    actorId: actor.id,
    action: 'BLOOD_REQUEST_CREATED',
    entity: 'BloodRequest',
    entityId: bloodRequest.id,
    metadata: {
      bloodGroup: bloodRequest.bloodGroup,
      unitsRequired: bloodRequest.unitsRequired,
      urgency: bloodRequest.urgency,
      hospitalName: bloodRequest.hospitalName,
    },
  }).catch(() => {});

  return toFullBloodRequestResponse(bloodRequest);
};

/**
 * Retrieves paginated blood requests with filtering and role-based privacy masking.
 */
export const getBloodRequests = async (
  query: GetBloodRequestsQueryDTO,
  viewer?: AuthUser
): Promise<{
  data: (BloodRequestResponse | PublicBloodRequestSummary)[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.BloodRequestWhereInput = {
    deletedAt: null,
  };

  if (query.bloodGroup) where.bloodGroup = query.bloodGroup;
  if (query.district) where.district = { contains: query.district, mode: 'insensitive' };
  if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
  if (query.area) where.area = { contains: query.area, mode: 'insensitive' };
  if (query.urgency) where.urgency = query.urgency;
  if (query.status) where.status = query.status;

  if (query.fromDate || query.toDate) {
    where.requiredAt = {
      ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
      ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
    };
  }

  if (query.search) {
    where.OR = [
      { patientName: { contains: query.search, mode: 'insensitive' } },
      { hospitalName: { contains: query.search, mode: 'insensitive' } },
      { hospitalAddress: { contains: query.search, mode: 'insensitive' } },
      { district: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
      { area: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const allowedSortFields = [
    'createdAt',
    'requiredAt',
    'neededAt',
    'urgency',
    'unitsRequired',
    'city',
    'district',
  ];
  const sortByField = query.sortBy === 'neededAt' ? 'requiredAt' : query.sortBy;
  const sortBy = allowedSortFields.includes(sortByField || '') ? sortByField! : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, requests] = await Promise.all([
    prisma.bloodRequest.count({ where }),
    prisma.bloodRequest.findMany({
      where,
      include: requestIncludeRelations,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  const isPrivileged =
    viewer &&
    (viewer.role === UserRole.ADMIN || viewer.role === UserRole.SUPER_ADMIN);

  const data = requests.map((req) => {
    const isOwner = viewer && viewer.id === req.requesterId;
    return isPrivileged || isOwner
      ? toFullBloodRequestResponse(req)
      : toPublicBloodRequestSummary(req);
  });

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves requests created by the authenticated user.
 */
export const getMyBloodRequests = async (
  requesterId: string,
  query: GetBloodRequestsQueryDTO
): Promise<{
  data: BloodRequestResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.BloodRequestWhereInput = {
    requesterId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, requests] = await Promise.all([
    prisma.bloodRequest.count({ where }),
    prisma.bloodRequest.findMany({
      where,
      include: requestIncludeRelations,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: requests.map((r) => toFullBloodRequestResponse(r)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a single blood request by ID with privacy protection.
 */
export const getBloodRequestById = async (
  requestId: string,
  viewer?: AuthUser
): Promise<BloodRequestResponse | PublicBloodRequestSummary> => {
  const request = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: requestIncludeRelations,
  });

  if (!request || request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  const isOwner = viewer && viewer.id === request.requesterId;
  const isAdmin =
    viewer &&
    (viewer.role === UserRole.ADMIN || viewer.role === UserRole.SUPER_ADMIN);

  if (isOwner || isAdmin) {
    return toFullBloodRequestResponse(request);
  }

  return toPublicBloodRequestSummary(request);
};

/**
 * Updates an eligible blood request with ownership protection.
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
      "Forbidden. You don't have permission to update this blood request."
    );
  }

  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot edit a blood request in '${existing.status}' status.`
    );
  }

  // Once matching / assignments have commenced, bloodGroup cannot be altered
  if (data.bloodGroup && data.bloodGroup !== existing.bloodGroup && existing.status === RequestStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot change blood group while donor assignments are in progress.'
    );
  }

  const updateData: Prisma.BloodRequestUpdateInput = {};

  if (data.patientName !== undefined) updateData.patientName = data.patientName.trim();
  if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup;
  if (data.unitsNeeded !== undefined || data.unitsRequired !== undefined) {
    updateData.unitsRequired = data.unitsNeeded ?? data.unitsRequired;
  }
  if (data.hospitalName !== undefined) updateData.hospitalName = data.hospitalName.trim();
  if (data.hospitalAddress !== undefined) updateData.hospitalAddress = data.hospitalAddress.trim();
  if (data.district !== undefined) updateData.district = data.district.trim();
  if (data.city !== undefined) updateData.city = data.city.trim();
  if (data.area !== undefined) updateData.area = data.area.trim();
  if (data.latitude !== undefined) updateData.latitude = data.latitude;
  if (data.longitude !== undefined) updateData.longitude = data.longitude;
  if (data.contactName !== undefined || data.contactPerson !== undefined) {
    updateData.contactPerson = (data.contactName ?? data.contactPerson)!.trim();
  }
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone.trim();
  if (data.neededAt !== undefined || data.requiredAt !== undefined) {
    updateData.requiredAt = new Date(data.neededAt ?? data.requiredAt!);
  }
  if (data.urgency !== undefined) updateData.urgency = data.urgency;
  if (data.details !== undefined || data.reason !== undefined || data.additionalNotes !== undefined) {
    updateData.details = data.details || [data.reason, data.additionalNotes].filter(Boolean).join(' - ') || null;
  }

  const updated = await prisma.bloodRequest.update({
    where: { id: requestId },
    data: updateData,
    include: requestIncludeRelations,
  });

  return toFullBloodRequestResponse(updated);
};

/**
 * Cancels a blood request transactionally, cancelling associated assignments.
 */
export const cancelBloodRequest = async (
  requestId: string,
  cancellationReason: string | undefined,
  actor: AuthUser
): Promise<BloodRequestResponse> => {
  const existing = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
    include: { assignments: true },
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

  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel a blood request in '${existing.status}' status.`
    );
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Cancel active assignments
    await tx.donorAssignment.updateMany({
      where: {
        requestId,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
      data: {
        status: AssignmentStatus.CANCELLED,
      },
    });

    // 2. Update request status
    const cancelled = await tx.bloodRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.CANCELLED,
        cancellationReason: cancellationReason || 'Cancelled by requester',
      },
      include: requestIncludeRelations,
    });

    // 3. Notify requester
    await createNotification({
      userId: cancelled.requesterId,
      type: NotificationType.REQUEST,
      title: 'Blood Request Cancelled',
      message: `Your request for ${cancelled.patientName} (${cancelled.bloodGroup}) has been cancelled.`,
      metadata: { requestId: cancelled.id },
    });

    // 4. Audit entry
    await logAuditEvent({
      actorId: actor.id,
      action: 'BLOOD_REQUEST_CANCELLED',
      entity: 'BloodRequest',
      entityId: cancelled.id,
      metadata: { cancellationReason: cancellationReason || null },
    });

    return toFullBloodRequestResponse(cancelled);
  });
};

/**
 * Administrative action: Approves a pending blood request and triggers donor matching.
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

  const approved = await prisma.bloodRequest.update({
    where: { id: requestId },
    data: { status: RequestStatus.APPROVED },
    include: requestIncludeRelations,
  });

  // Notify requester
  await createNotification({
    userId: approved.requesterId,
    type: NotificationType.REQUEST,
    title: 'Blood Request Approved',
    message: `Your request for ${approved.patientName} has been approved by our medical coordination team.`,
    metadata: { requestId: approved.id },
  });

  sendBloodRequestStatusEmail(approved.requester.email, {
    recipientName: approved.requester.name,
    patientName: approved.patientName,
    bloodGroup: approved.bloodGroup,
    units: approved.unitsRequired,
    hospitalName: approved.hospitalName,
    status: 'APPROVED',
  }).catch(() => {});

  // Log audit
  await logAuditEvent({
    actorId: actor.id,
    action: 'BLOOD_REQUEST_APPROVED',
    entity: 'BloodRequest',
    entityId: approved.id,
  });

  return toFullBloodRequestResponse(approved);
};

/**
 * Administrative action: Rejects a pending blood request with mandatory reason.
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

  const rejected = await prisma.bloodRequest.update({
    where: { id: requestId },
    data: {
      status: RequestStatus.REJECTED,
      rejectionReason,
    },
    include: requestIncludeRelations,
  });

  // Notify requester
  await createNotification({
    userId: rejected.requesterId,
    type: NotificationType.REQUEST,
    title: 'Blood Request Declined',
    message: `Your blood request was not approved: ${rejectionReason}`,
    metadata: { requestId: rejected.id, rejectionReason },
  });

  sendBloodRequestStatusEmail(rejected.requester.email, {
    recipientName: rejected.requester.name,
    patientName: rejected.patientName,
    bloodGroup: rejected.bloodGroup,
    units: rejected.unitsRequired,
    hospitalName: rejected.hospitalName,
    status: 'REJECTED',
    reason: rejectionReason,
  }).catch(() => {});

  await logAuditEvent({
    actorId: actor.id,
    action: 'BLOOD_REQUEST_REJECTED',
    entity: 'BloodRequest',
    entityId: rejected.id,
    metadata: { rejectionReason },
  });

  return toFullBloodRequestResponse(rejected);
};
