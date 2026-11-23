import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { logAuditEvent } from '../../services/audit.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../types/index.js';
import type {
  UserSummary,
  UserProfileResponse,
  UpdateMyProfileDTO,
  GetUsersQueryDTO,
  PaginatedResult,
  UpdateUserStatusDTO,
  UpdateUserRoleDTO,
} from './user.interface.js';

// Standard select projection that excludes sensitive password hashes and tokens
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  donorProfile: {
    select: {
      id: true,
      bloodGroup: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      city: true,
      district: true,
      isAvailable: true,
      lastDonationDate: true,
      eligibleAt: true,
    },
  },
} as const;

/**
 * Retrieves the currently authenticated user's profile.
 */
export const getMyProfile = async (userId: string): Promise<UserSummary> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User profile not found');
  }

  return user;
};

/**
 * Updates permitted profile fields for the authenticated user (PATCH semantics).
 * Supports updating User fields (name, phone) and DonorProfile fields.
 */
export const updateMyProfile = async (
  userId: string,
  data: UpdateMyProfileDTO
): Promise<UserSummary> => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { donorProfile: true },
  });

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User profile not found');
  }

  // Check unique phone constraint if phone is being changed
  if (data.phone && data.phone.trim() !== existingUser.phone) {
    const phoneExists = await prisma.user.findFirst({
      where: {
        phone: data.phone.trim(),
        NOT: { id: userId },
      },
    });

    if (phoneExists) {
      throw new AppError(httpStatus.CONFLICT, 'Phone number is already associated with another account');
    }
  }

  const userUpdateData: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) userUpdateData.name = data.name.trim();
  if (data.phone !== undefined) userUpdateData.phone = data.phone ? data.phone.trim() : null;
  if (data.avatar !== undefined) userUpdateData.avatar = data.avatar ? data.avatar.trim() : null;

  // Handle donor profile updates if provided
  const hasDonorData =
    data.bloodGroup !== undefined ||
    data.dateOfBirth !== undefined ||
    data.gender !== undefined ||
    data.address !== undefined ||
    data.city !== undefined ||
    data.district !== undefined ||
    data.isAvailable !== undefined;

  let donorUpdateOperation: Prisma.DonorProfileUpdateOneWithoutUserNestedInput | undefined;

  if (hasDonorData) {
    const donorFields: Prisma.DonorProfileUpdateInput = {};
    if (data.bloodGroup !== undefined) donorFields.bloodGroup = data.bloodGroup;
    if (data.dateOfBirth !== undefined) donorFields.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender !== undefined) donorFields.gender = data.gender;
    if (data.address !== undefined) donorFields.address = data.address.trim();
    if (data.city !== undefined) donorFields.city = data.city.trim();
    if (data.district !== undefined) donorFields.district = data.district.trim();
    if (data.isAvailable !== undefined) donorFields.isAvailable = data.isAvailable;

    if (existingUser.donorProfile) {
      donorUpdateOperation = { update: donorFields };
    } else {
      donorUpdateOperation = {
        create: {
          bloodGroup: data.bloodGroup || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender || null,
          address: data.address?.trim() || data.district?.trim() || '',
          city: data.city?.trim() || data.district?.trim() || '',
          district: data.district?.trim() || '',
          isAvailable: data.isAvailable ?? true,
          isVerified: false,
        },
      };
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...userUpdateData,
      ...(donorUpdateOperation ? { donorProfile: donorUpdateOperation } : {}),
    },
    select: safeUserSelect,
  });

  return updatedUser;
};

/**
 * Retrieves a paginated and filterable list of users for administrators.
 */
export const getUsers = async (options: GetUsersQueryDTO): Promise<PaginatedResult<UserSummary>> => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (options.search && options.search.trim()) {
    const search = options.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (options.role) {
    where.role = options.role;
  }

  if (options.status) {
    where.status = options.status;
  }

  if (options.emailVerified !== undefined) {
    where.emailVerified = options.emailVerified;
  }

  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: safeUserSelect,
    }),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves detailed user profile and associated activity metrics by user ID.
 */
