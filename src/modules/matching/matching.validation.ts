import { z } from 'zod';
import { BloodGroup } from '../../generated/prisma/enums.js';

export const compatibilityQuerySchema = z.object({
  query: z
    .object({
      donorBloodGroup: z.nativeEnum(BloodGroup, { message: 'Invalid donor blood group' }).optional(),
      recipientBloodGroup: z.nativeEnum(BloodGroup, { message: 'Invalid recipient blood group' }).optional(),
    })
    .refine(
      (data) => data.donorBloodGroup !== undefined || data.recipientBloodGroup !== undefined,
      {
        message: 'At least one of donorBloodGroup or recipientBloodGroup is required',
        path: ['donorBloodGroup'],
      }
    ),
});

export const findDonorsQuerySchema = z.object({
  query: z.object({
    requestId: z.string().uuid({ message: 'Invalid blood request ID format' }).optional(),
    bloodGroup: z.nativeEnum(BloodGroup, { message: 'Invalid blood group' }).optional(),
    district: z.string().trim().optional(),
    city: z.string().trim().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).default(50).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
  }),
});

export const matchingRequestIdParamSchema = z.object({
  params: z.object({
    requestId: z.string().uuid({ message: 'Invalid blood request ID format' }),
  }),
});
