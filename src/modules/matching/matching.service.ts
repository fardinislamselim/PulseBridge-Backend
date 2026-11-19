import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import {
  BloodGroup,
  UserStatus,
  UserRole,
  AssignmentStatus,
  RequestStatus,
} from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/index.js';
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
import { calculateDistanceKm, isDonorEligibleSync } from '../donors/donor.utils.js';

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
  query: FindDonorsQueryDTO,
  viewer?: AuthUser
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

    // Only approved/active requests are eligible for donor matching
    const INELIGIBLE_STATUSES: RequestStatus[] = [
      RequestStatus.PENDING,
      RequestStatus.REJECTED,
      RequestStatus.CANCELLED,
      RequestStatus.EXPIRED,
      RequestStatus.FULFILLED,
    ];
    if (INELIGIBLE_STATUSES.includes(bloodRequest.status)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Blood request with status ${bloodRequest.status} is not eligible for donor matching`
      );
    }

    // Requester owns request, or ADMIN/SUPER_ADMIN
    if (
      viewer &&
      viewer.role !== UserRole.ADMIN &&
      viewer.role !== UserRole.SUPER_ADMIN &&
      bloodRequest.requesterId !== viewer.id
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not authorized to view matching donors for this blood request'
      );
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
          status: true,
          emailVerified: true,
        },
      },
      assignments: {
        where: {
          status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
        },
        select: { id: true },
      },
    },
  });

  // 3. Map to candidates with calculated distance and eligibility verification
  const results = donors.map((donor) => {
    let distanceKm: number | undefined;
    if (
      targetLat != null &&
      targetLng != null &&
      donor.latitude != null &&
      donor.longitude != null
    ) {
      distanceKm = calculateDistanceKm(targetLat, targetLng, donor.latitude, donor.longitude);
    }

    const isEligible = isDonorEligibleSync(donor);

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
      isEligible,
      bloodCompatibility: {
        compatible: true,
        component: 'RED_BLOOD_CELLS' as const,
        requiresMedicalCrossmatch: true as const,
      },
    };
  });

  // 4. Deterministic multi-tier ranking priority:
  // 1) Medically eligible donors only
  // 2) Exact blood group match first, then cross-compatible
  // 3) Available donors
  // 4) Nearest distance (or location fallback if distance unavailable)
  // 5) Verified profile
  // 6) Deterministic tie-breaker (donorId)
  results.sort((a, b) => {
    // 1. Eligibility
    if (a.isEligible !== b.isEligible) {
      return a.isEligible ? -1 : 1;
    }

    // 2. Blood compatibility: Exact match before cross-compatible
    const aExact = a.donorBloodGroup === targetBloodGroup ? 1 : 0;
    const bExact = b.donorBloodGroup === targetBloodGroup ? 1 : 0;
    if (aExact !== bExact) {
      return bExact - aExact;
    }

    // 3. Availability
    if (a.isAvailable !== b.isAvailable) {
      return a.isAvailable ? -1 : 1;
    }

    // 4. Proximity / Location fallback
    const aDist = a.distanceKm ?? 999999;
    const bDist = b.distanceKm ?? 999999;
    if (aDist !== bDist) {
      return aDist - bDist;
    }

    // Location fallback: district match if distance not available
    const aSameDistrict =
      a.district && targetDistrict && a.district.toLowerCase() === targetDistrict.toLowerCase()
        ? 1
        : 0;
    const bSameDistrict =
      b.district && targetDistrict && b.district.toLowerCase() === targetDistrict.toLowerCase()
        ? 1
        : 0;
    if (aSameDistrict !== bSameDistrict) {
      return bSameDistrict - aSameDistrict;
    }

    // 5. Verified donors
    if (a.isVerified !== b.isVerified) {
      return a.isVerified ? -1 : 1;
    }

    // 6. Deterministic tie-breaker
    return a.donorId.localeCompare(b.donorId);
  });

  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const page = Math.max(1, Number(query.page) || 1);
  const paginatedResults = results.slice((page - 1) * limit, page * limit);

  // Map to clean MatchingDonorResult without internal isEligible helper flag
  return paginatedResults.map(({ isEligible, ...res }) => res);
};
