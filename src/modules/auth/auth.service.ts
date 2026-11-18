import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendEmailVerificationOtpEmail,
  sendPasswordResetOtpEmail,
} from '../../services/email.service.js';
import {
  createAndStoreOtp,
  verifyOtp,
  createPasswordResetAuthorization,
  verifyAndConsumePasswordResetAuthorization,
  invalidateOtp,
} from '../otp/index.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { AUTH_CONSTANTS } from './auth.constant.js';
import { hashToken, generateSecureRandomToken, toSafeUser } from './auth.utils.js';
import type {
  RegisterDTO,
  LoginDTO,
  GoogleLoginDTO,
  SafeUser,
  RegisterResponseData,
  RegisterResult,
  VerifyEmailResponseData,
  VerifyResetOtpResponseData,
  SessionMeta,
  AuthTokens,
  RefreshResult,
  SessionSummary,
} from './auth.interface.js';

const googleOAuthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

export const registerUser = async (data: RegisterDTO): Promise<RegisterResult> => {
  const normalizedEmail = data.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    if (existingUser.emailVerified) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Your account is already verified. You are already a registered user. Please login.'
      );
    }

    if (existingUser.role !== UserRole.USER) {
      throw new AppError(httpStatus.FORBIDDEN, 'Privileged accounts cannot be re-registered.');
    }

    if (existingUser.status === UserStatus.BLOCKED || existingUser.status === UserStatus.DELETED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'This account has been restricted. Please contact support.'
      );
    }

    const hashedPassword = await hashPassword(data.password);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: data.name.trim(),
        password: hashedPassword,
        phone: data.phone?.trim() || existingUser.phone,
      },
    });

    const { otp } = await createAndStoreOtp(normalizedEmail, 'email-verification', false);

    try {
      const emailSent = await sendEmailVerificationOtpEmail(
        existingUser.email,
        otp,
        data.name.trim()
      );
      if (!emailSent) {
        await invalidateOtp(normalizedEmail, 'email-verification');
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to dispatch verification email. Please try again.'
        );
      }
    } catch (error) {
      await invalidateOtp(normalizedEmail, 'email-verification');
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to dispatch verification email. Please try again.'
      );
    }

    return {
      isExistingUser: true,
      data: {
        email: existingUser.email,
        emailVerified: false,
        verificationRequired: true,
      },
    };
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: data.phone?.trim() || null,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    },
  });

  const { otp } = await createAndStoreOtp(normalizedEmail, 'email-verification', false);

  try {
    const emailSent = await sendEmailVerificationOtpEmail(user.email, otp, user.name);
    if (!emailSent) {
      await invalidateOtp(normalizedEmail, 'email-verification');
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to dispatch verification email. Please try again.'
      );
    }
  } catch (error) {
    await invalidateOtp(normalizedEmail, 'email-verification');
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to dispatch verification email. Please try again.'
    );
  }

  return {
    isExistingUser: false,
    data: {
      email: user.email,
      emailVerified: false,
      verificationRequired: true,
    },
  };
};

export const loginUser = async (data: LoginDTO, meta: SessionMeta = {}): Promise<AuthTokens> => {
  const normalizedEmail = data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.password) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  const isPasswordValid = await comparePassword(data.password, user.password);
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  if (!user.emailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, 'Please verify your email address before logging in.');
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

  const sessionId = crypto.randomUUID();
  const tokenFamily = generateSecureRandomToken(16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, sessionId, tokenFamily });
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      tokenFamily,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: toSafeUser(user),
  };
};

export const googleLoginUser = async (
  data: GoogleLoginDTO,
  meta: SessionMeta = {}
): Promise<AuthTokens> => {
  let payload;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: data.credential,
      audience: env.GOOGLE_CLIENT_ID || undefined,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid Google ID token credential');
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid Google ID token payload');
  }

  // Validate issuer
  if (
    payload.iss &&
    !AUTH_CONSTANTS.GOOGLE_ISSUERS.includes(
      payload.iss as (typeof AUTH_CONSTANTS.GOOGLE_ISSUERS)[number]
    )
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Untrusted Google token issuer');
  }

  // Validate expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Google ID token has expired');
  }

  // Verify email_verified is true
  if (!payload.email_verified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Unverified Google email address cannot be used for authentication'
    );
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const googleSub = payload.sub;

  const user = await prisma.$transaction(async (tx) => {
    // 1. Check existing OAuth account
    const existingOAuth = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleSub,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      return existingOAuth.user;
    }

    // 2. Check if user exists by normalized verified email
    const existingUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Link OAuth account
      await tx.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: 'google',
          providerAccountId: googleSub,
        },
      });

      if (!existingUser.emailVerified) {
        return tx.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: true },
        });
      }

      return existingUser;
    }

    // 3. Create new user and OAuth account
    return tx.user.create({
      data: {
        name: payload.name || 'Google User',
        email: normalizedEmail,
        password: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        oauthAccounts: {
          create: {
            provider: 'google',
            providerAccountId: googleSub,
          },
        },
      },
    });
  });

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

  const sessionId = crypto.randomUUID();
  const tokenFamily = generateSecureRandomToken(16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, sessionId, tokenFamily });
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      tokenFamily,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: toSafeUser(user),
  };
};

