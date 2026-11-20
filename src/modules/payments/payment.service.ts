import httpStatus from 'http-status';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import {
  PaymentProvider,
  PaymentStatus,
  PaymentPurpose,
  RefundStatus,
  UserRole,
} from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/index.js';
import type {
  InitiatePaymentDTO,
  InitiatePaymentResult,
  PaymentQueryDTO,
  RefundPaymentDTO,
  RefundRecordResponse,
  PaymentDetailResponse,
  PaymentStatisticsResponse,
} from './payment.interface.js';
import {
  PAYMENT_ERROR_CODES,
  PAYMENT_MIN_AMOUNTS,
  PAYMENT_MAX_AMOUNTS,
  SUPPORTED_PROVIDER_CURRENCIES,
} from './payment.constant.js';
import {
  generateTransactionId,
  toPaymentDetailResponse,
  toRefundRecordResponse,
} from './payment.utils.js';
import { SSLCommerzProvider } from './providers/sslcommerz.provider.js';
import { StripeProvider } from './providers/stripe.provider.js';
import {
  sendPaymentSuccessEmail,
  sendPaymentRefundEmail,
} from '../../services/email.service.js';

const sslcommerzProvider = new SSLCommerzProvider();
const stripeProvider = new StripeProvider();

export const getPaymentProviderInstance = (provider: PaymentProvider) => {
  if (provider === PaymentProvider.SSLCOMMERZ) return sslcommerzProvider;
  if (provider === PaymentProvider.STRIPE) return stripeProvider;
  throw new AppError(httpStatus.BAD_REQUEST, `Unsupported payment provider: ${provider}`);
};

/**
 * Initiates a new payment session for voluntary platform support or campaigns.
 */
export const initiatePayment = async (
  data: InitiatePaymentDTO,
  user: AuthUser,
): Promise<InitiatePaymentResult> => {
  const provider = data.provider;
  const currency = (data.currency || (provider === PaymentProvider.SSLCOMMERZ ? 'BDT' : 'USD')).toUpperCase();

  // 1. Currency & provider validation
  const supportedCurrencies = SUPPORTED_PROVIDER_CURRENCIES[provider];
  if (!supportedCurrencies.includes(currency)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Currency '${currency}' is not supported by provider '${provider}'. Supported: ${supportedCurrencies.join(', ')}`,
      PAYMENT_ERROR_CODES.PAYMENT_CURRENCY_MISMATCH
    );
  }

  // 2. Amount validation
  const minAmount = PAYMENT_MIN_AMOUNTS[currency] || 1;
  const maxAmount = PAYMENT_MAX_AMOUNTS[currency] || 500000;
  const amount = Number(data.amount);

  if (isNaN(amount) || amount < minAmount || amount > maxAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Payment amount for ${currency} must be between ${minAmount} and ${maxAmount}`,
      PAYMENT_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH
    );
  }

  // 3. Blood request validation (if voluntary support is attached to a request)
  if (data.bloodRequestId) {
    const bloodRequest = await prisma.bloodRequest.findUnique({
      where: { id: data.bloodRequestId },
    });
    if (!bloodRequest) {
      throw new AppError(httpStatus.NOT_FOUND, 'Referenced blood request not found');
    }
  }

  // 4. Generate internal transaction ID
  const transactionId = generateTransactionId();

  // 5. Build provider callback URLs
  const backendBase = env.BACKEND_URL.replace(/\/+$/, '');
  const frontendBase = env.FRONTEND_URL.replace(/\/+$/, '');

  const callbackUrls =
    provider === PaymentProvider.SSLCOMMERZ
      ? {
          successUrl: `${backendBase}/api/v1/payments/sslcommerz/success`,
          failUrl: `${backendBase}/api/v1/payments/sslcommerz/fail`,
          cancelUrl: `${backendBase}/api/v1/payments/sslcommerz/cancel`,
          ipnUrl: `${backendBase}/api/v1/payments/sslcommerz/ipn`,
        }
      : {
          successUrl: `${frontendBase}/payment/success?session_id={CHECKOUT_SESSION_ID}&transaction_id=${transactionId}`,
          failUrl: `${frontendBase}/payment/fail?transaction_id=${transactionId}`,
          cancelUrl: `${frontendBase}/payment/cancel?transaction_id=${transactionId}`,
        };

  // 6. Record pending payment in database
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      bloodRequestId: data.bloodRequestId || null,
      paymentPurpose: data.paymentPurpose || PaymentPurpose.PLATFORM_SUPPORT,
      amount,
      currency,
      provider,
      status: PaymentStatus.PENDING,
      transactionId,
      description: data.description || 'PulseBridge Voluntary Platform Support',
      metadata: {
        idempotencyKey: data.idempotencyKey || null,
        clientIp: null,
      },
    },
  });

  // 7. Request payment session from provider
  const providerInstance = getPaymentProviderInstance(provider);
  let sessionResult;

  try {
    sessionResult = await providerInstance.initiateSession({
      paymentId: payment.id,
      transactionId,
      amount,
      currency,
      description: payment.description || undefined,
      user: {
        id: user.id,
        name: user.name || 'PulseBridge Supporter',
        email: user.email,
        phone: user.phone,
      },
      callbackUrls,
      metadata: {
        paymentId: payment.id,
        transactionId,
      },
    });
  } catch (err: unknown) {
    // Record initiation failure
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failedReason: err instanceof Error ? err.message : 'Provider session initiation failed',
      },
    });
    throw err;
  }

  // 8. Update payment with session details
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentUrl: sessionResult.paymentUrl,
      paymentSessionId: sessionResult.providerSessionId || null,
      providerTransactionId: sessionResult.providerTransactionId || null,
    },
  });

  return {
    paymentId: updated.id,
    transactionId: updated.transactionId || transactionId,
    provider: updated.provider,
    amount: Number(updated.amount),
    currency: updated.currency,
    status: updated.status,
    paymentUrl: sessionResult.paymentUrl,
  };
};

