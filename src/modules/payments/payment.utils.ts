import crypto from 'node:crypto';
import httpStatus from 'http-status';
import type { PaymentDetailResponse, RefundRecordResponse } from './payment.interface.js';
import { UserRole, PaymentStatus } from '../../generated/prisma/enums.js';
import { PAYMENT_STATUS_TRANSITIONS, PAYMENT_ERROR_CODES } from './payment.constant.js';
import { AppError } from '../../utils/AppError.js';

export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PB-TXN-${timestamp}-${random}`;
};

export const hashPayload = (payload: unknown): string => {
  const normalized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Validates payment state machine transitions according to strict financial rules.
 */
export const validatePaymentTransition = (
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): boolean => {
  if (currentStatus === nextStatus) return true;

  // Cannot jump from SUCCESS/PAID directly to FAILED or CANCELLED
  if (
    (currentStatus === PaymentStatus.PAID || currentStatus === PaymentStatus.SUCCESS) &&
    (nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.CANCELLED)
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Illegal transition from '${currentStatus}' to '${nextStatus}'. Successful payments cannot be cancelled or failed.`,
      PAYMENT_ERROR_CODES.PAYMENT_INVALID_TRANSITION,
    );
  }

  // Terminal state check
  if (currentStatus === PaymentStatus.REFUNDED) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Illegal transition from 'REFUNDED'. Payment is fully refunded and in a terminal state.`,
      PAYMENT_ERROR_CODES.PAYMENT_INVALID_TRANSITION,
    );
  }

  const allowedNext = PAYMENT_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Invalid payment status transition from '${currentStatus}' to '${nextStatus}'`,
      PAYMENT_ERROR_CODES.PAYMENT_INVALID_TRANSITION,
    );
  }

  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toPaymentDetailResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payment: any,
  viewerRole?: UserRole | string,
  isOwner = false,
): PaymentDetailResponse => {
  const canSeeFull = isOwner || viewerRole === UserRole.ADMIN || viewerRole === UserRole.SUPER_ADMIN;

  return {
    id: payment.id,
    userId: payment.userId,
    userName: canSeeFull ? payment.user?.name : undefined,
    userEmail: canSeeFull ? payment.user?.email : undefined,
    bloodRequestId: payment.bloodRequestId || null,
    paymentPurpose: payment.paymentPurpose,
    amount: Number(payment.amount),
    currency: payment.currency,
    provider: payment.provider,
    status: payment.status,
    transactionId: payment.transactionId || null,
    providerTransactionId: canSeeFull ? payment.providerTransactionId || null : null,
    paymentUrl: payment.paymentUrl || null,
    description: payment.description || null,
    refundAmount: Number(payment.refundAmount || 0),
    paidAt: payment.paidAt || null,
    failedAt: payment.failedAt || null,
    cancelledAt: payment.cancelledAt || null,
    refundedAt: payment.refundedAt || null,
    failedReason: payment.failedReason || null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    refunds: canSeeFull && payment.refunds ? payment.refunds.map(toRefundRecordResponse) : undefined,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toRefundRecordResponse = (refund: any): RefundRecordResponse => {
  return {
    id: refund.id,
    paymentId: refund.paymentId,
    amount: Number(refund.amount),
    currency: refund.currency || 'BDT',
    reason: refund.reason || null,
    status: refund.status,
    providerRefundId: refund.providerRefundId || null,
    actorId: refund.actorId || null,
    idempotencyKey: refund.idempotencyKey || null,
    requestedAt: refund.requestedAt || refund.createdAt,
    processedAt: refund.processedAt || null,
    failedAt: refund.failedAt || null,
    failureReason: refund.failureReason || null,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
  };
};