export const refreshUserToken = async (
  rawRefreshToken: string,
  meta: SessionMeta = {}
): Promise<RefreshResult> => {
  if (!rawRefreshToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  const payload = verifyRefreshToken(rawRefreshToken);

  const session = await prisma.refreshSession.findUnique({
    where: { id: payload.sessionId },
    include: { user: true },
  });

  if (!session) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh session');
  }

  const incomingHash = hashToken(rawRefreshToken);

  // Reuse detection 1: Session was already revoked
  if (session.revokedAt !== null) {
    await prisma.refreshSession.updateMany({
      where: { tokenFamily: session.tokenFamily },
      data: { revokedAt: new Date() },
    });
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Token reuse detected. All sessions in this family have been revoked.'
    );
  }

  // Reuse detection 2: Token hash doesn't match active session
  if (session.tokenHash !== incomingHash) {
    await prisma.refreshSession.updateMany({
      where: { tokenFamily: session.tokenFamily },
      data: { revokedAt: new Date() },
    });
    throw new AppError(httpStatus.UNAUTHORIZED, 'Token reuse detected. Session terminated.');
  }

  // Check expiration
  if (new Date() > session.expiresAt) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Refresh session has expired. Please log in again.'
    );
  }

  // Check user status
  const user = session.user;
  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(httpStatus.FORBIDDEN, 'Your account is no longer active.');
  }

  // Atomic rotation in transaction
  const newSessionId = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const newAccessToken = signAccessToken({ sub: user.id, role: user.role });
  const newRefreshToken = signRefreshToken({
    sub: user.id,
    sessionId: newSessionId,
    tokenFamily: session.tokenFamily,
  });
  const newTokenHash = hashToken(newRefreshToken);

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshSession.create({
      data: {
        id: newSessionId,
        userId: user.id,
        tokenHash: newTokenHash,
        tokenFamily: session.tokenFamily,
        expiresAt: newExpiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    }),
  ]);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: toSafeUser(user),
  };
};

export const logoutUser = async (sessionId?: string): Promise<void> => {
  if (sessionId) {
    await prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
};

export const logoutAllUserSessions = async (userId: string): Promise<void> => {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const getCurrentUser = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return toSafeUser(user);
};

export const getUserActiveSessions = async (
  userId: string,
  currentSessionId?: string
): Promise<SessionSummary[]> => {
  const sessions = await prisma.refreshSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tokenFamily: true,
      userAgent: true,
      ipAddress: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return sessions.map((s) => ({
    ...s,
    isCurrent: s.id === currentSessionId,
  }));
};

export const revokeUserSession = async (userId: string, targetSessionId: string): Promise<void> => {
  const session = await prisma.refreshSession.findUnique({
    where: { id: targetSessionId },
  });

  if (!session || session.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Session not found or does not belong to you');
  }

  await prisma.refreshSession.update({
    where: { id: targetSessionId },
    data: { revokedAt: new Date() },
  });
};

export const verifyUserEmail = async (token: string): Promise<void> => {
  const tokenHash = hashToken(token);

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt !== null || new Date() > record.expiresAt) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired verification token');
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
  ]);
};

export const resendUserVerificationEmail = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Generic safe return to prevent email enumeration
  if (!user) {
    return;
  }

  if (user.emailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This email address is already verified');
  }

  // Invalidate existing tokens
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id },
  });

  const rawToken = generateSecureRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + AUTH_CONSTANTS.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
  void sendVerificationEmail(user.email, verificationUrl, user.name);
};

export const verifyEmailWithOtp = async (
  email: string,
  otp: string
): Promise<VerifyEmailResponseData> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account not found.');
  }

  if (user.emailVerified) {
    return {
      email: user.email,
      emailVerified: true,
    };
  }

  await verifyOtp(normalizedEmail, otp, 'email-verification');

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });

  void sendWelcomeEmail(user.email, user.name);

  return {
    email: user.email,
    emailVerified: true,
  };
};

export const resendVerificationOtp = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Generic return to prevent user enumeration
  if (!user) {
    return;
  }

  if (user.emailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This email address is already verified.');
  }

  const { otp } = await createAndStoreOtp(normalizedEmail, 'email-verification');

  try {
    const emailSent = await sendEmailVerificationOtpEmail(user.email, otp, user.name);
    if (!emailSent) {
      await invalidateOtp(normalizedEmail, 'email-verification');
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to dispatch verification email. Please try again.'
      );
    }
  } catch (error) {
    await invalidateOtp(normalizedEmail, 'email-verification');
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to dispatch verification email. Please try again.'
    );
  }
};

export const forgotPassword = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user && user.emailVerified && user.status === UserStatus.ACTIVE && user.password !== null) {
    const { otp } = await createAndStoreOtp(normalizedEmail, 'password-reset');
    try {
      const emailSent = await sendPasswordResetOtpEmail(user.email, otp, user.name);
      if (!emailSent) {
        await invalidateOtp(normalizedEmail, 'password-reset');
      }
    } catch {
      await invalidateOtp(normalizedEmail, 'password-reset');
    }
  }
};

export const verifyResetOtp = async (
  email: string,
  otp: string
): Promise<VerifyResetOtpResponseData> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.emailVerified || user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid request or account not eligible for password reset.'
    );
  }

  await verifyOtp(normalizedEmail, otp, 'password-reset');

  const resetToken = await createPasswordResetAuthorization(normalizedEmail);

  return {
    email: normalizedEmail,
    resetToken,
  };
};

export const resetPasswordWithToken = async (
  email: string,
  resetToken: string,
  newPassword: string
): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  await verifyAndConsumePasswordResetAuthorization(normalizedEmail, resetToken);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User account not found.');
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // Revoke existing refresh sessions after password change
  await prisma.refreshSession.deleteMany({
    where: { userId: user.id },
  });
};
