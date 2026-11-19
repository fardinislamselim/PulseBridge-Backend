import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import {
  BloodGroup,
  UserStatus,
  AssignmentStatus,
} from '../../generated/prisma/enums.js';
import {
  getCompatibleRecipientBloodGroups,
  getCompatibleDonorBloodGroups,
  getBloodCompatibilityResult,
} from './utils/blood-compatibility.js';
import type {
  CompatibilityApiResponse,
  FindDonorsQueryDTO,
  MatchingDonorResult,
} from './matching.interface.js';
import { calculateDistanceKm } from '../donors/donor.utils.js';

/**
 * Evaluates blood compatibility based on provided query parameters.
 * Supports:
 * 1. Both donor and recipient: returns pairwise compatibility
 * 2. Donor only: returns compatible recipients
 * 3. Recipient only: returns compatible donors
 */
export const evaluateCompatibility = (
  donorBloodGroup?: BloodGroup,
  recipientBloodGroup?: BloodGroup
): CompatibilityApiResponse => {
  if (donorBloodGroup && recipientBloodGroup) {
    return getBloodCompatibilityResult(donorBloodGroup, recipientBloodGroup);
  }

  if (donorBloodGroup) {
    return {
      donorBloodGroup,
      compatibleRecipientBloodGroups: getCompatibleRecipientBloodGroups(donorBloodGroup),
      component: 'RED_BLOOD_CELLS',
    };
  }

  if (recipientBloodGroup) {
    return {
      recipientBloodGroup,
      compatibleDonorBloodGroups: getCompatibleDonorBloodGroups(recipientBloodGroup),
      component: 'RED_BLOOD_CELLS',
    };
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    'At least one of donorBloodGroup or recipientBloodGroup is required'
  );
};

/**
 * Discovers available, eligible, and compatible donors for a blood donation request or query parameters.
 * Employs ABO/Rh compatibility engine as the foundation, filtering out ineligible or unavailable donors.
 */
export const findEligibleDonors = async (
  query: FindDonorsQueryDTO
): Promise<MatchingDonorResult[]> => {
  let targetBloodGroup: BloodGroup | undefined = query.bloodGroup;
  let targetLat: number | undefined = query.latitude;
  let targetLng: number | undefined = query.longitude;
  let targetCity: string | undefined = query.city;
  let targetDistrict: string | undefined = query.district;

  if (query.requestId) {
    const bloodRequest = await prisma.bloodRequest.findUnique({
      where: { id: query.requestId },
    });

    if (!bloodRequest || bloodRequest.deletedAt) {
      throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
    }

    targetBloodGroup = targetBloodGroup || bloodRequest.bloodGroup;
    targetLat = targetLat ?? (bloodRequest.latitude ?? undefined);
    targetLng = targetLng ?? (bloodRequest.longitude ?? undefined);
    targetCity = targetCity || bloodRequest.city;
    targetDistrict = targetDistrict || bloodRequest.district;
  }

  if (!targetBloodGroup) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Target recipient blood group must be specified either directly or via requestId'
    );
  }

  // 1. Retrieve compatible donor blood groups from central engine
  const compatibleDonorGroups = getCompatibleDonorBloodGroups(targetBloodGroup);

  const now = new Date();

  // 2. Query eligible donors matching compatibility, account status, availability, and cooldown
  const donors = await prisma.donorProfile.findMany({
    where: {
      bloodGroup: { in: compatibleDonorGroups },
      isAvailable: true,
      hasMedicalRestriction: false,
      user: {
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      OR: [{ eligibleAt: null }, { eligibleAt: { lte: now } }],
      assignments: {
        none: {
          status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
        },
      },
      ...(targetDistrict ? { district: { equals: targetDistrict, mode: 'insensitive' } } : {}),
      ...(targetCity ? { city: { equals: targetCity, mode: 'insensitive' } } : {}),
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  // 3. Map to MatchingDonorResult with proximity ranking
  const results: MatchingDonorResult[] = donors.map((donor) => {
    let distanceKm: number | undefined;
    if (
      targetLat != null &&
      targetLng != null &&
      donor.latitude != null &&
      donor.longitude != null
    ) {
      distanceKm = calculateDistanceKm(targetLat, targetLng, donor.latitude, donor.longitude);
    }

    return {
      donorId: donor.id,
      donorName: donor.user.name,
      donorBloodGroup: donor.bloodGroup!,
      requestedBloodGroup: targetBloodGroup!,
      distanceKm,
      district: donor.district,
      city: donor.city,
      area: donor.area,
      isAvailable: donor.isAvailable,
      isVerified: donor.isVerified,
      bloodCompatibility: {
        compatible: true,
        component: 'RED_BLOOD_CELLS',
        requiresMedicalCrossmatch: true,
      },
    };
  });

  // Sort by proximity if coordinates are available
  if (targetLat != null && targetLng != null) {
    results.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
  }

  const limit = query.limit || 10;
  return results.slice(0, limit);
};
