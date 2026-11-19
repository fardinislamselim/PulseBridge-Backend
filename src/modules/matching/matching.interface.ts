import type { BloodGroup } from '../../generated/prisma/enums.js';
import type { BloodCompatibilityResult } from './utils/blood-compatibility.js';

export interface RecipientCompatibilityResponse {
  donorBloodGroup: BloodGroup;
  compatibleRecipientBloodGroups: BloodGroup[];
  component: 'RED_BLOOD_CELLS';
}

export interface DonorCompatibilityResponse {
  recipientBloodGroup: BloodGroup;
  compatibleDonorBloodGroups: BloodGroup[];
  component: 'RED_BLOOD_CELLS';
}

export interface PairwiseCompatibilityResponse extends BloodCompatibilityResult {}

export type CompatibilityApiResponse =
  | RecipientCompatibilityResponse
  | DonorCompatibilityResponse
  | PairwiseCompatibilityResponse;

export interface FindDonorsQueryDTO {
  requestId?: string;
  bloodGroup?: BloodGroup;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
}

export interface MatchingDonorResult {
  donorId: string;
  donorName?: string;
  donorBloodGroup: BloodGroup;
  requestedBloodGroup: BloodGroup;
  distanceKm?: number;
  district?: string | null;
  city?: string | null;
  area?: string | null;
  isAvailable: boolean;
  isVerified: boolean;
  bloodCompatibility: {
    compatible: boolean;
    component: 'RED_BLOOD_CELLS';
    requiresMedicalCrossmatch: true;
  };
}