/**
 * Handles SSLCommerz Success POST Callback from the gateway.
 */
export const handleSSLCommerzSuccess = async (body: Record<string, unknown>) => {
  const tranId = (body.tran_id || body.transaction_id) as string;
  const valId = body.val_id as string;

  if (!tranId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing transaction ID in callback payload');
  }

  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
    include: { user: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for transaction ID');
  }

  // Prevent duplicate processing
  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
    return toPaymentDetailResponse(payment, UserRole.ADMIN, true);
  }

  // Server-to-server validation with SSLCommerz API
  const verification = await sslcommerzProvider.verifyPayment({
    transactionId: tranId,
    valId,
    rawPayload: body,
  });

  if (!verification.verified || verification.status !== PaymentStatus.PAID) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failedReason: verification.failureReason || 'SSLCommerz validation failed',
      },
    });
    throw new AppError(httpStatus.BAD_REQUEST, 'SSLCommerz transaction validation failed');
  }

  // Validate amount consistency
  if (Math.abs(Number(payment.amount) - verification.amount) > 0.01) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Paid amount mismatch with recorded payment');
  }

  const now = new Date();
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PAID,
      paidAt: verification.paidAt || now,
      providerTransactionId: verification.providerTransactionId || valId,
    },
    include: { user: true },
  });

  // Send confirmation email outside transaction
  if (payment.user?.email) {
    sendPaymentSuccessEmail(payment.user.email, {
      name: payment.user.name,
      invoiceId: tranId,
      amount: `${payment.currency} ${Number(payment.amount).toFixed(2)}`,
      purpose: payment.paymentPurpose,
      paymentMethod: 'SSLCommerz',
      date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }).catch((err) => console.warn('[Email] Payment success email dispatch error:', err.message));
  }

  return toPaymentDetailResponse(updated, UserRole.ADMIN, true);
};

/**
 * Handles SSLCommerz Fail POST Callback.
 */
export const handleSSLCommerzFail = async (body: Record<string, unknown>) => {
  const tranId = (body.tran_id || body.transaction_id) as string;
  if (!tranId) return null;

  const payment = await prisma.payment.findUnique({ where: { transactionId: tranId } });
  if (!payment) return null;

  // Never overwrite already successful payments
  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
    return toPaymentDetailResponse(payment, UserRole.ADMIN, true);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      failedReason: String(body.error || 'Payment failed at SSLCommerz gateway'),
    },
  });

  return toPaymentDetailResponse(updated, UserRole.ADMIN, true);
};

/**
 * Handles SSLCommerz Cancel POST Callback.
 */
export const handleSSLCommerzCancel = async (body: Record<string, unknown>) => {
  const tranId = (body.tran_id || body.transaction_id) as string;
  if (!tranId) return null;

  const payment = await prisma.payment.findUnique({ where: { transactionId: tranId } });
  if (!payment) return null;

  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
    return toPaymentDetailResponse(payment, UserRole.ADMIN, true);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.CANCELLED,
      cancelledAt: new Date(),
      failedReason: 'Payment cancelled by user',
    },
  });

  return toPaymentDetailResponse(updated, UserRole.ADMIN, true);
};

