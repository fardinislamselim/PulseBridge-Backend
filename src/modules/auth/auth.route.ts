import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import httpStatus from 'http-status';
import {
  registerController,
  loginController,
  googleLoginController,
  refreshTokenController,
  logoutController,
  logoutAllSessionsController,
  getMeController,
  getSessionsController,
  revokeSessionController,
  verifyEmailController,
  resendVerificationController,
  forgotPasswordController,
  verifyResetOtpController,
  resetPasswordController,
} from './auth.controller.js';
import { auth } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationOtpSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  revokeSessionSchema,
} from './auth.validation.js';

const router = Router();

// Dedicated rate limiter for sensitive authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      statusCode: httpStatus.TOO_MANY_REQUESTS,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      error: { name: 'RateLimitError' },
    });
  },
});

// Resend verification limiter (strict)
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      statusCode: httpStatus.TOO_MANY_REQUESTS,
      message: 'Too many verification email requests. Please try again later.',
      error: { name: 'RateLimitError' },
    });
  },
});

// Password reset request limiter
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      statusCode: httpStatus.TOO_MANY_REQUESTS,
      message: 'Too many password reset requests. Please try again later.',
      error: { name: 'RateLimitError' },
    });
  },
});

// Public Authentication Endpoints
router.post('/register', authRateLimiter, validateRequest(registerSchema), registerController);
router.post('/login', authRateLimiter, validateRequest(loginSchema), loginController);
router.post('/google', authRateLimiter, validateRequest(googleLoginSchema), googleLoginController);
router.post('/refresh', authRateLimiter, validateRequest(refreshTokenSchema), refreshTokenController);
router.post('/logout', logoutController);

// Email Verification Endpoints
router.post(
  '/verify-email',
  authRateLimiter,
  validateRequest(verifyEmailSchema),
  verifyEmailController
);
router.post(
  '/resend-verification-otp',
  resendVerificationLimiter,
  validateRequest(resendVerificationOtpSchema),
  resendVerificationController
);
router.post(
  '/resend-verification',
  resendVerificationLimiter,
  validateRequest(resendVerificationSchema),
  resendVerificationController
);

// Password Reset Endpoints
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validateRequest(forgotPasswordSchema),
  forgotPasswordController
);
router.post(
  '/verify-reset-otp',
  authRateLimiter,
  validateRequest(verifyResetOtpSchema),
  verifyResetOtpController
);
router.post(
  '/reset-password',
  authRateLimiter,
  validateRequest(resetPasswordSchema),
  resetPasswordController
);

// Authenticated User & Session Endpoints
router.get('/me', auth(), getMeController);
router.post('/logout-all', auth(), logoutAllSessionsController);
router.get('/sessions', auth(), getSessionsController);
router.delete(
  '/sessions/:id',
  auth(),
  validateRequest(revokeSessionSchema),
  revokeSessionController
);

export const authRoutes = router;
