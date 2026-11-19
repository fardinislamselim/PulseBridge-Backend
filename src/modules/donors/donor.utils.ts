import { BloodGroup, UserStatus } from '../../generated/prisma/enums.js';
import { DONATION_COOLDOWN_DAYS } from './donor.constant.js';
import type {
  DonorProfileResponse,
  PublicDonorSummary,
  DonorSearchResultDTO,
} from './donor.interface.js';
import {
  isBloodGroupCompatible,
  isBloodCompatible,
  getCompatibleRecipientBloodGroups,
  getCompatibleDonorBloodGroups,
} from '../matching/utils/blood-compatibility.js';
import {
  calculateDistanceKm,
  isValidCoordinate,
  getBoundingBox,
} from '../../shared/location/location.utils.js';

export {
  isBloodGroupCompatible,
  isBloodCompatible,
  getCompatibleRecipientBloodGroups,
  getCompatibleDonorBloodGroups,
  calculateDistanceKm,
  isValidCoordinate,
  getBoundingBox,
};

/**
 * Calculates remaining cooldown and eligible date from a given last donation date.
 */
export const calculateCooldown = (
  lastDonationDate: Date | null | undefined,
  cooldownDays: number = DONATION_COOLDOWN_DAYS,
): {
  isCooldownActive: boolean;
  daysRemaining: number;
  eligibleAt: Date | null;
} => {
  if (!lastDonationDate) {
    return {
      isCooldownActive: false,
      daysRemaining: 0,
      eligibleAt: null,
    };
  }

  const lastDate = new Date(lastDonationDate);
  const eligibleDate = new Date(lastDate.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const diffMs = eligibleDate.getTime() - now.getTime();
  if (diffMs > 0) {
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return {
      isCooldownActive: true,
      daysRemaining,
      eligibleAt: eligibleDate,
    };
  }

  return {
    isCooldownActive: false,
    daysRemaining: 0,
    eligibleAt: eligibleDate,
  };
};

/**
 * Sanitizes donor profile for public consumption.
 * Strictly omits phone numbers, exact addresses, coordinates, and private medical notes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toPublicDonorSummary = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  donor: any,
  distanceKm?: number,
): PublicDonorSummary => {
  return {
    id: donor.id,
    bloodGroup: donor.bloodGroup ?? null,
    district: donor.district ?? null,
    city: donor.city ?? null,
    area: donor.area ?? null,
    isAvailable: Boolean(donor.isAvailable),
    isVerified: Boolean(donor.isVerified),
    lastDonationDate: donor.lastDonationDate ?? null,
    eligibleAt: donor.eligibleAt ?? null,
    ...(distanceKm !== undefined ? { distanceKm } : {}),
    user: {
      name: donor.user?.name ?? 'Anonymous Donor',
    },
  };
};

/**
 * Formats full donor profile for authenticated donor owner or administrative review.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toFullDonorProfile = (donor: any): DonorProfileResponse => {
  return {
    id: donor.id,
    userId: donor.userId,
    name: donor.user?.name ?? '',
    email: donor.user?.email ?? '',
    phone: donor.user?.phone ?? null,
    bloodGroup: donor.bloodGroup ?? null,
    dateOfBirth: donor.dateOfBirth ?? null,
    gender: donor.gender ?? null,
    district: donor.district ?? null,
    city: donor.city ?? null,
    area: donor.area ?? null,
    address: donor.address ?? null,
    latitude: donor.latitude ?? null,
    longitude: donor.longitude ?? null,
    isAvailable: Boolean(donor.isAvailable),
    isVerified: Boolean(donor.isVerified),
    hasMedicalRestriction: Boolean(donor.hasMedicalRestriction),
    medicalRestrictionReason: donor.medicalRestrictionReason ?? null,
    lastDonationDate: donor.lastDonationDate ?? null,
    eligibleAt: donor.eligibleAt ?? null,
    ...(donor._count?.donations !== undefined
      ? { totalDonations: donor._count.donations }
      : {}),
    createdAt: donor.createdAt,
    updatedAt: donor.updatedAt,
  };
};

/**
 * Fast synchronous eligibility check based on pre-fetched donor profile relations.
 * Evaluates account status, verification, medical restrictions, location, cooldown, and assignments.
 */
export const isDonorEligibleSync = (donor: {
  isAvailable: boolean;
  hasMedicalRestriction: boolean;
  bloodGroup: BloodGroup | null;
  district: string | null;
  city: string | null;
  lastDonationDate?: Date | null;
  eligibleAt?: Date | null;
  user?: { status: UserStatus; emailVerified: boolean } | null;
  assignments?: { id: string }[];
}): boolean => {
  if (!donor.user) return false;
  if (donor.user.status !== UserStatus.ACTIVE) return false;
  if (!donor.user.emailVerified) return false;
  if (donor.hasMedicalRestriction) return false;
  if (!donor.bloodGroup) return false;
  if (!donor.district || !donor.city) return false;
  if (!donor.isAvailable) return false;
  if (donor.assignments && donor.assignments.length > 0) return false;
  if (donor.eligibleAt && donor.eligibleAt > new Date()) return false;
  if (donor.lastDonationDate) {
    const cooldown = calculateCooldown(donor.lastDonationDate);
    if (cooldown.isCooldownActive) return false;
  }
  return true;
};

/**
 * Maps a donor profile entity to a privacy-safe search result DTO.
 * Guarantees phone, address, and exact coordinates are strictly masked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toDonorSearchResultDTO = (
  donor: any,
  isEligible: boolean,
  distanceKm?: number
): DonorSearchResultDTO => {
  return {
    id: donor.id,
    name: donor.user?.name ?? 'Anonymous Donor',
    bloodGroup: donor.bloodGroup ?? null,
    district: donor.district ?? null,
    city: donor.city ?? null,
    area: donor.area ?? null,
    isAvailable: Boolean(donor.isAvailable),
    isVerified: Boolean(donor.isVerified),
    eligibility: {
      eligible: isEligible,
    },
    ...(distanceKm !== undefined && !isNaN(distanceKm) ? { distanceKm } : {}),
  };
};
