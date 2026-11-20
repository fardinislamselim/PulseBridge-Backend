import { prisma } from '../../config/database.js';
import { PaymentProvider, WebhookEventStatus } from '../../generated/prisma/enums.js';
import { logAuditEvent } from '../../services/audit.service.js';

export interface WebhookEventRecord {
  id: string;
  eventId: string;
  provider: PaymentProvider;
  eventType: string;
  paymentId: string | null;
  status: WebhookEventStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  lastError: string | null;
}

/**
 * Persists an incoming provider webhook event durably in PostgreSQL with idempotency guarantees.
 */
export const recordWebhookEvent = async (
  provider: PaymentProvider,
  eventId: string,
  eventType: string,
  payload: unknown,
  paymentId?: string,
): Promise<{ event: any; isDuplicate: boolean }> => {
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { eventId },
  });

  if (existing) {
    // If already processed or ignored, it is a duplicate
    if (existing.status === WebhookEventStatus.PROCESSED || existing.status === WebhookEventStatus.IGNORED) {
      return { event: existing, isDuplicate: true };
    }

    // If currently processing, check lease (5 minutes timeout)
    if (existing.status === WebhookEventStatus.PROCESSING) {
      const leaseAgeMs = existing.processingStartedAt
        ? Date.now() - existing.processingStartedAt.getTime()
        : 0;

      if (leaseAgeMs < 5 * 60 * 1000) {
        return { event: existing, isDuplicate: true };
      }
      // Lease expired (worker crash recovery): allow retry
    }

    return { event: existing, isDuplicate: false };
  }

  // Sanitize payload to strip any sensitive headers/secrets before persisting
  const sanitizedPayload = typeof payload === 'object' && payload !== null ? { ...(payload as Record<string, unknown>) } : { raw: String(payload) };
  delete (sanitizedPayload as Record<string, unknown>).secret;
  delete (sanitizedPayload as Record<string, unknown>).signature;

  const created = await prisma.paymentWebhookEvent.create({
    data: {
      eventId,
      providerEventId: eventId,
      provider,
      eventType,
      paymentId: paymentId || null,
      status: WebhookEventStatus.RECEIVED,
      payload: sanitizedPayload as any,
      attemptCount: 0,
      maxAttempts: 5,
      processed: false,
    },
  });

  await logAuditEvent({
    action: 'WEBHOOK_RECEIVED',
    entity: 'PaymentWebhookEvent',
    entityId: created.id,
    metadata: { provider, eventId, eventType, paymentId },
  });

  return { event: created, isDuplicate: false };
};

/**
 * Claims a webhook event atomically for execution, preventing multi-instance concurrency collisions.
 */
export const claimWebhookEvent = async (eventId: string): Promise<boolean> => {
  const now = new Date();
  const leaseThreshold = new Date(now.getTime() - 5 * 60 * 1000);

  // Update conditionally if status is RECEIVED or stale PROCESSING
  const result = await prisma.paymentWebhookEvent.updateMany({
    where: {
      eventId,
      OR: [
        { status: WebhookEventStatus.RECEIVED },
        { status: WebhookEventStatus.PROCESSING, processingStartedAt: { lte: leaseThreshold } },
      ],
    },
    data: {
      status: WebhookEventStatus.PROCESSING,
      processingStartedAt: now,
      attemptCount: { increment: 1 },
    },
  });

  return result.count > 0;
};

/**
 * Marks a webhook event as successfully processed.
 */
export const markWebhookProcessed = async (
  eventId: string,
  paymentId?: string,
): Promise<void> => {
  const now = new Date();
  await prisma.paymentWebhookEvent.updateMany({
    where: { eventId },
    data: {
      status: WebhookEventStatus.PROCESSED,
      processedAt: now,
      processed: true,
      paymentId: paymentId || undefined,
    },
  });

  await logAuditEvent({
    action: 'WEBHOOK_PROCESSED',
    entity: 'PaymentWebhookEvent',
    entityId: eventId,
    metadata: { eventId, paymentId },
  });
};

/**
 * Records a webhook processing failure with exponential backoff retry scheduling or terminal failure.
 */
export const markWebhookFailed = async (
  eventId: string,
  errorMsg: string,
  permanent = false,
): Promise<void> => {
  const event = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
  if (!event) return;

  const now = new Date();
  const nextAttempt = event.attemptCount;
  const isTerminal = permanent || nextAttempt >= event.maxAttempts;

  if (isTerminal) {
    await prisma.paymentWebhookEvent.update({
      where: { eventId },
      data: {
        status: WebhookEventStatus.FAILED,
        failedAt: now,
        lastError: errorMsg.slice(0, 1000),
      },
    });

    await logAuditEvent({
      action: 'WEBHOOK_FAILED',
      entity: 'PaymentWebhookEvent',
      entityId: eventId,
      metadata: { eventId, error: errorMsg, terminal: true },
    });
  } else {
    // Exponential backoff: 2s, 4s, 8s, 16s...
    const backoffSeconds = Math.pow(2, nextAttempt);
    const nextRetryAt = new Date(now.getTime() + backoffSeconds * 1000);

    await prisma.paymentWebhookEvent.update({
      where: { eventId },
      data: {
        status: WebhookEventStatus.RECEIVED,
        nextRetryAt,
        lastError: errorMsg.slice(0, 1000),
      },
    });
  }
};

/**
 * Marks a webhook event as safely ignored (e.g. unhandled event type).
 */
export const markWebhookIgnored = async (
  eventId: string,
  reason: string,
): Promise<void> => {
  await prisma.paymentWebhookEvent.updateMany({
    where: { eventId },
    data: {
      status: WebhookEventStatus.IGNORED,
      lastError: reason.slice(0, 1000),
    },
  });
};
