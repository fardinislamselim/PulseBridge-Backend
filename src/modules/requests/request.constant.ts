import { RequestUrgency, RequestStatus } from '../../generated/prisma/enums.js';

export const MAX_UNITS_ALLOWED = 20;
export const MIN_UNITS_ALLOWED = 1;

export const URGENCY_PRIORITY_MAP: Record<RequestUrgency, number> = {
  [RequestUrgency.EMERGENCY]: 1,
  [RequestUrgency.URGENT]: 2,
  [RequestUrgency.NORMAL]: 3,
};

export const EDITABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
];

export const CANCELLABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.IN_PROGRESS,
];
