import { PaymentProvider, PaymentStatus, PaymentPurpose } from '../../generated/prisma/enums.js';

export const SUPPORTED_PROVIDER_CURRENCIES: Record<PaymentProvider, string[]> = {
  [PaymentProvider.SSLCOMMERZ]: ['BDT'],
  [PaymentProvider.STRIPE]: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BDT'],
};

export const PAYMENT_MIN_AMOUNTS: Record<string, number> = {
  BDT: 10,
  USD: 1,
  EUR: 1,
  GBP: 1,
  CAD: 1,
  AUD: 1,
};

export const PAYMENT_MAX_AMOUNTS: Record<string, number> = {
  BDT: 500000,
  USD: 5000,
  EUR: 5000,
  GBP: 5000,
  CAD: 5000,
  AUD: 5000,
};

export const PAYMENT_ERROR_CODES = {
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_COMPLETED: 'PAYMENT_ALREADY_COMPLETED',
  PAYMENT_SESSION_CREATION_FAILED: 'PAYMENT_SESSION_CREATION_FAILED',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_CURRENCY_MISMATCH: 'PAYMENT_CURRENCY_MISMATCH',
  PAYMENT_NOT_AUTHORIZED: 'PAYMENT_NOT_AUTHORIZED',
  PAYMENT_ALREADY_REFUNDED: 'PAYMENT_ALREADY_REFUNDED',
  REFUND_NOT_ALLOWED: 'REFUND_NOT_ALLOWED',
  REFUND_AMOUNT_EXCEEDED: 'REFUND_AMOUNT_EXCEEDED',
  REFUND_PROCESSING_FAILED: 'REFUND_PROCESSING_FAILED',
  INVALID_PAYMENT_PROVIDER: 'INVALID_PAYMENT_PROVIDER',
  INVALID_PAYMENT_STATUS: 'INVALID_PAYMENT_STATUS',
  DUPLICATE_WEBHOOK_EVENT: 'DUPLICATE_WEBHOOK_EVENT',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
} as const;

export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.PAID,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.PROCESSING]: [
    PaymentStatus.PAID,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.PAID]: [
    PaymentStatus.REFUND_PENDING,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.SUCCESS]: [
    PaymentStatus.REFUND_PENDING,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.REFUND_PENDING]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
    PaymentStatus.PAID,
    PaymentStatus.SUCCESS,
  ],
  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.REFUND_PENDING,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
};