export const getUserById = async (userId: string): Promise<UserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...safeUserSelect,
      _count: {
        select: {
          bloodRequests: true,
          payments: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { _count, ...userData } = user;
  return {
    ...userData,
    requestCount: _count?.bloodRequests || 0,
  };
};

/**
 * Administrative action to activate, block, or delete an account.
 * Enforces role hierarchy rules and revokes active sessions upon block.
 */
export const updateUserStatus = async (
  targetUserId: string,
  data: UpdateUserStatusDTO,
  actor: AuthUser,
  meta: { ipAddress?: string; userAgent?: string } = {}
): Promise<UserSummary> => {
  if (actor.id === targetUserId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot modify your own account status.');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Target user not found');
  }

  // Hierarchy rule: SUPER_ADMIN cannot be blocked or modified
  if (targetUser.role === UserRole.SUPER_ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'SUPER_ADMIN accounts cannot be modified or blocked.');
  }

  // Hierarchy rule: ADMIN cannot modify another ADMIN
  if (actor.role === UserRole.ADMIN && targetUser.role === UserRole.ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'ADMIN users cannot modify another ADMIN account status.');
  }

  const previousStatus = targetUser.status;

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      status: data.status,
      deletedAt: data.status === UserStatus.DELETED ? new Date() : null,
    },
    select: safeUserSelect,
  });

  // Security enforcement: If account is BLOCKED or DELETED, revoke all active sessions immediately
  if (data.status === UserStatus.BLOCKED || data.status === UserStatus.DELETED) {
    await prisma.refreshSession.updateMany({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  // Record audit log entry
  void logAuditEvent({
    actorId: actor.id,
    action: 'USER_STATUS_UPDATE',
    entity: 'User',
    entityId: targetUserId,
    metadata: {
      previousStatus,
      newStatus: data.status,
      reason: data.reason || null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return updatedUser;
};

/**
 * Administrative action to update a user's role.
 * Enforces strict role delegation rules:
 * - Users cannot change their own role.
 * - ADMIN cannot promote anyone to ADMIN or SUPER_ADMIN.
 * - ADMIN cannot modify a SUPER_ADMIN.
 * - Only SUPER_ADMIN can grant or revoke ADMIN roles.
 */
export const updateUserRole = async (
  targetUserId: string,
  data: UpdateUserRoleDTO,
  actor: AuthUser,
  meta: { ipAddress?: string; userAgent?: string } = {}
): Promise<UserSummary> => {
  if (actor.id === targetUserId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot modify your own role.');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Target user not found');
  }

  // Hierarchy rule 1: SUPER_ADMIN role cannot be changed through this operation
  if (targetUser.role === UserRole.SUPER_ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'SUPER_ADMIN role cannot be modified.');
  }

  // Hierarchy rule 2: SUPER_ADMIN role cannot be granted through this operation
  if (data.role === UserRole.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'SUPER_ADMIN privileges cannot be granted through this operation.'
    );
  }

  // Hierarchy rule 3: Role Assignment Policy for ADMIN actors
  if (actor.role === UserRole.ADMIN) {
    if (targetUser.role === UserRole.ADMIN) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'ADMIN does not have authority to modify or demote another ADMIN account.'
      );
    }
    if (data.role !== UserRole.ADMIN) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'ADMIN can only promote eligible users to the ADMIN role.'
      );
    }
  }

  const previousRole = targetUser.role;

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: data.role },
    select: safeUserSelect,
  });

  // Revoke active refresh sessions so client is required to cycle tokens to reflect new role
  await prisma.refreshSession.updateMany({
    where: {
      userId: targetUserId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  // Record audit log entry
  void logAuditEvent({
    actorId: actor.id,
    action: 'USER_ROLE_UPDATE',
    entity: 'User',
    entityId: targetUserId,
    metadata: {
      previousRole,
      newRole: data.role,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return updatedUser;
};
