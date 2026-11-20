import { z } from 'zod';
import { BloodGroup, RequestUrgency } from '../../generated/prisma/enums.js';

export const getAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    action: z.string().trim().optional(),
    entity: z.string().trim().optional(),
    actorId: z.string().trim().optional(),
  }),
});

export const dashboardOverviewQuerySchema = z.object({
  query: z.object({
    refresh: z
      .preprocess((val) => val === 'true' || val === true, z.boolean())
      .optional()
      .default(false),
  }),
});

export const recentActivitiesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.string().trim().optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid startDate format' })
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid endDate format' })
      .optional(),
  }),
});

export const analyticsFilterQuerySchema = z.object({
  query: z
    .object({
      period: z.enum(['today', '7d', '30d', '90d', '6m', '1y', 'all']).optional().default('30d'),
      startDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid startDate format' })
        .optional(),
      endDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid endDate format' })
        .optional(),
      interval: z.enum(['day', 'week', 'month']).optional().default('day'),
      district: z.string().trim().optional(),
      bloodGroup: z.nativeEnum(BloodGroup).optional(),
      status: z.string().trim().optional(),
      urgency: z.nativeEnum(RequestUrgency).optional(),
      refresh: z
        .preprocess((val) => val === 'true' || val === true, z.boolean())
        .optional()
        .default(false),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      {
        message: 'startDate cannot be later than endDate',
        path: ['startDate'],
      }
    ),
});
