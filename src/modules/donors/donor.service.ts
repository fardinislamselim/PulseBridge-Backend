import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import {
  UserRole,
  UserStatus,
  BloodGroup,
  AssignmentStatus,
  DonationStatus,
  RequestStatus,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../types/index.js';
import {
  DONATION_COOLDOWN_DAYS,
  ELIGIBILITY_REASONS,
} from './donor.constant.js';
import type {
  DonorProfileResponse,
  PublicDonorSummary,
  UpdateDonorProfileDTO,
  GetDonorsQueryDTO,
  NearbyDonorsQueryDTO,
  DonorEligibilityResult,
  AdminRestrictDonorDTO,
  MatchingOptions,
  EligibleDonorMatch,
} from './donor.interface.js';
import {
  calculateDistanceKm,
  calculateCooldown,
  isBloodGroupCompatible,
  getCompatibleDonorBloodGroups,
  toPublicDonorSummary,
  toFullDonorProfile,
} from './donor.utils.js';
import { updateRequestFulfillment } from '../requests/request.service.js';

const donorIncludeRelations = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      emailVerified: true,
    },
  },
  _count: {
    select: {
      donations: true,
    },
  },
} as const;

/**
 * Retrieves the donor profile belonging to the authenticated user.
 */
export const getMyDonorProfile = async (
  userId: string,
): Promise<DonorProfileResponse> => {
  let donor = await prisma.donorProfile.findUnique({
    where: { userId },
    include: donorIncludeRelations,
  });

  if (!donor) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Upsert a blank donor profile if missing for a registered donor
    donor = await prisma.donorProfile.create({
      data: {
        userId,
        isAvailable: true,
      },
      include: donorIncludeRelations,
    });
  }

  return toFullDonorProfile(donor);
};

/**
 * Updates the authenticated user's donor profile.
 * Prevents direct manual alteration of lastDonationDate, eligibleAt, or isVerified.
 */
