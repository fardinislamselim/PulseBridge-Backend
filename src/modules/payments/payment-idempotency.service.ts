import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { IdempotencyOperation } from '../../generated/prisma/enums.js';
import { PAYMENT_ERROR_CODES } from './payment.constant.js';
import { hashPayload } from './payment.utils.js';

export interface IdempotencyCheckResult {
  hit: boolean;
  status?: number;
  body?: unknown;
  currentHash: string;
}

/**
 * Checks if an operation with the given idempotency key was previously processed.
 * Detects payload tampering or reuse with conflicting parameters (HTTP 409 Conflict).
 */
export const checkIdempotency = async (
  key: string,
  operation: IdempotencyOperation,
  payload: unknown,
  actorId?: string,
): Promise<IdempotencyCheckResult> => {
  const currentHash = hashPayload(payload);

  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      key_operation: {
        key,
        operation,
      },
    },
  });

  if (!existing) {
    return { hit: false, currentHash };
  }

  // Check if expired
  if (existing.expiresAt < new Date()) {
    await prisma.idempotencyRecord.delete({ where: { id: existing.id } }).catch(() => {});
    return { hit: false, currentHash };
  }

  // If key belongs to a different actor when actor is specified
  if (actorId && existing.actorId && existing.actorId !== actorId) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Idempotency key is bound to another user session',
      PAYMENT_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
    );
  }

  // Payload fingerprint comparison
  if (existing.requestHash !== currentHash) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Idempotency key was previously executed with different request parameters',
      PAYMENT_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
    );
  }

  return {
    hit: true,
    status: existing.responseStatus,
    body: existing.responseBody,
    currentHash,
  };
};

/**
 * Persists the resulting status and body of an executed idempotent operation.
 */
export const saveIdempotency = async (
  key: string,
  operation: IdempotencyOperation,
  payload: unknown,
  responseStatus: number,
  responseBody: unknown,
  actorId?: string,
  resourceId?: string,
  ttlHours = 24,
): Promise<void> => {
  const requestHash = hashPayload(payload);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  try {
    await prisma.idempotencyRecord.upsert({
      where: {
        key_operation: {
          key,
          operation,
        },
      },
      create: {
        key,
        operation,
        actorId: actorId || null,
        resourceId: resourceId || null,
        requestHash,
        responseStatus,
        responseBody: (responseBody || {}) as any,
        expiresAt,
      },
      update: {
        requestHash,
        responseStatus,
        responseBody: (responseBody || {}) as any,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn('[Idempotency] Failed to persist idempotency record:', (err as Error).message);
  }
};
