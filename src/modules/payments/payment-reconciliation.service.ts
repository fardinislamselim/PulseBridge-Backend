import { prisma } from '../../config/database.js';
import { redisClient } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { PaymentStatus } from '../../generated/prisma/enums.js';
import { getPaymentProviderInstance } from './payment.service.js';

let reconciliationTimer: NodeJS.Timeout | null = null;

export interface ReconciliationResult {
  checkedCount: number;
  recoveredCount: number;
  expiredCount: number;
}

/**
 * Reconciles stale pending or processing payments against provider gateways.
 */
export const reconcileStalePayments = async (): Promise<ReconciliationResult> => {
  const lockKey = 'pulsebridge:locks:payment-reconciliation';
  let lockAcquired = false;

  if (redisClient.isOpen) {
    try {
      const acquired = await redisClient.set(lockKey, 'locked', {
        NX: true,
        EX: 120, // 2-minute lock timeout
      });
      if (!acquired) {
        return { checkedCount: 0, recoveredCount: 0, expiredCount: 0 };
      }
      lockAcquired = true;
    } catch {
      // In case of Redis error, proceed safely
    }
  }

  const result: ReconciliationResult = {
    checkedCount: 0,
    recoveredCount: 0,
    expiredCount: 0,
  };

  try {
    const timeoutThreshold = new Date(
      Date.now() - env.PAYMENT_PENDING_TIMEOUT_MINUTES * 60 * 1000,
    );

    // Find pending/processing payments created before threshold
    const stalePayments = await prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        createdAt: { lte: timeoutThreshold },
      },
      include: { user: true },
      take: 50,
    });

    result.checkedCount = stalePayments.length;

    for (const payment of stalePayments) {
      try {
        const provider = getPaymentProviderInstance(payment.provider);
        const verification = await provider.verifyPayment({
          transactionId: payment.transactionId || payment.id,
          providerTransactionId: payment.providerTransactionId || undefined,
        });

        if (verification.verified && verification.status === PaymentStatus.PAID) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              paidAt: verification.paidAt || new Date(),
              providerTransactionId: verification.providerTransactionId || payment.providerTransactionId,
            },
          });
          result.recoveredCount += 1;
        } else {
          // If past timeout and still unconfirmed, mark as CANCELLED/FAILED
          const expireThreshold = new Date(
            Date.now() - (env.PAYMENT_PENDING_TIMEOUT_MINUTES * 2) * 60 * 1000,
          );
          if (payment.createdAt <= expireThreshold) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.CANCELLED,
                cancelledAt: new Date(),
                failedReason: 'Session timed out without client completion',
              },
            });
            result.expiredCount += 1;
          }
        }
      } catch (err) {
        console.warn(`[Reconciliation] Error reconciling payment ${payment.id}:`, (err as Error).message);
      }
    }
  } finally {
    if (lockAcquired && redisClient.isOpen) {
      try {
        await redisClient.del(lockKey);
      } catch {
        // Ignore lock release error
      }
    }
  }

  return result;
};

/**
 * Starts the periodic payment reconciliation cron job.
 */
export const startPaymentReconciliationCron = (
  intervalMs = env.PAYMENT_RECONCILIATION_INTERVAL_MINUTES * 60 * 1000,
): void => {
  if (process.env.VERCEL === '1') {
    return;
  }
  if (reconciliationTimer) {
    clearInterval(reconciliationTimer);
  }

  // Run initial check after short warmup delay
  setTimeout(() => void reconcileStalePayments(), 10000);

  reconciliationTimer = setInterval(() => {
    void reconcileStalePayments();
  }, intervalMs);

  console.log(`[Reconciliation] Background payment reconciliation service started (interval: ${intervalMs}ms).`);
};

/**
 * Stops the payment reconciliation cron job.
 */
export const stopPaymentReconciliationCron = (): void => {
  if (reconciliationTimer) {
    clearInterval(reconciliationTimer);
    reconciliationTimer = null;
    console.log('[Reconciliation] Background payment reconciliation service stopped.');
  }
};
