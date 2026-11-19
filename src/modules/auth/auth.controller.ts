import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { env } from '../../config/env.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/ApiResponse.js';
import { setAuthCookies, clearAuthCookies, COOKIE_NAMES } from '../../utils/cookie.js';
import { verifyRefreshToken } from '../../utils/jwt.js';
import { AppError } from '../../utils/AppError.js';
import {
  registerUser,
  loginUser,
  googleLoginUser,
  refreshUserToken,
  logoutUser,
  logoutAllUserSessions,
  getCurrentUser,
  getUserActiveSessions,
  revokeUserSession,
  verifyUserEmail,
  verifyEmailWithOtp,
  resendVerificationOtp,
  resendUserVerificationEmail,
  forgotPassword,
  verifyResetOtp,
  resetPasswordWithToken,
} from './auth.service.js';

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);

  if (result.isExistingUser) {
    return sendSuccess(
      res,
      'Your account information has been updated. A new verification OTP has been sent to your email.',
      result.data
    );
  }

  return sendCreated(
    res,
    'Registration successful. A verification OTP has been sent to your email. Please verify your account before logging in.',
    result.data
  );
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const meta = {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.socket.remoteAddress,
  };

  const { accessToken, refreshToken, user } = await loginUser(req.body, meta);
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, 'Login successful', {
    user,
    accessToken,
    refreshToken,
  });
});

export const googleAuthController = asyncHandler(async (req: Request, res: Response) => {
  const credential = (req.query.credential || req.query.id_token || req.query.code || req.body?.credential) as
    | string
    | undefined;

  if (credential) {
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };

    const { accessToken, refreshToken, user } = await googleLoginUser({ credential }, meta);
    setAuthCookies(res, accessToken, refreshToken);

    return sendSuccess(res, 'Google authentication successful', {
      user,
      accessToken,
      refreshToken,
    });
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = `${env.BACKEND_URL}/api/v1/auth/google/callback`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;

  return sendSuccess(res, 'Google OAuth initiation details', {
    authUrl,
    clientId,
    defaultRole: UserRole.DONOR,
  });
});

export const googleLoginController = asyncHandler(async (req: Request, res: Response) => {
  const meta = {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.socket.remoteAddress,
  };

  const { accessToken, refreshToken, user } = await googleLoginUser(req.body, meta);
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, 'Google authentication successful', {
    user,
    accessToken,
    refreshToken,
  });
});

export const refreshTokenController = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || req.body?.refreshToken;
  const meta = {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.socket.remoteAddress,
  };

  const { accessToken, refreshToken } = await refreshUserToken(rawRefreshToken, meta);
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, 'Token refreshed successfully', {
    accessToken,
    refreshToken,
  });
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  let sessionId: string | undefined;

  if (rawRefreshToken) {
    try {
      const decoded = verifyRefreshToken(rawRefreshToken);
      sessionId = decoded.sessionId;
    } catch {
      // Safe logout even if refresh token has already expired
    }
  }

  await logoutUser(sessionId);
  clearAuthCookies(res);

  return sendSuccess(res, 'Logged out successfully');
});

export const logoutAllSessionsController = asyncHandler(async (req: Request, res: Response) => {
  await logoutAllUserSessions(req.user!.id);
  clearAuthCookies(res);

  return sendSuccess(res, 'All active sessions have been terminated');
});

export const getMeController = asyncHandler(async (req: Request, res: Response) => {
  const user = await getCurrentUser(req.user!.id);
  return sendSuccess(res, 'Current user profile retrieved', { user });
});

export const getSessionsController = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  let currentSessionId: string | undefined;

  if (rawRefreshToken) {
    try {
      const decoded = verifyRefreshToken(rawRefreshToken);
      currentSessionId = decoded.sessionId;
    } catch {
      // Ignored
    }
  }

  const sessions = await getUserActiveSessions(req.user!.id, currentSessionId);
  return sendSuccess(res, 'User active sessions retrieved', { sessions });
});

export const revokeSessionController = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await revokeUserSession(req.user!.id, id);

  return sendSuccess(res, 'Session revoked successfully');
});

export const verifyEmailController = asyncHandler(async (req: Request, res: Response) => {
  // Support both OTP-based verification (standard) and legacy token-based verification
  if (req.body?.otp && req.body?.email) {
    const { email, otp } = req.body as { email: string; otp: string };
    const data = await verifyEmailWithOtp(email, otp);
    return sendSuccess(res, 'Email verified successfully. You can now log in.', data);
  }

  if (req.body?.token || req.query?.token) {
    const token = String(req.body?.token || req.query?.token);
    await verifyUserEmail(token);
    return sendSuccess(res, 'Email address verified successfully');
  }

  throw new AppError(httpStatus.BAD_REQUEST, 'Email and 6-digit OTP code are required.');
});

export const resendVerificationController = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await resendVerificationOtp(email);

  return sendSuccess(
    res,
    'If an unverified account exists with this email address, a new verification code has been sent.'
  );
});

export const forgotPasswordController = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await forgotPassword(email);

  return sendSuccess(res, 'A password reset code has been sent to your email.');
});

export const verifyResetOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body as { email: string; otp: string };
  const data = await verifyResetOtp(email, otp);

  return sendSuccess(res, 'Password reset code verified successfully.', data);
});

export const resetPasswordController = asyncHandler(async (req: Request, res: Response) => {
  const { email, resetToken, newPassword } = req.body as {
    email: string;
    resetToken: string;
    newPassword: string;
  };
  await resetPasswordWithToken(email, resetToken, newPassword);

  return sendSuccess(
    res,
    'Password has been reset successfully. You can now log in with your new password.'
  );
});
