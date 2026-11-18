import type { UserRole, UserStatus } from '../../generated/prisma/enums.js';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface GoogleLoginDTO {
  credential: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
}

export interface RegisterResponseData {
  email: string;
  emailVerified: boolean;
  verificationRequired: boolean;
}

export interface RegisterResult {
  isExistingUser: boolean;
  data: RegisterResponseData;
}

export interface VerifyEmailResponseData {
  email: string;
  emailVerified: boolean;
}

export interface VerifyResetOtpResponseData {
  email: string;
  resetToken: string;
}

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

export interface LoginResponseData {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

export interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken: string;
}

export interface SessionSummary {
  id: string;
  tokenFamily: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  isCurrent?: boolean;
}
