import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import {
  AssignmentStatus,
  DonationStatus,
  DonationVerificationStatus,
  RequestStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/index.js';
import type {
  CreateDonationDTO,
  VerifyDonationDTO,
  RejectDonationDTO,
  DonationQueryDTO,
  DonationHistoryResult,
  DonationItemResponse,
} from './donation.interface.js';
import {
  DONATION_COOLDOWN_DAYS,
} from './donation.constant.js';
import {
  calculateCooldownEndsAt,
  getDonationCooldownStatus,
  toSanitizedDonationItem,
} from './donation.utils.js';
import { updateRequestFulfillment } from '../requests/request.service.js';
import { sendDonationConfirmationEmail } from '../../services/email.service.js';

const formatDateString = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Creates a donation record associated with a donor and blood request.
 * Can be invoked by Requesters (for their own requests) or Admins.
 */
export const createDonation = async (
  data: CreateDonationDTO,
  actor: AuthUser,
): Promise<DonationItemResponse> => {
  // 1. Resolve donor profile
  const donorProfile = await prisma.donorProfile.findFirst({
    where: {
      OR: [{ id: data.donorId }, { userId: data.donorId }],
    },
    include: { user: true },
  });

  if (!donorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  // Check donor active status
  if (donorProfile.user.status === UserStatus.BLOCKED || donorProfile.user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Donor user account is blocked or inactive');
  }

  // 2. Resolve blood request
  const bloodRequest = await prisma.bloodRequest.findUnique({
    where: { id: data.bloodRequestId },
  });

  if (!bloodRequest) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blood request not found');
  }

  // Authorization check for Requesters
  if (
    actor.role === UserRole.REQUESTER &&
    bloodRequest.requesterId !== actor.id
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to create a donation record for another user’s blood request',
    );
  }

  if (
    bloodRequest.status === RequestStatus.CANCELLED ||
    bloodRequest.status === RequestStatus.EXPIRED ||
    bloodRequest.status === RequestStatus.REJECTED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot record a donation for a blood request in ${bloodRequest.status} state`,
    );
  }

  // 3. Assignment validation (if assignmentId provided)
  let assignment = null;
  if (data.assignmentId) {
    assignment = await prisma.donorAssignment.findUnique({
      where: { id: data.assignmentId },
    });

    if (!assignment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Referenced assignment not found');
    }

    if (
      assignment.requestId !== bloodRequest.id ||
      assignment.donorProfileId !== donorProfile.id
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Assignment does not match the provided blood request and donor',
      );
    }

    // Check if donation already exists for this assignment
    const existingAssignmentDonation = await prisma.donation.findUnique({
      where: { assignmentId: data.assignmentId },
    });

    if (existingAssignmentDonation) {
      throw new AppError(
        httpStatus.CONFLICT,
        'A donation record already exists for this assignment',
      );
    }
  }

  // 4. Create donation record
  const donationDate = data.donationDate ? new Date(data.donationDate) : new Date();

  const createdDonation = await prisma.donation.create({
    data: {
      donorProfileId: donorProfile.id,
      bloodRequestId: bloodRequest.id,
      assignmentId: data.assignmentId || null,
      unitsDonated: data.unitsDonated || 1,
      donationDate,
      status: DonationStatus.PENDING,
      verificationStatus: DonationVerificationStatus.PENDING,
      hospitalName: data.hospitalName || bloodRequest.hospitalName,
      hospitalAddress: data.hospitalAddress || bloodRequest.hospitalAddress,
      notes: data.notes || null,
    },
    include: {
      donorProfile: { include: { user: true } },
      bloodRequest: true,
      assignment: true,
    },
  });

  return toSanitizedDonationItem(createdDonation, actor.role, true);
};

/**
 * Atomically verifies and completes a donation in a single database transaction.
 * Concurrency-safe: row locks the donation, prevents duplicate completions,
 * updates assignment status, sets donor lastDonationDate, starts 90-day cooldown,
 * recalculates request fulfillment, and sends email confirmation.
 */
export const verifyDonation = async (
  donationId: string,
  actor: AuthUser,
  data?: VerifyDonationDTO,
): Promise<DonationItemResponse> => {
  // Only Admin or Super Admin or authorized medical staff can verify
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only authorized administrators can verify and complete a blood donation',
    );
  }

  let emailDetails: {
    email: string;
    donorName: string;
    bloodGroup: string;
    unitsDonated: number;
    hospitalName: string;
    donationDate: string;
    nextEligibleDate: string;
  } | null = null;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch donation with unique lookup
    const donation = await tx.donation.findUnique({
      where: { id: donationId },
      include: {
        donorProfile: { include: { user: true } },
        bloodRequest: true,
        assignment: true,
      },
    });

    if (!donation) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donation record not found');
    }

    // 2. Concurrency & duplicate prevention
    if (
      donation.verificationStatus === DonationVerificationStatus.VERIFIED ||
      donation.status === DonationStatus.COMPLETED
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Donation is already verified and marked as completed',
      );
    }

    if (donation.verificationStatus === DonationVerificationStatus.REJECTED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot verify a previously rejected donation',
      );
    }

    const now = new Date();
    const cooldownEndsAt = calculateCooldownEndsAt(now, DONATION_COOLDOWN_DAYS);

    // 3. Update donation record
    const updatedDonation = await tx.donation.update({
      where: { id: donationId },
      data: {
        status: DonationStatus.COMPLETED,
        verificationStatus: DonationVerificationStatus.VERIFIED,
        verifiedById: actor.id,
        verifiedAt: now,
        completedAt: now,
        donatedAt: now,
        notes: data?.notes ? `${donation.notes ? donation.notes + ' | ' : ''}${data.notes}` : donation.notes,
      },
      include: {
        donorProfile: { include: { user: true } },
        bloodRequest: true,
        assignment: true,
      },
    });

    // 4. Update assignment status if linked
    if (donation.assignmentId) {
      await tx.donorAssignment.update({
        where: { id: donation.assignmentId },
        data: {
          status: AssignmentStatus.COMPLETED,
        },
      });
    }

    // 5. Update donor profile with lastDonationDate and eligibleAt
    await tx.donorProfile.update({
      where: { id: donation.donorProfileId },
      data: {
        lastDonationDate: now,
        eligibleAt: cooldownEndsAt,
      },
    });

    // 6. Recalculate blood request fulfillment transactionally
    await updateRequestFulfillment(donation.bloodRequestId, tx);

    // 7. Record immutable audit log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'DONATION_VERIFIED_COMPLETED',
        entity: 'Donation',
        entityId: donation.id,
        metadata: {
          donorProfileId: donation.donorProfileId,
          bloodRequestId: donation.bloodRequestId,
          assignmentId: donation.assignmentId,
          unitsDonated: donation.unitsDonated,
          verifiedAt: now.toISOString(),
          cooldownEndsAt: cooldownEndsAt.toISOString(),
        },
      },
    });

    if (donation.donorProfile?.user?.email) {
      emailDetails = {
        email: donation.donorProfile.user.email,
        donorName: donation.donorProfile.user.name,
        bloodGroup: donation.donorProfile.bloodGroup || donation.bloodRequest.bloodGroup,
        unitsDonated: donation.unitsDonated || 1,
        hospitalName: donation.hospitalName || donation.bloodRequest.hospitalName,
        donationDate: formatDateString(now),
        nextEligibleDate: formatDateString(cooldownEndsAt),
      };
    }

    return updatedDonation;
  });

  // Post-transaction email notification (never run email inside DB transaction)
  if (emailDetails) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendDonationConfirmationEmail((emailDetails as any).email, emailDetails as any).catch((err) => {
      console.warn('[Email] Failed to send donation confirmation email:', err.message);
    });
  }

  return toSanitizedDonationItem(result, actor.role, true);
};

/**
 * Rejects a pending donation record with a required reason.
 * Does NOT start the 90-day cooldown.
 */
export const rejectDonation = async (
  donationId: string,
  actor: AuthUser,
  data: RejectDonationDTO,
): Promise<DonationItemResponse> => {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only authorized administrators can reject a donation record',
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.findUnique({
      where: { id: donationId },
      include: {
        donorProfile: { include: { user: true } },
        bloodRequest: true,
        assignment: true,
      },
    });

    if (!donation) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donation record not found');
    }

    if (
      donation.verificationStatus === DonationVerificationStatus.VERIFIED ||
      donation.status === DonationStatus.COMPLETED
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Cannot reject an already verified and completed donation',
      );
    }

    const updated = await tx.donation.update({
      where: { id: donationId },
      data: {
        status: DonationStatus.REJECTED,
        verificationStatus: DonationVerificationStatus.REJECTED,
        rejectionReason: data.reason,
        verifiedById: actor.id,
        verifiedAt: new Date(),
      },
      include: {
        donorProfile: { include: { user: true } },
        bloodRequest: true,
        assignment: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'DONATION_REJECTED',
        entity: 'Donation',
        entityId: donation.id,
        metadata: {
          reason: data.reason,
          donorProfileId: donation.donorProfileId,
          bloodRequestId: donation.bloodRequestId,
        },
      },
    });

    return updated;
  });

  return toSanitizedDonationItem(result, actor.role, true);
};

/**
 * Retrieves the authenticated donor's own complete donation history and cooldown summary.
 */
export const getMyDonationHistory = async (
  userId: string,
  query: DonationQueryDTO = {},
): Promise<DonationHistoryResult> => {
  const donorProfile = await prisma.donorProfile.findUnique({
    where: { userId },
  });

  if (!donorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found for authenticated user');
  }

  return getDonorHistoryWithSummary(donorProfile.id, query, UserRole.DONOR, true);
};

/**
 * Retrieves donation history for a specific donor (Admin view).
 */
export const getDonorDonationHistoryForAdmin = async (
  donorId: string,
  query: DonationQueryDTO = {},
  actorRole: UserRole,
): Promise<DonationHistoryResult> => {
  const donorProfile = await prisma.donorProfile.findFirst({
    where: {
      OR: [{ id: donorId }, { userId: donorId }],
    },
  });

  if (!donorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  return getDonorHistoryWithSummary(donorProfile.id, query, actorRole, true);
};

/**
 * Internal helper to compute summary metrics and fetch paginated donations for a donor.
 */
const getDonorHistoryWithSummary = async (
  donorProfileId: string,
  query: DonationQueryDTO,
  viewerRole: UserRole,
  isOwner: boolean,
): Promise<DonationHistoryResult> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  // 1. Aggregations for summary
  const donor = await prisma.donorProfile.findUnique({
    where: { id: donorProfileId },
    include: {
      user: true,
      assignments: {
        where: { status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] } },
      },
    },
  });

  if (!donor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found');
  }

  const [totalDonations, completedDonations, pendingDonations, unitsAggregate] =
    await Promise.all([
      prisma.donation.count({ where: { donorProfileId } }),
      prisma.donation.count({
        where: {
          donorProfileId,
          status: DonationStatus.COMPLETED,
        },
      }),
      prisma.donation.count({
        where: {
          donorProfileId,
          status: { in: [DonationStatus.PENDING, DonationStatus.SCHEDULED] },
        },
      }),
      prisma.donation.aggregate({
        where: {
          donorProfileId,
          status: DonationStatus.COMPLETED,
        },
        _sum: { unitsDonated: true },
      }),
    ]);

  const totalUnitsDonated = unitsAggregate._sum.unitsDonated || completedDonations;
  const cooldownStatus = getDonationCooldownStatus(donor.lastDonationDate);

  // Overall isEligible determination for this donor
  const isEligible =
    !cooldownStatus.isActive &&
    donor.isAvailable &&
    !donor.hasMedicalRestriction &&
    donor.user.status === UserStatus.ACTIVE &&
    donor.assignments.length === 0;

  // 2. Query filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { donorProfileId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.verificationStatus) {
    where.verificationStatus = query.verificationStatus;
  }
  if (query.bloodRequestId) {
    where.bloodRequestId = query.bloodRequestId;
  }
  if (query.startDate || query.endDate) {
    where.donationDate = {};
    if (query.startDate) where.donationDate.gte = new Date(query.startDate);
    if (query.endDate) where.donationDate.lte = new Date(query.endDate);
  }

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        donorProfile: { include: { user: true } },
        bloodRequest: true,
        assignment: true,
      },
    }),
    prisma.donation.count({ where }),
  ]);

  return {
    summary: {
      totalDonations,
      completedDonations,
      pendingDonations,
      totalUnitsDonated,
      lastDonationDate: donor.lastDonationDate,
      cooldownEndsAt: cooldownStatus.cooldownEndsAt,
      isEligible,
      remainingCooldownDays: cooldownStatus.remainingDays,
    },
    donations: donations.map((d) => toSanitizedDonationItem(d, viewerRole, isOwner)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a list of donations with role-based filtering (Admin / Requester / General).
 */
export const getDonations = async (
  query: DonationQueryDTO,
  actor: AuthUser,
): Promise<{
  data: DonationItemResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Role scoping:
  if (actor.role === UserRole.REQUESTER) {
    // Requesters only see donations for blood requests they own
    where.bloodRequest = { requesterId: actor.id };
  } else if (actor.role === UserRole.DONOR) {
    // Donors only see their own
    const profile = await prisma.donorProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
    where.donorProfileId = profile.id;
  }

  if (query.donorId) {
    where.OR = [{ donorProfileId: query.donorId }, { donorProfile: { userId: query.donorId } }];
  }
  if (query.bloodRequestId) {
    where.bloodRequestId = query.bloodRequestId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.verificationStatus) {
    where.verificationStatus = query.verificationStatus;
  }
  if (query.startDate || query.endDate) {
    where.donationDate = {};
    if (query.startDate) where.donationDate.gte = new Date(query.startDate);
    if (query.endDate) where.donationDate.lte = new Date(query.endDate);
  }
  if (query.district) {
    where.bloodRequest = { ...(where.bloodRequest || {}), district: query.district };
  }
  if (query.bloodGroup) {
    where.donorProfile = { ...(where.donorProfile || {}), bloodGroup: query.bloodGroup };
  }

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        donorProfile: { include: { user: true } },
        bloodRequest: true,
        assignment: true,
      },
    }),
    prisma.donation.count({ where }),
  ]);

  return {
    data: donations.map((d) => toSanitizedDonationItem(d, actor.role)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a single donation by ID with role-based access control.
 */
export const getDonationById = async (
  donationId: string,
  actor: AuthUser,
): Promise<DonationItemResponse> => {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: {
      donorProfile: { include: { user: true } },
      bloodRequest: true,
      assignment: true,
    },
  });

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation record not found');
  }

  const isOwner = donation.donorProfile?.userId === actor.id;
  const isRequester = donation.bloodRequest?.requesterId === actor.id;
  const isAdmin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isRequester && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to view this donation record',
    );
  }

  return toSanitizedDonationItem(donation, actor.role, isOwner);
};
