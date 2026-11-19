import { BloodGroup } from '../../../generated/prisma/enums.js';

/**
 * Authoritative Red Blood Cell (RBC) Donation Compatibility Matrix.
 * Key: Donor Blood Group
 * Value: Array of Recipient Blood Groups that can safely receive RBCs from this donor.
 *
 * Medical scope: Applies to Red Blood Cell (RBC) transfusion compatibility only.
 * Final donor selection and transfusion compatibility must be confirmed by qualified
 * medical professionals and blood bank crossmatching.
 */
export const RBC_COMPATIBILITY_MATRIX: Record<BloodGroup, readonly BloodGroup[]> = Object.freeze({
  [BloodGroup.O_NEGATIVE]: Object.freeze([
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.O_POSITIVE]: Object.freeze([
    BloodGroup.O_POSITIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.A_NEGATIVE]: Object.freeze([
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.A_POSITIVE]: Object.freeze([
    BloodGroup.A_POSITIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.B_NEGATIVE]: Object.freeze([
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.B_POSITIVE]: Object.freeze([
    BloodGroup.B_POSITIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.AB_NEGATIVE]: Object.freeze([
    BloodGroup.AB_NEGATIVE,
    BloodGroup.AB_POSITIVE,
  ]),
  [BloodGroup.AB_POSITIVE]: Object.freeze([
    BloodGroup.AB_POSITIVE,
  ]),
});

/**
 * List of all canonical 8 ABO/Rh blood groups in standard clinical order.
 */
export const ALL_BLOOD_GROUPS: readonly BloodGroup[] = Object.freeze([
  BloodGroup.O_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.A_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.AB_POSITIVE,
]);

/**
 * Medical disclaimer on RBC transfusion scope and laboratory crossmatching requirements.
 */
export const MEDICAL_DISCLAIMER =
  'These rules apply to red blood cell (RBC) transfusion compatibility only. They must not be presented as universal rules for plasma, platelets, or whole blood. Final donor selection and transfusion compatibility must be confirmed by qualified medical professionals and the blood bank, including antibody screening and laboratory crossmatching.';

export interface BloodCompatibilityResult {
  compatible: boolean;
  donorBloodGroup: BloodGroup;
  recipientBloodGroup: BloodGroup;
  component: 'RED_BLOOD_CELLS';
  reason: string;
  requiresMedicalCrossmatch: true;
}

/**
 * Returns every recipient blood group that can receive RBCs from the specified donor group.
 * Guarantees immutability through defensive array copying.
 */
export const getCompatibleRecipientBloodGroups = (
  donorBloodGroup: BloodGroup
): BloodGroup[] => {
  const recipients = RBC_COMPATIBILITY_MATRIX[donorBloodGroup];
  if (!recipients) return [];
  return [...recipients];
};

/**
 * Returns true if the donor can donate RBCs to the recipient according to ABO/Rh rules.
 */
export const isBloodCompatible = (
  donorBloodGroup: BloodGroup,
  recipientBloodGroup: BloodGroup
): boolean => {
  const recipients = RBC_COMPATIBILITY_MATRIX[donorBloodGroup];
  return Boolean(recipients && recipients.includes(recipientBloodGroup));
};

/**
 * Backwards compatibility alias for isBloodCompatible.
 */
export const isBloodGroupCompatible = isBloodCompatible;

/**
 * Returns all donor blood groups that can donate RBCs to the specified recipient.
 * Dynamically derived from the single source of truth (RBC_COMPATIBILITY_MATRIX)
 * rather than maintaining a manually duplicated second matrix.
 */
export const getCompatibleDonorBloodGroups = (
  recipientBloodGroup: BloodGroup
): BloodGroup[] => {
  return ALL_BLOOD_GROUPS.filter((donorGroup) =>
    RBC_COMPATIBILITY_MATRIX[donorGroup].includes(recipientBloodGroup)
  );
};

/**
 * Returns a detailed structured compatibility result for donor-recipient pair.
 */
export const getBloodCompatibilityResult = (
  donorBloodGroup: BloodGroup,
  recipientBloodGroup: BloodGroup
): BloodCompatibilityResult => {
  const compatible = isBloodCompatible(donorBloodGroup, recipientBloodGroup);

  const reason = compatible
    ? 'The donor blood group is compatible with the recipient for red blood cell donation.'
    : 'ABO/Rh incompatibility for red blood cell donation.';

  return {
    compatible,
    donorBloodGroup,
    recipientBloodGroup,
    component: 'RED_BLOOD_CELLS',
    reason,
    requiresMedicalCrossmatch: true,
  };
};