/**
 * Handles SSLCommerz IPN (Instant Payment Notification).
 */
export const handleSSLCommerzIPN = async (body: Record<string, unknown>) => {
  const tranId = (body.tran_id || body.transaction_id) as string;
  const valId = body.val_id as string;

  if (!tranId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing transaction ID in IPN payload');
  }

  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
    include: { user: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for IPN transaction ID');
  }

  // Idempotency: if already paid, return early
  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
    return { success: true, message: 'Payment already processed' };
  }

  // Validate via official server API
  const verification = await sslcommerzProvider.verifyPayment({
    transactionId: tranId,
    valId,
    rawPayload: body,
  });

  if (verification.verified && verification.status === PaymentStatus.PAID) {
    const now = new Date();
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: now,
        providerTransactionId: verification.providerTransactionId || valId,
      },
    });

    if (payment.user?.email) {
      sendPaymentSuccessEmail(payment.user.email, {
        name: payment.user.name,
        invoiceId: tranId,
        amount: `${payment.currency} ${Number(payment.amount).toFixed(2)}`,
        purpose: payment.paymentPurpose,
        paymentMethod: 'SSLCommerz IPN',
        date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }).catch((err) => console.warn('[Email] IPN email dispatch error:', err.message));
    }
  }

  return { success: true, verified: verification.verified };
};

/**
 * Handles Stripe webhook events with HMAC signature verification and idempotency check.
 */
export const handleStripeWebhook = async (
  rawBody: Buffer | string,
  signatureHeader: string,
) => {
  // 1. Signature verification
  const isValidSignature = stripeProvider.verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValidSignature) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Stripe webhook signature', PAYMENT_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID);
  }

  const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payloadString);
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, 'Malformed Stripe webhook JSON payload');
  }

  const eventId = String(event.id || '');
  const eventType = String(event.type || '');

  // 2. Webhook idempotency check via database unique event record
  if (eventId) {
    const existingEvent = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
    if (existingEvent) {
      return { received: true, duplicate: true, idempotent: true };
    }

    await prisma.paymentWebhookEvent.create({
      data: {
        eventId,
        provider: PaymentProvider.STRIPE,
        eventType,
        payload: event as any,
      },
    });
  }

  const eventData = (event.data as { object: Record<string, unknown> })?.object || {};

  // 3. Process supported Stripe event types
  if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
    const paymentId = (eventData.metadata as Record<string, string>)?.paymentId;
    const transactionId = (eventData.metadata as Record<string, string>)?.transactionId || (eventData.client_reference_id as string);
    const sessionId = String(eventData.id || '');

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          ...(paymentId ? [{ id: paymentId }] : []),
          ...(transactionId ? [{ transactionId }] : []),
          { paymentSessionId: sessionId },
        ],
      },
      include: { user: true },
    });

    if (payment && payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.SUCCESS) {
      const now = new Date();
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: now,
          providerTransactionId: eventData.payment_intent ? String(eventData.payment_intent) : sessionId,
        },
      });

      if (payment.user?.email) {
        sendPaymentSuccessEmail(payment.user.email, {
          name: payment.user.name,
          invoiceId: payment.transactionId || sessionId,
          amount: `${payment.currency} ${Number(payment.amount).toFixed(2)}`,
          purpose: payment.paymentPurpose,
          paymentMethod: 'Stripe Card',
          date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        }).catch((err) => console.warn('[Email] Stripe success email error:', err.message));
      }

      return { received: true, paymentId: updated.id, status: updated.status };
    }
  } else if (
    eventType === 'checkout.session.async_payment_failed' ||
    eventType === 'payment_intent.payment_failed'
  ) {
    const paymentIntentId = String(eventData.id || '');
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ providerTransactionId: paymentIntentId }, { paymentSessionId: paymentIntentId }],
      },
    });

    if (payment && payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.SUCCESS) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failedReason: 'Stripe payment failed',
        },
      });
    }
  }

  return { received: true };
};

/**
 * Reconciles and verifies a payment status directly with the upstream provider.
 */
