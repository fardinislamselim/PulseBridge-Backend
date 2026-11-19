import type {
  BloodGroup,
  RequestStatus,
  RequestUrgency,
  AssignmentStatus,
} from '../../generated/prisma/enums.js';

export interface CreateBloodRequestDTO {
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded?: number;
  unitsRequired?: number;
  hospitalName: string;
  hospitalAddress: string;
  district: string;
  city: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPerson?: string;
  contactPhone: string;
  neededAt?: string | Date;
  requiredAt?: string | Date;
  urgency?: RequestUrgency;
  reason?: string;
  additionalNotes?: string;
  details?: string;
}

export interface UpdateBloodRequestDTO {
  patientName?: string;
  bloodGroup?: BloodGroup;
  unitsNeeded?: number;
  unitsRequired?: number;
  hospitalName?: string;
  hospitalAddress?: string;
  district?: string;
  city?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPerson?: string;
  contactPhone?: string;
  neededAt?: string | Date;
  requiredAt?: string | Date;
  urgency?: RequestUrgency;
  reason?: string;
  additionalNotes?: string;
  details?: string;
}

export interface CancelBloodRequestDTO {
  cancellationReason?: string;
  reason?: string;
}

export interface RejectBloodRequestDTO {
  rejectionReason?: string;
  reason?: string;
}

export interface UpdateUrgencyDTO {
  urgency: RequestUrgency;
  reason: string;
}

export interface ExpireRequestDTO {
  reason?: string;
}

export interface GetBloodRequestsQueryDTO {
  bloodGroup?: BloodGroup;
  district?: string;
  city?: string;
  area?: string;
  urgency?: RequestUrgency;
  status?: RequestStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminGetBloodRequestsQueryDTO extends GetBloodRequestsQueryDTO {
  requesterId?: string;
  createdFrom?: string;
  createdTo?: string;
  neededFrom?: string;
  neededTo?: string;
}

export interface RequesterSummary {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface DonorAssignmentSummary {
  id: string;
  donorProfileId: string;
  status: AssignmentStatus;
  assignedAt: Date;
  notes?: string | null;
  donorName?: string;
  donorBloodGroup?: BloodGroup | null;
}

export interface BloodRequestResponse {
  id: string;
  requesterId: string;
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  unitsRequired: number;
  fulfilledUnits: number;
  remainingUnits: number;
  hospitalName: string;
  hospitalAddress: string;
  district: string;
  city: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  contactName: string;
  contactPerson: string;
  contactPhone: string;
  neededAt: Date;
  requiredAt: Date;
  urgency: RequestUrgency;
  status: RequestStatus;
  details: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requester?: RequesterSummary;
  assignments?: DonorAssignmentSummary[];
}

export interface PublicBloodRequestSummary {
  id: string;
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  unitsRequired: number;
  fulfilledUnits: number;
  remainingUnits: number;
  hospitalName: string;
  hospitalAddress: string;
  district: string;
  city: string;
  area: string | null;
  neededAt: Date;
  requiredAt: Date;
  urgency: RequestUrgency;
  status: RequestStatus;
  createdAt: Date;
  // Patient contact details and exact coordinates are strictly masked for public callers
}

export interface BloodRequestHistoryResponse {
  id: string;
  bloodRequestId: string;
  actorId: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  previousUrgency: string | null;
  newUrgency: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface AdminBloodRequestDetailResponse extends BloodRequestResponse {
  assignmentSummary: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    completed: number;
    cancelled: number;
  };
  history?: BloodRequestHistoryResponse[];
}
