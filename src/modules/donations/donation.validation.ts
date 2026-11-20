import { z } from 'zod';
import {
  BloodGroup,
  DonationStatus,
  DonationVerificationStatus,
} from '../../generated/prisma/enums.js';

export const createDonationSchema = z.object({
  body: z.object({
    donorId: z.string().min(1, 'Donor ID is required'),
    bloodRequestId: z.string().min(1, 'Blood request ID is required'),
    assignmentId: z.string().optional(),
    unitsDonated: z.coerce.number().int().min(1).max(10).default(1),
    donationDate: z.string().datetime().optional().or(z.date().optional()),
    hospitalName: z.string().max(255).optional(),
    hospitalAddress: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const verifyDonationSchema = z.object({
  body: z
    .object({
      notes: z.string().max(1000).optional(),
    })
    .optional(),
});

export const rejectDonationSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, 'Rejection reason must be at least 3 characters')
      .max(500, 'Rejection reason cannot exceed 500 characters'),
  }),
});

export const donationIdParamSchema = z.object({
  params: z.object({
    donationId: z.string().min(1, 'Donation ID is required'),
  }),
});

export const donorIdParamSchema = z.object({
  params: z.object({
    donorId: z.string().min(1, 'Donor ID is required'),
  }),
});

export const donationQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      sortBy: z
        .enum(['createdAt', 'donationDate', 'completedAt', 'unitsDonated'])
        .default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      status: z.nativeEnum(DonationStatus).optional(),
      verificationStatus: z.nativeEnum(DonationVerificationStatus).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      bloodRequestId: z.string().optional(),
      donorId: z.string().optional(),
      district: z.string().optional(),
      bloodGroup: z.nativeEnum(BloodGroup).optional(),
    })
    .optional(),
});
