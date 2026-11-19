import { z } from 'zod';
import { BloodGroup } from '../../generated/prisma/enums.js';

export const updateDonorProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Please provide a valid phone number')
    .optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
    .optional(),
  gender: z.string().trim().max(20).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  area: z.string().trim().max(100).optional(),
  address: z.string().trim().max(255).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const updateDonorAvailabilitySchema = z.object({
  isAvailable: z.boolean({ message: 'isAvailable is required' }),
});

export const getDonorsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    district: z.string().trim().optional(),
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    isAvailable: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
    eligible: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
    sortBy: z
      .enum(['createdAt', 'city', 'district', 'area', 'lastDonationDate', 'eligibleAt'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const nearbyDonorsQuerySchema = z.object({
  query: z.object({
    latitude: z.coerce
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    longitude: z.coerce
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
    radius: z.coerce
      .number()
      .positive('Radius must be positive')
      .max(500, 'Radius cannot exceed 500 km')
      .default(10),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    isAvailable: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
    eligible: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const donorIdParamSchema = z.object({
  params: z.object({
    donorId: z.string().uuid({ message: 'Invalid donor ID format' }),
  }),
});

export const adminVerifyDonorSchema = z.object({
  params: z.object({
    donorId: z.string().uuid({ message: 'Invalid donor ID format' }),
  }),
  body: z.object({
    isVerified: z.boolean({ message: 'isVerified is required' }),
  }),
});

export const adminRestrictDonorSchema = z.object({
  params: z.object({
    donorId: z.string().uuid({ message: 'Invalid donor ID format' }),
  }),
  body: z.object({
    hasMedicalRestriction: z.boolean({ message: 'hasMedicalRestriction is required' }),
    medicalRestrictionReason: z.string().trim().max(500).optional(),
  }),
});
