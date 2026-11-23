import type { BloodGroup, AssignmentStatus, DonationStatus } from '../../generated/prisma/enums.js';
import type { EligibilityReason } from './donor.constant.js';

export interface DonorUserSummary {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface PublicDonorUserSummary {
  name: string;
}

export interface DonorProfileResponse {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  bloodGroup: BloodGroup | null;
  dateOfBirth: Date | null;
  gender: string | null;
  district: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isAvailable: boolean;
  isVerified: boolean;
  hasMedicalRestriction: boolean;
  medicalRestrictionReason: string | null;
  lastDonationDate: Date | null;
  eligibleAt: Date | null;
  totalDonations?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicDonorSummary {
  id: string;
  bloodGroup: BloodGroup | null;
  district: string | null;
  city: string | null;
  area: string | null;
  isAvailable: boolean;
  isVerified: boolean;
  lastDonationDate: Date | null;
  eligibleAt: Date | null;
  distanceKm?: number;
  user: PublicDonorUserSummary;
}

export interface DonorSearchResultDTO {
  id: string;
  name: string;
  bloodGroup: BloodGroup | null;
  district: string | null;
  city: string | null;
  area?: string | null;
  isAvailable: boolean;
  isVerified: boolean;
  eligibility: {
    eligible: boolean;
  };
  distanceKm?: number;
}

export interface DonorSearchQueryDTO {
  bloodGroup?: BloodGroup;
  recipientBloodGroup?: BloodGroup;
  district?: string;
  city?: string;
  area?: string;
  search?: string;
  isAvailable?: boolean;
  isVerified?: boolean;
  eligibleOnly?: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number;
  sortBy?:
    | 'distance'
    | 'createdAt'
    | 'bloodGroup'
    | 'district'
    | 'city'
    | 'area'
    | 'lastDonationDate'
    | 'isVerified';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CompatibleDonorsQueryDTO {
  recipientBloodGroup: BloodGroup;
  district?: string;
  city?: string;
  area?: string;
  isAvailable?: boolean;
  eligibleOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface UpdateDonorProfileDTO {
  name?: string;
  phone?: string;
  bloodGroup?: BloodGroup;
  dateOfBirth?: string | Date;
  gender?: string;
  district?: string;
  city?: string;
  area?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateDonorAvailabilityDTO {
  isAvailable: boolean;
}

export interface GetDonorsQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  bloodGroup?: BloodGroup;
  district?: string;
  city?: string;
  area?: string;
  isAvailable?: boolean;
  isVerified?: boolean;
  eligible?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface NearbyDonorsQueryDTO {
  latitude: number;
  longitude: number;
  radius?: number; // In kilometers, default 10
  bloodGroup?: BloodGroup;
  isAvailable?: boolean;
  isVerified?: boolean;
  eligible?: boolean;
  limit?: number;
}

export interface DonorEligibilityResult {
  eligible: boolean;
  isEligible: boolean;
  canDonate: boolean;
  isAvailable?: boolean;
  reason?: EligibilityReason;
  reasons: string[];
  message: string;
  daysRemaining?: number;
  remainingCooldownDays: number;
  eligibleAt?: Date | null;
  cooldownEndsAt?: Date | null;
  lastDonationDate?: Date | null;
  details?: {
    cooldownDays?: number;
    activeAssignmentId?: string;
    missingFields?: string[];
    [key: string]: unknown;
  };
}

export interface AdminVerifyDonorDTO {
  isVerified: boolean;
}

export interface AdminRestrictDonorDTO {
  hasMedicalRestriction: boolean;
  medicalRestrictionReason?: string;
}

export interface MatchingOptions {
  bloodGroup: BloodGroup;
  district?: string;
  city?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  limit?: number;
  urgency?: string;
}

export interface EligibleDonorMatch {
  donor: PublicDonorSummary;
  distanceKm?: number;
  compatibility: {
    donorBloodGroup: BloodGroup;
    recipientBloodGroup: BloodGroup;
    isCompatible: boolean;
  };
}
