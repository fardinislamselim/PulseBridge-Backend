import { z } from 'zod';
import { PaymentProvider, PaymentPurpose, PaymentStatus } from '../../generated/prisma/enums.js';

export const initiatePaymentSchema = z.object({
  body: z.object({
    provider: z.nativeEnum(PaymentProvider, {
      message: 'Provider must be either SSLCOMMERZ or STRIPE',
    }),
    paymentPurpose: z.nativeEnum(PaymentPurpose).default(PaymentPurpose.PLATFORM_SUPPORT),
    amount: z.coerce
      .number()
      .positive('Payment amount must be greater than 0'),
    currency: z.string().min(3).max(3).toUpperCase().optional(),
    description: z.string().max(255, 'Description cannot exceed 255 characters').optional(),
    bloodRequestId: z.string().optional(),
  }),
});

export const refundPaymentSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('Refund amount must be positive').optional(),
    reason: z
      .string()
      .min(3, 'Refund reason must be at least 3 characters')
      .max(500, 'Refund reason cannot exceed 500 characters'),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    paymentId: z.string().min(1, 'Payment ID is required'),
  }),
});

export const paymentQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      sortBy: z.enum(['createdAt', 'paidAt', 'amount']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      status: z.nativeEnum(PaymentStatus).optional(),
      provider: z.nativeEnum(PaymentProvider).optional(),
      paymentPurpose: z.nativeEnum(PaymentPurpose).optional(),
      currency: z.string().optional(),
      transactionId: z.string().optional(),
      userId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      minAmount: z.coerce.number().positive().optional(),
      maxAmount: z.coerce.number().positive().optional(),
    })
    .optional(),
});
