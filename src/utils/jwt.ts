import jwt, { type SignOptions } from 'jsonwebtoken';
import httpStatus from 'http-status';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';
import type { UserRole } from '../generated/prisma/enums.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  tokenFamily: string;
  type: 'refresh';
}

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'type'>): string => {
  const tokenPayload: AccessTokenPayload = {
    ...payload,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'pulsebridge-backend',
    audience: 'pulsebridge-client',
  };

  return jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'pulsebridge-backend',
      audience: 'pulsebridge-client',
    }) as AccessTokenPayload;

    if (decoded.type !== 'access') {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token type provided');
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Access token has expired');
    }
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid access token');
  }
};

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, 'type'>): string => {
  const tokenPayload: RefreshTokenPayload = {
    ...payload,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'pulsebridge-backend',
    audience: 'pulsebridge-client',
  };

  return jwt.sign(tokenPayload, env.JWT_REFRESH_SECRET, options);
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'pulsebridge-backend',
      audience: 'pulsebridge-client',
    }) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token type provided');
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token has expired');
    }
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }
};
