import { z } from 'zod';

export const getAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    action: z.string().trim().optional(),
    entity: z.string().trim().optional(),
    actorId: z.string().trim().optional(),
  }),
});