export const verifyPaymentById = async (
  paymentId: string,
  actor: AuthUser,
): Promise<PaymentDetailResponse> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, refunds: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment record not found', PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND);
  }

  const isOwner = payment.userId === actor.id;
  const isAdmin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to view or verify this payment', PAYMENT_ERROR_CODES.PAYMENT_NOT_AUTHORIZED);
  }

  // If already paid, return reconciled status
  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
    return toPaymentDetailResponse(payment, actor.role, isOwner);
  }

  // Call provider validation
  const provider = getPaymentProviderInstance(payment.provider);
  const verification = await provider.verifyPayment({
    transactionId: payment.transactionId || '',
    providerTransactionId: payment.providerTransactionId || undefined,
    sessionReference: payment.paymentSessionId || undefined,
  });

  if (verification.verified && verification.status === PaymentStatus.PAID) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: verification.paidAt || new Date(),
        providerTransactionId: verification.providerTransactionId || payment.providerTransactionId,
      },
      include: { user: true, refunds: true },
    });
    return toPaymentDetailResponse(updated, actor.role, isOwner);
  }

  return toPaymentDetailResponse(payment, actor.role, isOwner);
};

/**
 * Executes a refund on a paid payment (Admin only).
 */
export const refundPayment = async (
  paymentId: string,
  actor: AuthUser,
  data: RefundPaymentDTO,
): Promise<PaymentDetailResponse> => {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only authorized administrators can initiate refunds', PAYMENT_ERROR_CODES.PAYMENT_NOT_AUTHORIZED);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { refunds: true, user: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found', PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND);
  }

  if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.SUCCESS && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
    throw new AppError(httpStatus.BAD_REQUEST, `Cannot refund a payment with status '${payment.status}'`, PAYMENT_ERROR_CODES.REFUND_NOT_ALLOWED);
  }

  const totalPaid = Number(payment.amount);
  const currentRefunded = Number(payment.refundAmount || 0);
  const refundableRemaining = Math.max(0, totalPaid - currentRefunded);

  if (refundableRemaining <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment is already fully refunded', PAYMENT_ERROR_CODES.PAYMENT_ALREADY_REFUNDED);
  }

  const refundAmount = data.amount ? Number(data.amount) : refundableRemaining;

  if (isNaN(refundAmount) || refundAmount <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid refund amount requested');
  }

  if (refundAmount > refundableRemaining + 0.001) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Requested refund amount (${refundAmount}) exceeds refundable remaining balance (${refundableRemaining.toFixed(2)})`,
      PAYMENT_ERROR_CODES.REFUND_AMOUNT_EXCEEDED
    );
  }

  // Execute provider refund call
  const provider = getPaymentProviderInstance(payment.provider);
  const refundResult = await provider.processRefund({
    payment: {
      id: payment.id,
      transactionId: payment.transactionId,
      providerTransactionId: payment.providerTransactionId,
      amount: totalPaid,
      currency: payment.currency,
      paymentSessionId: payment.paymentSessionId,
    },
    refundAmount,
    reason: data.reason,
  });

  if (!refundResult.success) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Provider refund processing failed: ${refundResult.failureReason || 'Provider rejected refund'}`,
      PAYMENT_ERROR_CODES.REFUND_PROCESSING_FAILED
    );
  }

  const now = new Date();
  const nextRefundedAmount = currentRefunded + refundAmount;
  const nextStatus = nextRefundedAmount >= totalPaid - 0.001 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

  const result = await prisma.$transaction(async (tx) => {
    // Record refund entity
    await tx.paymentRefund.create({
      data: {
        paymentId: payment.id,
        amount: refundAmount,
        reason: data.reason,
        status: refundResult.status,
        providerRefundId: refundResult.providerRefundId || null,
        actorId: actor.id,
      },
    });

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        refundAmount: nextRefundedAmount,
        refundedAt: now,
      },
      include: { refunds: true, user: true },
    });

    return updatedPayment;
  });

  // Send refund notification email if recipient email is available
  if (result.user?.email) {
    sendPaymentRefundEmail(result.user.email, {
      name: result.user.name,
      invoiceId: result.transactionId || result.id,
      amount: `${result.currency} ${Number(refundAmount).toFixed(2)}`,
      totalRefunded: `${result.currency} ${Number(result.refundAmount).toFixed(2)}`,
      reason: data.reason,
      status: nextStatus,
      date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }).catch((err) => console.warn('[Email] Payment refund email dispatch error:', err.message));
  }

  return toPaymentDetailResponse(result, actor.role, true);
};

/**
 * Retrieves payment details by ID with ownership enforcement.
 */
