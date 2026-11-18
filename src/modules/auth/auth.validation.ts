import { z } from 'zod';

const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: passwordValidation,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Please provide a valid phone number')
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password cannot be empty'),
});

export const googleLoginSchema = z.object({
  credential: z.string().min(10, 'Invalid Google ID token credential'),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
});

export const resendVerificationOtpSchema = resendVerificationSchema;

export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
});

export const verifyResetOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  resetToken: z.string().trim().min(1, 'Reset token cannot be empty'),
  newPassword: passwordValidation,
});

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .optional()
  .default({});

export const revokeSessionParamsSchema = z.object({
  id: z.string().min(1, 'Session ID cannot be empty'),
});

export const revokeSessionSchema = z.object({
  params: revokeSessionParamsSchema,
});
