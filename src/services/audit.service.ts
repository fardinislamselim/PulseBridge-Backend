import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface CreateAuditLogParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Persists an administrative or security-critical action into the AuditLog table.
 * Never logs credentials, secrets, raw tokens, or passwords.
 */
export const logAuditEvent = async (params: CreateAuditLogParams): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    // Audit failure should be logged but never silently crash core operations
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[AuditLog] Failed to persist audit entry for action "${params.action}": ${message}`
    );
  }
};
