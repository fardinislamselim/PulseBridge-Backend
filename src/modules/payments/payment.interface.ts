import type {
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  RefundStatus,
} from '../../generated/prisma/enums.js';

export interface InitiatePaymentDTO {
  provider: PaymentProvider;
  paymentPurpose?: PaymentPurpose;
  amount: number;
  currency?: string;
  description?: string;
  bloodRequestId?: string;
  idempotencyKey?: string;
}

export interface InitiatePaymentResult {
  paymentId: string;
  transactionId: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentUrl: string;
}

export interface PaymentQueryDTO {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: PaymentStatus;
  provider?: PaymentProvider;
  paymentPurpose?: PaymentPurpose;
  currency?: string;
  transactionId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface RefundPaymentDTO {
  amount?: number;
  reason: string;
  idempotencyKey?: string;
}

export interface RefundQueryDTO {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: RefundStatus;
  paymentId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface RefundRecordResponse {
  id: string;
  paymentId: string;
  amount: number;
  currency?: string;
  reason: string | null;
  status: RefundStatus;
  providerRefundId: string | null;
  actorId: string | null;
  idempotencyKey?: string | null;
  requestedAt?: Date;
  processedAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundDetailResponse extends RefundRecordResponse {
  payment?: {
    id: string;
    transactionId: string | null;
    amount: number;
    currency: string;
    userId: string;
  };
}

export interface PaymentDetailResponse {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  bloodRequestId?: string | null;
  paymentPurpose: PaymentPurpose;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  transactionId: string | null;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  description: string | null;
  refundAmount: number;
  paidAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  refunds?: RefundRecordResponse[];
}

export interface PaymentStatisticsResponse {
  overview: {
    totalPayments: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    refundedPayments: number;
  };
  currencyBreakdown: Record<
    string,
    {
      successfulAmount: number;
      refundedAmount: number;
      netAmount: number;
      transactionCount: number;
    }
  >;
  providerBreakdown: Record<
    PaymentProvider,
    {
      totalCount: number;
      successfulCount: number;
      currencyTotals: Record<string, number>;
    }
  >;
}
