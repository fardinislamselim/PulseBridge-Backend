import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { prisma } from '../config/database.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { COOKIE_NAMES } from '../utils/cookie.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UserStatus, type UserRole } from '../generated/prisma/enums.js';
import type { AuthUser } from '../types/index.js';

export const auth = (...requiredRoles: UserRole[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN]
      ? req.cookies[COOKIE_NAMES.ACCESS_TOKEN]
      : req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : req.headers.authorization;

    if (!token) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'You are not logged in. Please log in to access this resource.'
      );
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Invalid or expired access token. Please log in again.'
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not found. Please log in again.');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account has been blocked. Please contact support.'
      );
    }

    if (user.status === UserStatus.DELETED) {
      throw new AppError(httpStatus.FORBIDDEN, 'This account has been deactivated.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError(httpStatus.FORBIDDEN, 'Your account is currently inactive.');
    }

    if (requiredRoles.length && !requiredRoles.includes(user.role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Forbidden. You don't have permission to access this resource."
      );
    }

    req.user = user as AuthUser;
    next();
  });
};

export const authenticate = auth();
export const authorize = (...roles: UserRole[]) => auth(...roles);

export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN]
      ? req.cookies[COOKIE_NAMES.ACCESS_TOKEN]
      : req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : req.headers.authorization;

    if (!token) {
      return next();
    }

    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (user && user.status === UserStatus.ACTIVE) {
        req.user = user as AuthUser;
      }
    } catch {
      // Ignore token verification errors for optional auth
    }

    next();
  }
);