export const updateMyDonorProfile = async (
  userId: string,
  data: UpdateDonorProfileDTO,
): Promise<DonorProfileResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { donorProfile: true },
  });

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Update user name and phone if provided
  if (data.name !== undefined || data.phone !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
    });
  }

  // Build donor profile update data (excluding lastDonationDate and eligibleAt)
  const profileData = {
    ...(data.bloodGroup !== undefined ? { bloodGroup: data.bloodGroup } : {}),
    ...(data.dateOfBirth !== undefined ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
    ...(data.gender !== undefined ? { gender: data.gender } : {}),
    ...(data.district !== undefined ? { district: data.district } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.area !== undefined ? { area: data.area } : {}),
    ...(data.address !== undefined ? { address: data.address } : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
  };

  const updatedDonor = await prisma.donorProfile.upsert({
    where: { userId },
    update: profileData,
    create: {
      ...profileData,
      userId,
      isAvailable: true,
    },
    include: donorIncludeRelations,
  });

  return toFullDonorProfile(updatedDonor);
};

/**
 * Toggles donor availability status.
 */
export const updateMyDonorAvailability = async (
  userId: string,
  isAvailable: boolean,
): Promise<DonorProfileResponse> => {
  const donor = await prisma.donorProfile.upsert({
    where: { userId },
    update: { isAvailable },
    create: {
      userId,
      isAvailable,
    },
    include: donorIncludeRelations,
  });

  return toFullDonorProfile(donor);
};

/**
 * Centralized, production-grade donor eligibility verification.
 * Evaluates all health, cooldown, profile completion, and status rules.
 */
export const checkDonorEligibility = async (
  donorIdOrUserId: string,
): Promise<DonorEligibilityResult> => {
  const donor = await prisma.donorProfile.findFirst({
    where: {
      OR: [{ id: donorIdOrUserId }, { userId: donorIdOrUserId }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          status: true,
          emailVerified: true,
          phone: true,
        },
      },
      assignments: {
        where: {
          status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
        },
        select: { id: true, status: true },
      },
    },
  });

  if (!donor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  // 1. Account status check
  if (donor.user.status === UserStatus.BLOCKED || donor.user.status === UserStatus.DELETED) {
    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.ACCOUNT_BLOCKED,
      message: 'Donor account is currently suspended, blocked, or inactive',
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 2. Email verification check
  if (!donor.user.emailVerified) {
    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.ACCOUNT_NOT_VERIFIED,
      message: 'Donor email address is not verified',
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 3. Medical restrictions check
  if (donor.hasMedicalRestriction) {
    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.MEDICAL_RESTRICTION,
      message:
        donor.medicalRestrictionReason ||
        'Donor is currently under a temporary or permanent medical restriction',
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 4. Blood group check
  if (!donor.bloodGroup) {
    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.BLOOD_GROUP_MISSING,
      message: 'Blood group is not set in donor profile',
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 5. Incomplete profile check (requires location)
  if (!donor.district || !donor.city) {
    const missing: string[] = [];
    if (!donor.district) missing.push('district');
    if (!donor.city) missing.push('city');

    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.PROFILE_INCOMPLETE,
      message: 'Donor profile is incomplete. District and city are required.',
      details: { missingFields: missing },
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 6. Availability check
  if (!donor.isAvailable) {
    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.DONOR_UNAVAILABLE,
      message: 'Donor is currently marked as unavailable',
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 7. Active assignment check
  if (donor.assignments.length > 0) {
    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.ACTIVE_ASSIGNMENT_EXISTS,
      message: 'Donor already has an active blood donation assignment in progress',
      details: { activeAssignmentId: donor.assignments[0].id },
      lastDonationDate: donor.lastDonationDate,
      eligibleAt: donor.eligibleAt,
    };
  }

  // 8. 90-day cooldown check
  const cooldown = calculateCooldown(donor.lastDonationDate, DONATION_COOLDOWN_DAYS);
  if (cooldown.isCooldownActive) {
    // Keep eligibleAt synchronized in DB if needed
    if (
      cooldown.eligibleAt &&
      (!donor.eligibleAt || donor.eligibleAt.getTime() !== cooldown.eligibleAt.getTime())
    ) {
      await prisma.donorProfile.update({
        where: { id: donor.id },
        data: { eligibleAt: cooldown.eligibleAt },
      });
    }

    return {
      isEligible: false,
      canDonate: false,
      reason: ELIGIBILITY_REASONS.DONATION_COOLDOWN_ACTIVE,
      message: `Donor is in donation cooldown. Eligible in ${cooldown.daysRemaining} day(s).`,
      daysRemaining: cooldown.daysRemaining,
      eligibleAt: cooldown.eligibleAt,
      lastDonationDate: donor.lastDonationDate,
      details: { cooldownDays: DONATION_COOLDOWN_DAYS },
    };
  }

  return {
    isEligible: true,
    canDonate: true,
    message: 'Donor is eligible to donate blood',
    daysRemaining: 0,
    eligibleAt: cooldown.eligibleAt,
    lastDonationDate: donor.lastDonationDate,
  };
};

/**
 * Retrieves a donor profile by its ID with role-based privacy sanitization.
 */
export const getDonorById = async (
  donorId: string,
  viewer?: AuthUser,
): Promise<DonorProfileResponse | PublicDonorSummary> => {
  const donor = await prisma.donorProfile.findUnique({
    where: { id: donorId },
    include: donorIncludeRelations,
  });

  if (!donor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  const isPrivileged =
    viewer &&
    (viewer.role === UserRole.ADMIN ||
      viewer.role === UserRole.SUPER_ADMIN ||
      viewer.id === donor.userId);

  if (isPrivileged) {
    return toFullDonorProfile(donor);
  }

  return toPublicDonorSummary(donor);
};

/**
 * Searches and paginates donors with privacy sanitization.
 */
export const getDonors = async (
  query: GetDonorsQueryDTO,
  viewer?: AuthUser,
): Promise<{
  data: (DonorProfileResponse | PublicDonorSummary)[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.DonorProfileWhereInput = {};

  if (query.bloodGroup) {
    where.bloodGroup = query.bloodGroup;
  }
  if (query.district) {
    where.district = { contains: query.district, mode: 'insensitive' };
  }
  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }
  if (query.area) {
    where.area = { contains: query.area, mode: 'insensitive' };
  }
  if (query.isAvailable !== undefined) {
    where.isAvailable = query.isAvailable;
  }

  // Eligibility filter
  if (query.eligible === true) {
    const now = new Date();
    where.isAvailable = true;
    where.hasMedicalRestriction = false;
    where.bloodGroup = { not: null };
    where.district = { not: '' };
    where.city = { not: '' };
    where.user = {
      status: UserStatus.ACTIVE,
      emailVerified: true,
    };
    where.OR = [{ eligibleAt: null }, { eligibleAt: { lte: now } }];
  }

  // Search filter
  if (query.search) {
    where.OR = [
      { user: { name: { contains: query.search, mode: 'insensitive' } } },
      { district: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
      { area: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const allowedSortFields = [
    'createdAt',
    'city',
    'district',
    'area',
    'lastDonationDate',
    'eligibleAt',
  ];
  const sortBy = allowedSortFields.includes(query.sortBy || '')
    ? (query.sortBy as string)
    : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, donors] = await Promise.all([
    prisma.donorProfile.count({ where }),
    prisma.donorProfile.findMany({
      where,
      include: donorIncludeRelations,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  const isPrivileged =
    viewer &&
    (viewer.role === UserRole.ADMIN || viewer.role === UserRole.SUPER_ADMIN);

  const data = donors.map((d) =>
    isPrivileged ? toFullDonorProfile(d) : toPublicDonorSummary(d),
  );

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Searches for nearby donors within a specified kilometer radius using Haversine calculation.
 */
export const getNearbyDonors = async (
  query: NearbyDonorsQueryDTO,
  viewer?: AuthUser,
): Promise<(DonorProfileResponse | PublicDonorSummary)[]> => {
  const radius = Math.min(500, Math.max(0.1, Number(query.radius) || 10));
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  const where: Prisma.DonorProfileWhereInput = {
    latitude: { not: null },
    longitude: { not: null },
  };

  if (query.bloodGroup) {
    where.bloodGroup = query.bloodGroup;
  }
  if (query.isAvailable !== undefined) {
    where.isAvailable = query.isAvailable;
  }
  if (query.eligible === true) {
    const now = new Date();
    where.isAvailable = true;
    where.hasMedicalRestriction = false;
    where.bloodGroup = { not: null };
    where.user = {
      status: UserStatus.ACTIVE,
      emailVerified: true,
    };
    where.OR = [{ eligibleAt: null }, { eligibleAt: { lte: now } }];
  }

  const candidates = await prisma.donorProfile.findMany({
    where,
    include: donorIncludeRelations,
  });

  const isPrivileged =
    viewer &&
    (viewer.role === UserRole.ADMIN || viewer.role === UserRole.SUPER_ADMIN);

  const matched = candidates
    .map((donor) => {
      const distanceKm = calculateDistanceKm(
        query.latitude,
        query.longitude,
        donor.latitude!,
        donor.longitude!,
      );
      return {
        donor,
        distanceKm,
      };
    })
    .filter((item) => item.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((item) =>
      isPrivileged
        ? { ...toFullDonorProfile(item.donor), distanceKm: item.distanceKm }
        : toPublicDonorSummary(item.donor, item.distanceKm),
    );

  return matched;
};

/**
 * Administrative action: Verifies or unverifies a donor profile.
 */
export const adminVerifyDonor = async (
  donorId: string,
  isVerified: boolean,
  _actor?: AuthUser,
): Promise<DonorProfileResponse> => {
  const donor = await prisma.donorProfile.findUnique({
    where: { id: donorId },
  });

  if (!donor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  const updatedDonor = await prisma.donorProfile.update({
    where: { id: donorId },
    data: { isVerified },
    include: donorIncludeRelations,
  });

  return toFullDonorProfile(updatedDonor);
};

/**
 * Administrative action: Sets or removes medical restrictions on a donor.
 */
export const adminRestrictDonor = async (
  donorId: string,
  data: AdminRestrictDonorDTO,
  _actor?: AuthUser,
): Promise<DonorProfileResponse> => {
  const donor = await prisma.donorProfile.findUnique({
    where: { id: donorId },
  });

  if (!donor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  const updatedDonor = await prisma.donorProfile.update({
    where: { id: donorId },
    data: {
      hasMedicalRestriction: data.hasMedicalRestriction,
      medicalRestrictionReason: data.hasMedicalRestriction
        ? data.medicalRestrictionReason || 'Temporarily deferred'
        : null,
    },
    include: donorIncludeRelations,
  });

  return toFullDonorProfile(updatedDonor);
};

/**
 * Atomically marks a donation as completed, recording donation timestamp and setting 90-day cooldown.
 */
export const completeDonation = async (
  donationId: string,
  _actor?: AuthUser,
) => {
  return await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.findUnique({
      where: { id: donationId },
      include: { donorProfile: true, assignment: true },
    });

    if (!donation) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donation record not found');
    }

    if (donation.status === DonationStatus.COMPLETED) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Donation is already completed');
    }

    const now = new Date();
    const eligibleAt = new Date(
      now.getTime() + DONATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    );

    const updatedDonation = await tx.donation.update({
      where: { id: donationId },
      data: {
        status: DonationStatus.COMPLETED,
        donatedAt: now,
      },
    });

    await tx.donorProfile.update({
      where: { id: donation.donorProfileId },
      data: {
        lastDonationDate: now,
        eligibleAt,
      },
    });

    if (donation.assignmentId) {
      await tx.donorAssignment.update({
        where: { id: donation.assignmentId },
        data: {
          status: AssignmentStatus.COMPLETED,
        },
      });
    }

    // Update blood request fulfillment status transactionally
    await updateRequestFulfillment(donation.bloodRequestId, tx);

    return updatedDonation;
  });
};

/**
 * Finds eligible, compatible donors for a blood request ranked by proximity.
 */
export const findMatchingDonors = async (
  requestId: string,
  options?: MatchingOptions,
): Promise<EligibleDonorMatch[]> => {
  const bloodRequest = await prisma.bloodRequest.findUnique({
    where: { id: requestId },
  });

  if (!bloodRequest) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  const recipientBloodGroup = options?.bloodGroup || bloodRequest.bloodGroup;
  const compatibleDonorGroups = getCompatibleDonorBloodGroups(recipientBloodGroup);

  const now = new Date();
  const candidateDonors = await prisma.donorProfile.findMany({
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
    },
    include: donorIncludeRelations,
  });

  const refLat = options?.latitude ?? bloodRequest.latitude;
  const refLon = options?.longitude ?? bloodRequest.longitude;

  const matches: EligibleDonorMatch[] = candidateDonors.map((donor) => {
    let distanceKm: number | undefined;
    if (refLat != null && refLon != null && donor.latitude != null && donor.longitude != null) {
      distanceKm = calculateDistanceKm(refLat, refLon, donor.latitude, donor.longitude);
    }

    return {
      donor: toPublicDonorSummary(donor, distanceKm),
      distanceKm,
      compatibility: {
        donorBloodGroup: donor.bloodGroup!,
        recipientBloodGroup,
        isCompatible: true,
      },
    };
  });

  if (refLat != null && refLon != null) {
    matches.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
  }

  const limit = options?.limit || 10;
  return matches.slice(0, limit);
};

/**
 * Race-condition-safe assignment creation within an interactive database transaction.
 */
export const createDonorAssignment = async (
  requestId: string,
  donorProfileId: string,
  notes?: string,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify blood request
    const bloodRequest = await tx.bloodRequest.findUnique({
      where: { id: requestId },
    });

    if (!bloodRequest) {
      throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
    }

    if (
      bloodRequest.status === RequestStatus.FULFILLED ||
      bloodRequest.status === RequestStatus.CANCELLED
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot assign donors to a fulfilled or cancelled blood request',
      );
    }

    // 2. Verify donor and check eligibility
    const donor = await tx.donorProfile.findUnique({
      where: { id: donorProfileId },
      include: {
        user: true,
        assignments: {
          where: {
            status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
          },
        },
      },
    });

    if (!donor) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
    }

    if (!donor.isAvailable) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Donor is currently marked as unavailable');
    }

    if (donor.hasMedicalRestriction) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Donor has medical restriction: ${donor.medicalRestrictionReason || 'Restricted'}`,
      );
    }

    if (donor.user.status !== UserStatus.ACTIVE || !donor.user.emailVerified) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Donor user account is not active or verified',
      );
    }

    if (
      donor.bloodGroup &&
      !isBloodGroupCompatible(donor.bloodGroup, bloodRequest.bloodGroup)
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Donor blood group ${donor.bloodGroup} is not compatible with request blood group ${bloodRequest.bloodGroup}`,
      );
    }

    const cooldown = calculateCooldown(donor.lastDonationDate, DONATION_COOLDOWN_DAYS);
    if (cooldown.isCooldownActive) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Donor is in donation cooldown. Eligible in ${cooldown.daysRemaining} day(s)`,
      );
    }

    if (donor.assignments.length > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Donor already has an active donation assignment in progress',
      );
    }

    const existingAssignment = await tx.donorAssignment.findUnique({
      where: {
        requestId_donorProfileId: {
          requestId,
          donorProfileId,
        },
      },
    });

    if (existingAssignment) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Assignment for this donor and request already exists',
      );
    }

    const assignment = await tx.donorAssignment.create({
      data: {
        requestId,
        donorProfileId,
        status: AssignmentStatus.PENDING,
        notes: notes || null,
      },
      include: {
        donorProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        request: true,
      },
    });

    if (bloodRequest.status === RequestStatus.PENDING) {
      await tx.bloodRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.IN_PROGRESS },
      });
    }

    return assignment;
  });
};
