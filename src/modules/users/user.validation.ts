import { z } from 'zod';
import { UserRole, UserStatus, BloodGroup } from '../../generated/prisma/enums.js';

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Please provide a valid phone number')
    .optional(),
  avatar: z.string().trim().optional().nullable(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
    .optional(),
  gender: z.string().trim().max(20).optional(),
  address: z.string().trim().min(3, 'Address must be at least 3 characters').optional(),
  city: z.string().trim().min(2, 'City must be at least 2 characters').optional(),
  district: z.string().trim().min(2, 'District must be at least 2 characters').optional(),
  isAvailable: z.boolean().optional(),
});

export const getUsersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    emailVerified: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
    sortBy: z.enum(['createdAt', 'name', 'email', 'role', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const getUserDetailsParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    status: z.nativeEnum(UserStatus),
    reason: z.string().trim().max(255).optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    role: z.nativeEnum(UserRole),
  }),
});
