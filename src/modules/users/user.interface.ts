import type { UserRole, UserStatus, BloodGroup } from '../../generated/prisma/enums.js';

export interface DonorProfileSummary {
  id: string;
  bloodGroup: BloodGroup | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  isAvailable: boolean;
  lastDonationDate: Date | null;
  eligibleAt: Date | null;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  donorProfile?: DonorProfileSummary | null;
}

export interface UserProfileResponse extends UserSummary {
  requestCount?: number;
  donationCount?: number;
}

export interface UpdateMyProfileDTO {
  name?: string;
  phone?: string;
  avatar?: string | null;
  bloodGroup?: BloodGroup;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  district?: string;
  isAvailable?: boolean;
}

export interface GetUsersQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  sortBy?: 'createdAt' | 'name' | 'email' | 'role' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateUserStatusDTO {
  status: UserStatus;
  reason?: string;
}

export interface UpdateUserRoleDTO {
  role: UserRole;
}
