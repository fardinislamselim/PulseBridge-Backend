import httpStatus from 'http-status';
import { AppError } from '../../utils/AppError.js';
import { RequestStatus, AssignmentStatus } from '../../generated/prisma/enums.js';
import { VALID_STATUS_TRANSITIONS } from './request.constant.js';
import type {
  BloodRequestResponse,
  PublicBloodRequestSummary,
  BloodRequestHistoryResponse,
  AdminBloodRequestDetailResponse,
} from './request.interface.js';

/**
 * Centralized status transition validation service.
 * Throws AppError(400) if the transition is not permitted according to the lifecycle policy.
 */
export const validateBloodRequestTransition = (
  currentStatus: RequestStatus,
  nextStatus: RequestStatus
): void => {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid blood request status transition from '${currentStatus}' to '${nextStatus}'.`
    );
  }
};

/**
 * Calculates remaining unfulfilled units safely.
 */
export const calculateRemainingUnits = (unitsRequired: number, fulfilledUnits: number): number => {
  return Math.max(0, unitsRequired - fulfilledUnits);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toPublicBloodRequestSummary = (request: any): PublicBloodRequestSummary => {
  const units = request.unitsRequired ?? request.unitsNeeded ?? 1;
  const fulfilled = request.fulfilledUnits ?? 0;
  const neededAt = request.requiredAt ?? request.neededAt ?? new Date();

  return {
    id: request.id,
    patientName: request.patientName,
    bloodGroup: request.bloodGroup,
    unitsNeeded: units,
    unitsRequired: units,
    fulfilledUnits: fulfilled,
    remainingUnits: calculateRemainingUnits(units, fulfilled),
    hospitalName: request.hospitalName,
    hospitalAddress: request.hospitalAddress,
    district: request.district,
    city: request.city,
    area: request.area ?? null,
    neededAt,
    requiredAt: neededAt,
    urgency: request.urgency,
    status: request.status,
    createdAt: request.createdAt,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toFullBloodRequestResponse = (request: any): BloodRequestResponse => {
  const units = request.unitsRequired ?? request.unitsNeeded ?? 1;
  const fulfilled = request.fulfilledUnits ?? 0;
  const neededAt = request.requiredAt ?? request.neededAt ?? new Date();
  const contact = request.contactPerson ?? request.contactName ?? '';

  return {
    id: request.id,
    requesterId: request.requesterId,
    patientName: request.patientName,
    bloodGroup: request.bloodGroup,
    unitsNeeded: units,
    unitsRequired: units,
    fulfilledUnits: fulfilled,
    remainingUnits: calculateRemainingUnits(units, fulfilled),
    hospitalName: request.hospitalName,
    hospitalAddress: request.hospitalAddress,
    district: request.district,
    city: request.city,
    area: request.area ?? null,
    latitude: request.latitude ?? null,
    longitude: request.longitude ?? null,
    contactName: contact,
    contactPerson: contact,
    contactPhone: request.contactPhone,
    neededAt,
    requiredAt: neededAt,
    urgency: request.urgency,
    status: request.status,
    details: request.details ?? null,
    rejectionReason: request.rejectionReason ?? null,
    cancellationReason: request.cancellationReason ?? null,
    approvedBy: request.approvedBy ?? null,
    approvedAt: request.approvedAt ?? null,
    rejectedBy: request.rejectedBy ?? null,
    rejectedAt: request.rejectedAt ?? null,
    expiredAt: request.expiredAt ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...(request.requester
      ? {
          requester: {
            id: request.requester.id,
            name: request.requester.name,
            email: request.requester.email,
            phone: request.requester.phone ?? null,
          },
        }
      : {}),
    ...(Array.isArray(request.assignments)
      ? {
          assignments: request.assignments.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) => ({
              id: a.id,
              donorProfileId: a.donorProfileId,
              status: a.status,
              assignedAt: a.assignedAt,
              notes: a.notes ?? null,
              donorName: a.donorProfile?.user?.name,
              donorBloodGroup: a.donorProfile?.bloodGroup,
            })
          ),
        }
      : {}),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toBloodRequestHistoryResponse = (h: any): BloodRequestHistoryResponse => {
  return {
    id: h.id,
    bloodRequestId: h.bloodRequestId,
    actorId: h.actorId ?? null,
    action: h.action,
    previousStatus: h.previousStatus ?? null,
    newStatus: h.newStatus ?? null,
    previousUrgency: h.previousUrgency ?? null,
    newUrgency: h.newUrgency ?? null,
    reason: h.reason ?? null,
    metadata: h.metadata ?? null,
    createdAt: h.createdAt,
    ...(h.actor
      ? {
          actor: {
            id: h.actor.id,
            name: h.actor.name,
            email: h.actor.email,
            role: h.actor.role,
          },
        }
      : {}),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toAdminBloodRequestDetailResponse = (request: any): AdminBloodRequestDetailResponse => {
  const base = toFullBloodRequestResponse(request);

  // Compute assignment summary
  const assignments = Array.isArray(request.assignments) ? request.assignments : [];
  const assignmentSummary = {
    total: assignments.length,
    pending: assignments.filter((a: { status: string }) => a.status === AssignmentStatus.PENDING).length,
    accepted: assignments.filter((a: { status: string }) => a.status === AssignmentStatus.ACCEPTED).length,
    rejected: assignments.filter((a: { status: string }) => a.status === AssignmentStatus.REJECTED).length,
    completed: assignments.filter((a: { status: string }) => a.status === AssignmentStatus.COMPLETED).length,
    cancelled: assignments.filter((a: { status: string }) => a.status === AssignmentStatus.CANCELLED).length,
  };

  const history = Array.isArray(request.history)
    ? request.history.map(toBloodRequestHistoryResponse)
    : undefined;

  return {
    ...base,
    assignmentSummary,
    history,
  };
};
