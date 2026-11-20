import type {
  BloodGroup,
  DonationStatus,
  DonationVerificationStatus,
} from '../../generated/prisma/enums.js';

export interface CreateDonationDTO {
  donorId: string;
  bloodRequestId: string;
  assignmentId?: string;
  unitsDonated?: number;
  donationDate?: string | Date;
  hospitalName?: string;
  hospitalAddress?: string;
  notes?: string;
}

export interface VerifyDonationDTO {
  notes?: string;
}

export interface RejectDonationDTO {
  reason: string;
}

export interface DonationQueryDTO {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: DonationStatus;
  verificationStatus?: DonationVerificationStatus;
  startDate?: string;
  endDate?: string;
  bloodRequestId?: string;
  donorId?: string;
  district?: string;
  bloodGroup?: BloodGroup;
}

export interface DonationHistorySummary {
  totalDonations: number;
  completedDonations: number;
  pendingDonations: number;
  totalUnitsDonated: number;
  lastDonationDate: Date | null;
  cooldownEndsAt: Date | null;
  isEligible: boolean;
  remainingCooldownDays: number;
}

export interface DonationItemResponse {
  id: string;
  assignmentId: string | null;
  bloodRequestId: string;
  donorId: string;
  donorName?: string;
  bloodGroup: BloodGroup | null;
  unitsDonated: number;
  donationDate: Date;
  status: DonationStatus;
  verificationStatus: DonationVerificationStatus;
  hospitalName: string | null;
  hospitalAddress: string | null;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface DonationHistoryResult {
  summary: DonationHistorySummary;
  donations: DonationItemResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
