import httpStatus from 'http-status';
import { AppError } from './AppError.js';
import type { AuthUser } from '../types/index.js';
import { UserRole } from '../generated/prisma/enums.js';

/**
 * Checks whether the current user owns a resource or possesses administrative privileges.
 * Prevents Insecure Direct Object Reference (IDOR) vulnerabilities.
 *
 * @param resourceOwnerId - ID of the user that owns the resource
 * @param currentUser - The currently authenticated user from req.user
 * @param allowAdmin - Whether ADMIN and SUPER_ADMIN roles can bypass the ownership check (default: true)
 */
export const checkResourceOwnership = (
  resourceOwnerId: string,
  currentUser: AuthUser,
  allowAdmin: boolean = true
): void => {
  const isOwner = currentUser.id === resourceOwnerId;
  const isAdmin =
    allowAdmin && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN);

  if (!isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Forbidden. You do not have permission to access or modify this resource.'
    );
  }
};
