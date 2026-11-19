import { BloodGroup } from '../../generated/prisma/enums.js';

export const DONATION_COOLDOWN_DAYS = 90;

export const ELIGIBILITY_REASONS = {
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  BLOOD_GROUP_MISSING: 'BLOOD_GROUP_MISSING',
  LOCATION_MISSING: 'LOCATION_MISSING',
  DONOR_UNAVAILABLE: 'DONOR_UNAVAILABLE',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  DONATION_COOLDOWN_ACTIVE: 'DONATION_COOLDOWN_ACTIVE',
  ACTIVE_ASSIGNMENT_EXISTS: 'ACTIVE_ASSIGNMENT_EXISTS',
  MEDICAL_RESTRICTION: 'MEDICAL_RESTRICTION',
} as const;

export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[keyof typeof ELIGIBILITY_REASONS];

/**
 * Red Blood Cell (RBC) Donation Compatibility Matrix
 * Key: Donor Blood Group
 * Value: Array of Recipient Blood Groups that can safely receive RBCs from this donor
 */
export const RBC_DONOR_COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  [BloodGroup.O_NEGATIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ],
  [BloodGroup.O_POSITIVE]: [
    BloodGroup.O_POSITIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_POSITIVE,
  ],
  [BloodGroup.A_NEGATIVE]: [
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ],
  [BloodGroup.A_POSITIVE]: [BloodGroup.A_POSITIVE, BloodGroup.AB_POSITIVE],
  [BloodGroup.B_NEGATIVE]: [
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ],
  [BloodGroup.B_POSITIVE]: [BloodGroup.B_POSITIVE, BloodGroup.AB_POSITIVE],
  [BloodGroup.AB_NEGATIVE]: [BloodGroup.AB_NEGATIVE, BloodGroup.AB_POSITIVE],
  [BloodGroup.AB_POSITIVE]: [BloodGroup.AB_POSITIVE],
};

/**
 * Red Blood Cell (RBC) Recipient Compatibility Matrix
 * Key: Recipient Blood Group
 * Value: Array of Donor Blood Groups that this recipient can safely receive RBCs from
 */
export const RBC_RECIPIENT_COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  [BloodGroup.O_NEGATIVE]: [BloodGroup.O_NEGATIVE],
  [BloodGroup.O_POSITIVE]: [BloodGroup.O_NEGATIVE, BloodGroup.O_POSITIVE],
  [BloodGroup.A_NEGATIVE]: [BloodGroup.O_NEGATIVE, BloodGroup.A_NEGATIVE],
  [BloodGroup.A_POSITIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
  ],
  [BloodGroup.B_NEGATIVE]: [BloodGroup.O_NEGATIVE, BloodGroup.B_NEGATIVE],
  [BloodGroup.B_POSITIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
  ],
  [BloodGroup.AB_NEGATIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.AB_NEGATIVE,
  ],
  [BloodGroup.AB_POSITIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ],
};
