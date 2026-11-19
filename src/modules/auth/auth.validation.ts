import { z } from 'zod';
import { UserRole, BloodGroup } from '../../generated/prisma/enums.js';

const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const bloodGroupSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const normalized = val.trim().toUpperCase();
    const map: Record<string, BloodGroup> = {
      'A+': BloodGroup.A_POSITIVE,
      'A-': BloodGroup.A_NEGATIVE,
      'B+': BloodGroup.B_POSITIVE,
      'B-': BloodGroup.B_NEGATIVE,
      'AB+': BloodGroup.AB_POSITIVE,
      'AB-': BloodGroup.AB_NEGATIVE,
      'O+': BloodGroup.O_POSITIVE,
      'O-': BloodGroup.O_NEGATIVE,
      A_POSITIVE: BloodGroup.A_POSITIVE,
      A_NEGATIVE: BloodGroup.A_NEGATIVE,
      B_POSITIVE: BloodGroup.B_POSITIVE,
      B_NEGATIVE: BloodGroup.B_NEGATIVE,
      AB_POSITIVE: BloodGroup.AB_POSITIVE,
      AB_NEGATIVE: BloodGroup.AB_NEGATIVE,
      O_POSITIVE: BloodGroup.O_POSITIVE,
      O_NEGATIVE: BloodGroup.O_NEGATIVE,
    };
    if (map[normalized]) return map[normalized];
  }
  return val;
}, z.nativeEnum(BloodGroup, { message: 'Invalid blood group' }));

export const registerSchema = z
  .object({
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
    role: z
      .enum(['DONOR', 'REQUESTER'], {
        message: 'Public registration allows only DONOR or REQUESTER roles',
      })
      .default('REQUESTER'),
    bloodGroup: bloodGroupSchema.optional(),
    district: z.string().trim().min(2, 'District must be at least 2 characters').optional(),
    city: z.string().trim().min(2, 'City must be at least 2 characters').optional(),
    address: z.string().trim().min(3, 'Address must be at least 3 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === UserRole.DONOR) {
      if (!data.bloodGroup) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bloodGroup is required for DONOR registration',
          path: ['bloodGroup'],
        });
      }
      if (!data.district) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'district is required for DONOR registration',
          path: ['district'],
        });
      }
      if (!data.phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'phone is required for DONOR registration',
          path: ['phone'],
        });
      }
    }
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