export const getPaymentById = async (
  paymentId: string,
  actor: AuthUser,
): Promise<PaymentDetailResponse> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, refunds: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found', PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND);
  }

  const isOwner = payment.userId === actor.id;
  const isAdmin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to view this payment', PAYMENT_ERROR_CODES.PAYMENT_NOT_AUTHORIZED);
  }

  return toPaymentDetailResponse(payment, actor.role, isOwner);
};

/**
 * Retrieves paginated payments for the authenticated user.
 */
export const getMyPayments = async (
  query: PaymentQueryDTO,
  user: AuthUser,
): Promise<{ data: PaymentDetailResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
  return queryPayments({ ...query, userId: user.id }, user.role, true);
};

/**
 * Retrieves paginated payments for administrators with multi-attribute filtering.
 */
export const getAdminPayments = async (
  query: PaymentQueryDTO,
  actor?: AuthUser,
): Promise<{ data: PaymentDetailResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
  const role = actor?.role || UserRole.ADMIN;
  return queryPayments(query, role, true);
};

/**
 * General paginated query helper for payments.
 */
const queryPayments = async (
  query: PaymentQueryDTO,
  viewerRole: UserRole,
  isPrivileged: boolean,
) => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (query.userId) where.userId = query.userId;
  if (query.status) where.status = query.status;
  if (query.provider) where.provider = query.provider;
  if (query.paymentPurpose) where.paymentPurpose = query.paymentPurpose;
  if (query.currency) where.currency = query.currency.toUpperCase();
  if (query.transactionId) where.transactionId = { contains: query.transactionId, mode: 'insensitive' };

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.amount = {};
    if (query.minAmount !== undefined) where.amount.gte = query.minAmount;
    if (query.maxAmount !== undefined) where.amount.lte = query.maxAmount;
  }

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { user: true, refunds: true },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: payments.map((p) => toPaymentDetailResponse(p, viewerRole, isPrivileged)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Aggregates payment statistics grouped by currency and provider (never mixes currencies).
 */
export const getAdminPaymentStatistics = async (): Promise<PaymentStatisticsResponse> => {
  const [totalPayments, successfulPayments, pendingPayments, failedPayments, refundedPayments, allPayments] =
    await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] } } }),
      prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      prisma.payment.count({ where: { status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] } } }),
      prisma.payment.findMany({
        select: {
          amount: true,
          currency: true,
          provider: true,
          status: true,
          refundAmount: true,
        },
      }),
    ]);

  const currencyBreakdown: Record<
    string,
    { successfulAmount: number; refundedAmount: number; netAmount: number; transactionCount: number }
  > = {};

  const providerBreakdown: Record<
    PaymentProvider,
    { totalCount: number; successfulCount: number; currencyTotals: Record<string, number> }
  > = {
    [PaymentProvider.SSLCOMMERZ]: { totalCount: 0, successfulCount: 0, currencyTotals: {} },
    [PaymentProvider.STRIPE]: { totalCount: 0, successfulCount: 0, currencyTotals: {} },
  };

  for (const p of allPayments) {
    const cur = p.currency.toUpperCase();
    if (!currencyBreakdown[cur]) {
      currencyBreakdown[cur] = {
        successfulAmount: 0,
        refundedAmount: 0,
        netAmount: 0,
        transactionCount: 0,
      };
    }

    currencyBreakdown[cur].transactionCount += 1;

    const isSuccess = p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS;
    const isRefund = p.status === PaymentStatus.REFUNDED || p.status === PaymentStatus.PARTIALLY_REFUNDED;

    const amt = Number(p.amount);
    const refAmt = Number(p.refundAmount || 0);

    if (isSuccess || isRefund) {
      currencyBreakdown[cur].successfulAmount += amt;
      currencyBreakdown[cur].refundedAmount += refAmt;
      currencyBreakdown[cur].netAmount += amt - refAmt;
    }

    // Provider breakdown
    const prov = p.provider;
    if (providerBreakdown[prov]) {
      providerBreakdown[prov].totalCount += 1;
      if (isSuccess || isRefund) {
        providerBreakdown[prov].successfulCount += 1;
        providerBreakdown[prov].currencyTotals[cur] = (providerBreakdown[prov].currencyTotals[cur] || 0) + amt;
      }
    }
  }

  return {
    overview: {
      totalPayments,
      successfulPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
    },
    currencyBreakdown,
    providerBreakdown,
  };
};

/**
 * Retrieves refund records for a payment.
 */
export const getPaymentRefunds = async (
  paymentId: string,
  actor: AuthUser,
): Promise<RefundRecordResponse[]> => {
  const payment = await getPaymentById(paymentId, actor);
  return payment.refunds || [];
};

