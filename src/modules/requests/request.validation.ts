import { z } from 'zod';
import { BloodGroup, RequestStatus, RequestUrgency } from '../../generated/prisma/enums.js';
import { MAX_UNITS_ALLOWED, MIN_UNITS_ALLOWED } from './request.constant.js';

const phoneRegex = /^\+?[0-9]{10,15}$/;

export const createBloodRequestSchema = z
  .object({
    patientName: z
      .string()
      .trim()
      .min(2, 'Patient name must be at least 2 characters')
      .max(100, 'Patient name cannot exceed 100 characters'),
    bloodGroup: z.nativeEnum(BloodGroup, { message: 'Invalid blood group' }),
    unitsNeeded: z
      .number()
      .int('Units needed must be an integer')
      .min(MIN_UNITS_ALLOWED, `Units needed must be at least ${MIN_UNITS_ALLOWED}`)
      .max(MAX_UNITS_ALLOWED, `Units needed cannot exceed ${MAX_UNITS_ALLOWED}`)
      .optional(),
    unitsRequired: z
      .number()
      .int('Units required must be an integer')
      .min(MIN_UNITS_ALLOWED, `Units required must be at least ${MIN_UNITS_ALLOWED}`)
      .max(MAX_UNITS_ALLOWED, `Units required cannot exceed ${MAX_UNITS_ALLOWED}`)
      .optional(),
    hospitalName: z
      .string()
      .trim()
      .min(2, 'Hospital name must be at least 2 characters')
      .max(150, 'Hospital name cannot exceed 150 characters'),
    hospitalAddress: z
      .string()
      .trim()
      .min(3, 'Hospital address must be at least 3 characters')
      .max(255, 'Hospital address cannot exceed 255 characters'),
    district: z
      .string()
      .trim()
      .min(2, 'District must be at least 2 characters')
      .max(100, 'District cannot exceed 100 characters'),
    city: z
      .string()
      .trim()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City cannot exceed 100 characters'),
    area: z.string().trim().max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    contactName: z
      .string()
      .trim()
      .min(2, 'Contact name must be at least 2 characters')
      .max(100)
      .optional(),
    contactPerson: z
      .string()
      .trim()
      .min(2, 'Contact person must be at least 2 characters')
      .max(100)
      .optional(),
    contactPhone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Please provide a valid contact phone number'),
    neededAt: z
      .string()
      .refine(
        (val) => {
          const parsed = Date.parse(val);
          return !isNaN(parsed) && parsed > Date.now();
        },
        { message: 'neededAt must be a valid future date and time' }
      )
      .optional(),
    requiredAt: z
      .string()
      .refine(
        (val) => {
          const parsed = Date.parse(val);
          return !isNaN(parsed) && parsed > Date.now();
        },
        { message: 'requiredAt must be a valid future date and time' }
      )
      .optional(),
    urgency: z.nativeEnum(RequestUrgency).default(RequestUrgency.NORMAL),
    reason: z.string().trim().max(1000).optional(),
    additionalNotes: z.string().trim().max(1000).optional(),
    details: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => data.unitsNeeded !== undefined || data.unitsRequired !== undefined,
    {
      message: 'unitsNeeded or unitsRequired is required',
      path: ['unitsNeeded'],
    }
  )
  .refine(
    (data) => data.contactName !== undefined || data.contactPerson !== undefined,
    {
      message: 'contactName or contactPerson is required',
      path: ['contactName'],
    }
  )
  .refine(
    (data) => data.neededAt !== undefined || data.requiredAt !== undefined,
    {
      message: 'neededAt or requiredAt is required and must be in the future',
      path: ['neededAt'],
    }
  )
  .refine(
    (data) => {
      const hasLat = data.latitude !== undefined;
      const hasLng = data.longitude !== undefined;
      return (hasLat && hasLng) || (!hasLat && !hasLng);
    },
    {
      message: 'Both latitude and longitude must be provided together',
      path: ['latitude'],
    }
  );

export const updateBloodRequestSchema = z
  .object({
    patientName: z.string().trim().min(2).max(100).optional(),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    unitsNeeded: z.number().int().min(MIN_UNITS_ALLOWED).max(MAX_UNITS_ALLOWED).optional(),
    unitsRequired: z.number().int().min(MIN_UNITS_ALLOWED).max(MAX_UNITS_ALLOWED).optional(),
    hospitalName: z.string().trim().min(2).max(150).optional(),
    hospitalAddress: z.string().trim().min(3).max(255).optional(),
    district: z.string().trim().min(2).max(100).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    area: z.string().trim().max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    contactName: z.string().trim().min(2).max(100).optional(),
    contactPerson: z.string().trim().min(2).max(100).optional(),
    contactPhone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional(),
    neededAt: z
      .string()
      .refine(
        (val) => {
          const parsed = Date.parse(val);
          return !isNaN(parsed) && parsed > Date.now();
        },
        { message: 'neededAt must be a valid future date and time' }
      )
      .optional(),
    requiredAt: z
      .string()
      .refine(
        (val) => {
          const parsed = Date.parse(val);
          return !isNaN(parsed) && parsed > Date.now();
        },
        { message: 'requiredAt must be a valid future date and time' }
      )
      .optional(),
    urgency: z.nativeEnum(RequestUrgency).optional(),
    reason: z.string().trim().max(1000).optional(),
    additionalNotes: z.string().trim().max(1000).optional(),
    details: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => {
      const hasLat = data.latitude !== undefined;
      const hasLng = data.longitude !== undefined;
      return (hasLat && hasLng) || (!hasLat && !hasLng);
    },
    {
      message: 'Both latitude and longitude must be provided together',
      path: ['latitude'],
    }
  );

export const cancelBloodRequestSchema = z.object({
  cancellationReason: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const rejectBloodRequestSchema = z
  .object({
    rejectionReason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(500).optional(),
    reason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(500).optional(),
  })
  .refine((data) => data.rejectionReason !== undefined || data.reason !== undefined, {
    message: 'Rejection reason is required',
    path: ['reason'],
  });

export const updateUrgencySchema = z.object({
  urgency: z.nativeEnum(RequestUrgency, { message: 'Invalid urgency level' }),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const expireBloodRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const requestIdParamSchema = z.object({
  params: z.object({
    requestId: z.string().uuid({ message: 'Invalid blood request ID format' }),
  }),
});

export const getBloodRequestsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    district: z.string().trim().optional(),
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    urgency: z.nativeEnum(RequestUrgency).optional(),
    status: z.nativeEnum(RequestStatus).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    sortBy: z
      .enum(['createdAt', 'requiredAt', 'neededAt', 'urgency', 'unitsRequired', 'city', 'district'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const adminGetBloodRequestsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    district: z.string().trim().optional(),
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    urgency: z.nativeEnum(RequestUrgency).optional(),
    status: z.nativeEnum(RequestStatus).optional(),
    requesterId: z.string().uuid().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    neededFrom: z.string().optional(),
    neededTo: z.string().optional(),
    sortBy: z
      .enum(['createdAt', 'requiredAt', 'neededAt', 'urgency', 'unitsRequired', 'fulfilledUnits', 'city', 'district'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
