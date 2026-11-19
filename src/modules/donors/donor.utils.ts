import { BloodGroup } from '../../generated/prisma/enums.js';
import {
  DONATION_COOLDOWN_DAYS,
  RBC_DONOR_COMPATIBILITY_MAP,
  RBC_RECIPIENT_COMPATIBILITY_MAP,
} from './donor.constant.js';
import type {
  DonorProfileResponse,
  PublicDonorSummary,
} from './donor.interface.js';

/**
 * Checks whether RBCs from donorGroup can be safely transfused to recipientGroup.
 */
export const isBloodGroupCompatible = (
  donorGroup: BloodGroup,
  recipientGroup: BloodGroup,
): boolean => {
  const compatibleRecipients = RBC_DONOR_COMPATIBILITY_MAP[donorGroup];
  return compatibleRecipients ? compatibleRecipients.includes(recipientGroup) : false;
};

/**
 * Returns list of blood groups that can safely receive RBCs from the given donor blood group.
 */
export const getCompatibleRecipientBloodGroups = (
  donorGroup: BloodGroup,
): BloodGroup[] => {
  return RBC_DONOR_COMPATIBILITY_MAP[donorGroup] || [];
};

/**
 * Returns list of blood groups whose RBCs can be safely received by the given recipient blood group.
 */
export const getCompatibleDonorBloodGroups = (
  recipientGroup: BloodGroup,
): BloodGroup[] => {
  return RBC_RECIPIENT_COMPATIBILITY_MAP[recipientGroup] || [];
};

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 * Returns distance in kilometers (rounded to 2 decimal places).
 */
export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100;
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
