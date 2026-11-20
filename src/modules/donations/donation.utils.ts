import { DONATION_COOLDOWN_DAYS } from './donation.constant.js';
import type { DonationItemResponse } from './donation.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

/**
 * Calculates the exact UTC expiration timestamp of the 90-day cooldown period.
 * Strictly adheres to UTC calendar addition to eliminate local timezone / DST bugs.
 */
export const calculateCooldownEndsAt = (
  lastDonationDate: Date | string,
  cooldownDays: number = DONATION_COOLDOWN_DAYS,
): Date => {
  const d = new Date(lastDonationDate);
  d.setUTCDate(d.getUTCDate() + cooldownDays);
  return d;
};

/**
 * Determines whether the 90-day cooldown is actively restricting donation eligibility.
 * Returns true if currentDate < cooldownEndsAt.
 */
export const isDonationCooldownActive = (
  lastDonationDate: Date | string | null | undefined,
  currentDate: Date = new Date(),
): boolean => {
  if (!lastDonationDate) return false;
  const endsAt = calculateCooldownEndsAt(new Date(lastDonationDate));
  return currentDate.getTime() < endsAt.getTime();
};

/**
 * Returns comprehensive status of the donor's 90-day cooldown.
 */
export const getDonationCooldownStatus = (
  lastDonationDate: Date | string | null | undefined,
  currentDate: Date = new Date(),
): {
  isActive: boolean;
  lastDonationDate: Date | null;
  cooldownEndsAt: Date | null;
  remainingDays: number;
} => {
  if (!lastDonationDate) {
    return {
      isActive: false,
      lastDonationDate: null,
      cooldownEndsAt: null,
      remainingDays: 0,
    };
  }

  const lastDate = new Date(lastDonationDate);
  const cooldownEndsAt = calculateCooldownEndsAt(lastDate);
  const diffMs = cooldownEndsAt.getTime() - currentDate.getTime();
  const isActive = diffMs > 0;
  const remainingDays = isActive ? Math.ceil(diffMs / (24 * 60 * 60 * 1000)) : 0;

  return {
    isActive,
    lastDonationDate: lastDate,
    cooldownEndsAt,
    remainingDays,
  };
};

/**
 * Formats and sanitizes a raw donation database entity for API responses.
 * Respects strict privacy rules: donors see their own details; admins see audit details;
 * requesters and public consumers receive strictly non-PII details.
 */
export const toSanitizedDonationItem = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  donation: any,
  viewerRole?: UserRole | string,
  isOwner: boolean = false,
): DonationItemResponse => {
  const canSeeFull = isOwner || viewerRole === UserRole.ADMIN || viewerRole === UserRole.SUPER_ADMIN;

  return {
    id: donation.id,
    assignmentId: donation.assignmentId || null,
    bloodRequestId: donation.bloodRequestId,
    donorId: donation.donorProfileId,
    donorName: canSeeFull ? donation.donorProfile?.user?.name : undefined,
    bloodGroup: donation.donorProfile?.bloodGroup || donation.bloodRequest?.bloodGroup || null,
    unitsDonated: donation.unitsDonated ?? 1,
    donationDate: donation.donationDate ?? donation.donatedAt ?? donation.createdAt,
    status: donation.status,
    verificationStatus: donation.verificationStatus,
    hospitalName: donation.hospitalName || donation.bloodRequest?.hospitalName || null,
    hospitalAddress: canSeeFull ? (donation.hospitalAddress || donation.bloodRequest?.hospitalAddress || null) : null,
    notes: canSeeFull ? donation.notes : null,
    rejectionReason: canSeeFull ? donation.rejectionReason : null,
    verifiedAt: donation.verifiedAt || null,
    completedAt: donation.completedAt || donation.donatedAt || null,
    createdAt: donation.createdAt,
  };
};
