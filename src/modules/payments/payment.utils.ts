import crypto from 'node:crypto';
import type { PaymentDetailResponse, RefundRecordResponse } from './payment.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PB-TXN-${timestamp}-${random}`;
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
    reason: refund.reason || null,
    status: refund.status,
    providerRefundId: refund.providerRefundId || null,
    actorId: refund.actorId || null,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
  };
};
