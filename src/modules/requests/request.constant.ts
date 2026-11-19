import { RequestUrgency, RequestStatus } from '../../generated/prisma/enums.js';

// Aliases for unified naming convention
export const BloodRequestStatus = RequestStatus;
export type BloodRequestStatus = RequestStatus;

export const BloodRequestUrgency = RequestUrgency;
export type BloodRequestUrgency = RequestUrgency;

export const MAX_UNITS_ALLOWED = 20;
export const MIN_UNITS_ALLOWED = 1;

/**
 * Reusable urgency priority scale:
 * EMERGENCY (3) > URGENT (2) > NORMAL (1)
 */
export const URGENCY_PRIORITY_MAP: Record<RequestUrgency, number> = {
  [RequestUrgency.EMERGENCY]: 3,
  [RequestUrgency.URGENT]: 2,
  [RequestUrgency.NORMAL]: 1,
};

/**
 * Allowed status transitions for blood donation requests.
 *
 * PENDING
 *   ├── APPROVED
 *   ├── REJECTED
 *   └── CANCELLED
 *
 * APPROVED
 *   ├── MATCHING (and IN_PROGRESS)
 *   └── CANCELLED
 *
 * MATCHING / IN_PROGRESS
 *   ├── PARTIALLY_FULFILLED
 *   ├── FULFILLED
 *   ├── CANCELLED
 *   └── EXPIRED
 *
 * PARTIALLY_FULFILLED
 *   ├── MATCHING (and IN_PROGRESS)
 *   ├── FULFILLED
 *   ├── CANCELLED
 *   └── EXPIRED
 *
 * Terminal statuses: REJECTED, FULFILLED, CANCELLED, EXPIRED
 */
export const VALID_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [
    RequestStatus.APPROVED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
  ],
  [RequestStatus.APPROVED]: [
    RequestStatus.MATCHING,
    RequestStatus.IN_PROGRESS,
    RequestStatus.PARTIALLY_FULFILLED,
    RequestStatus.FULFILLED,
    RequestStatus.CANCELLED,
  ],
  [RequestStatus.MATCHING]: [
    RequestStatus.IN_PROGRESS,
    RequestStatus.PARTIALLY_FULFILLED,
    RequestStatus.FULFILLED,
    RequestStatus.CANCELLED,
    RequestStatus.EXPIRED,
  ],
  [RequestStatus.IN_PROGRESS]: [
    RequestStatus.MATCHING,
    RequestStatus.PARTIALLY_FULFILLED,
    RequestStatus.FULFILLED,
    RequestStatus.CANCELLED,
    RequestStatus.EXPIRED,
  ],
  [RequestStatus.PARTIALLY_FULFILLED]: [
    RequestStatus.MATCHING,
    RequestStatus.IN_PROGRESS,
    RequestStatus.FULFILLED,
    RequestStatus.CANCELLED,
    RequestStatus.EXPIRED,
  ],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.FULFILLED]: [],
  [RequestStatus.CANCELLED]: [],
  [RequestStatus.EXPIRED]: [],
};

export const TERMINAL_STATUSES: RequestStatus[] = [
  RequestStatus.REJECTED,
  RequestStatus.FULFILLED,
  RequestStatus.CANCELLED,
  RequestStatus.EXPIRED,
];

export const EDITABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.MATCHING,
  RequestStatus.IN_PROGRESS,
  RequestStatus.PARTIALLY_FULFILLED,
];

export const CANCELLABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.MATCHING,
  RequestStatus.IN_PROGRESS,
  RequestStatus.PARTIALLY_FULFILLED,
];

/**
 * Urgency auto-escalation thresholds
 */
export const ESCALATION_CONFIG = {
  NORMAL_TO_URGENT_HOURS: 24,
  URGENT_TO_EMERGENCY_HOURS: 6,
};
