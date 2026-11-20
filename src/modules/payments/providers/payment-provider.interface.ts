import type { PaymentProvider, PaymentStatus, RefundStatus } from '../../../generated/prisma/enums.js';

export interface ProviderInitiateParams {
  paymentId: string;
  transactionId: string;
  amount: number;
  currency: string;
  description?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  callbackUrls: {
    successUrl: string;
    failUrl: string;
    cancelUrl: string;
    ipnUrl?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ProviderInitiateResult {
  paymentUrl: string;
  providerSessionId?: string;
  providerTransactionId?: string;
  rawResponse?: unknown;
}

export interface ProviderVerifyParams {
  transactionId: string;
  providerTransactionId?: string;
  valId?: string;
  sessionReference?: string;
  rawPayload?: Record<string, unknown>;
}

export interface ProviderVerifyResult {
  verified: boolean;
  status: PaymentStatus;
  providerTransactionId?: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  rawResponse?: unknown;
  failureReason?: string;
}

export interface ProviderRefundParams {
  payment: {
    id: string;
    transactionId: string | null;
    providerTransactionId: string | null;
    amount: number;
    currency: string;
    paymentSessionId: string | null;
  };
  refundAmount: number;
  reason: string;
}

export interface ProviderRefundResult {
  success: boolean;
  status: RefundStatus;
  providerRefundId?: string;
  amount: number;
  rawResponse?: unknown;
  failureReason?: string;
}

export interface IPaymentProvider {
  readonly provider: PaymentProvider;
  initiateSession(params: ProviderInitiateParams): Promise<ProviderInitiateResult>;
  verifyPayment(params: ProviderVerifyParams): Promise<ProviderVerifyResult>;
  processRefund(params: ProviderRefundParams): Promise<ProviderRefundResult>;
}
