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
  NotificationType,
  IdempotencyOperation,
} from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/index.js';
import type {
  InitiatePaymentDTO,
  InitiatePaymentResult,
  PaymentQueryDTO,
  RefundPaymentDTO,
  RefundQueryDTO,
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
  validatePaymentTransition,
} from './payment.utils.js';
import { SSLCommerzProvider } from './providers/sslcommerz.provider.js';
import { StripeProvider } from './providers/stripe.provider.js';
import {
  sendPaymentSuccessEmail,
  sendPaymentRefundEmail,
} from '../../services/email.service.js';
import { createNotification } from '../../services/notification.service.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { checkIdempotency, saveIdempotency } from './payment-idempotency.service.js';
import {
  recordWebhookEvent,
  claimWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  markWebhookIgnored,
} from './payment-webhook.service.js';

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
  // Idempotency check if idempotencyKey provided
  if (data.idempotencyKey) {
    const idemp = await checkIdempotency(
      data.idempotencyKey,
      IdempotencyOperation.PAYMENT_INITIATION,
      data,
      user.id,
    );
    if (idemp.hit) {
      return idemp.body as InitiatePaymentResult;
    }
  }

  const provider = data.provider;
  const currency = (data.currency || (provider === PaymentProvider.SSLCOMMERZ ? 'BDT' : 'USD')).toUpperCase();

  // 1. Currency & provider validation
  const supportedCurrencies = SUPPORTED_PROVIDER_CURRENCIES[provider];
  if (!supportedCurrencies.includes(currency)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Currency '${currency}' is not supported by provider '${provider}'. Supported: ${supportedCurrencies.join(', ')}`,
      PAYMENT_ERROR_CODES.PAYMENT_CURRENCY_MISMATCH,
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
      PAYMENT_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
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
          successUrl: `${frontendBase}/payment/success?transactionId=${transactionId}`,
          failUrl: `${frontendBase}/payment/failed?transactionId=${transactionId}`,
          cancelUrl: `${frontendBase}/payment/cancelled?transactionId=${transactionId}`,
        };

  // 6. Pre-create PENDING payment record in database
  const createdPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      bloodRequestId: data.bloodRequestId || null,
      paymentPurpose: data.paymentPurpose || PaymentPurpose.PLATFORM_SUPPORT,
      amount,
      currency,
      provider,
      status: PaymentStatus.PENDING,
      transactionId,
      description: data.description || 'Voluntary Platform Contribution',
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: 'PAYMENT_CREATED',
    entity: 'Payment',
    entityId: createdPayment.id,
    metadata: { provider, amount, currency, transactionId },
  });

  // 7. Call provider session initiation
  const providerInstance = getPaymentProviderInstance(provider);
  let sessionResult;
  try {
    sessionResult = await providerInstance.initiateSession({
      paymentId: createdPayment.id,
      transactionId,
      amount,
      currency,
      description: data.description,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      callbackUrls,
      metadata: {
        paymentId: createdPayment.id,
        userId: user.id,
        purpose: data.paymentPurpose || PaymentPurpose.PLATFORM_SUPPORT,
      },
    });
  } catch (err: unknown) {
    await prisma.payment.update({
      where: { id: createdPayment.id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failedReason: (err as Error).message || 'Provider session initiation failed',
      },
    });
    throw err;
  }

  // 8. Update payment record with provider session references
  const updated = await prisma.payment.update({
    where: { id: createdPayment.id },
    data: {
      paymentUrl: sessionResult.paymentUrl,
      paymentSessionId: sessionResult.providerSessionId || null,
      providerTransactionId: sessionResult.providerTransactionId || null,
      status: PaymentStatus.PENDING,
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: 'PAYMENT_SESSION_CREATED',
    entity: 'Payment',
    entityId: updated.id,
    metadata: { paymentUrl: sessionResult.paymentUrl, sessionId: sessionResult.providerSessionId },
  });

  const result: InitiatePaymentResult = {
    paymentId: updated.id,
    transactionId: updated.transactionId || transactionId,
    provider: updated.provider,
    amount: Number(updated.amount),
    currency: updated.currency,
    status: updated.status,
    paymentUrl: sessionResult.paymentUrl,
  };

  if (data.idempotencyKey) {
    await saveIdempotency(
      data.idempotencyKey,
      IdempotencyOperation.PAYMENT_INITIATION,
      data,
      httpStatus.CREATED,
      result,
      user.id,
      updated.id,
    );
  }

  return result;
};

/**
 * Provider-specific verification for SSLCommerz.
 */
export const verifySSLCommerzPayment = async (
  tranId: string,
  valId?: string,
  rawPayload?: Record<string, unknown>,
) => {
  const provider = getPaymentProviderInstance(PaymentProvider.SSLCOMMERZ);
  return provider.verifyPayment({
    transactionId: tranId,
    valId,
    rawPayload,
  });
};

/**
 * Provider-specific verification for Stripe.
 */
export const verifyStripePayment = async (
  sessionIdOrPaymentIntentId: string,
  transactionId?: string,
) => {
  const provider = getPaymentProviderInstance(PaymentProvider.STRIPE);
  return provider.verifyPayment({
    transactionId: transactionId || '',
    sessionReference: sessionIdOrPaymentIntentId,
    providerTransactionId: sessionIdOrPaymentIntentId.startsWith('pi_') ? sessionIdOrPaymentIntentId : undefined,
  });
};

/**
 * Atomically processes verified payment success within a database transaction.
 * Strictly executes external email and notification dispatches POST-COMMIT.
 */
export const processVerifiedPayment = async (
  paymentId: string,
  verification: {
    verified: boolean;
    status: PaymentStatus;
    providerTransactionId?: string;
    amount: number;
    currency: string;
    paidAt?: Date;
    failureReason?: string;
    rawResponse?: unknown;
  },
  actorId?: string,
): Promise<PaymentDetailResponse> => {
  const now = new Date();

  // 1. Transactional state progression
  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { user: true, refunds: true },
    });

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment record not found', PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND);
    }

    // Already completed: idempotent return
    if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    // If verification was not successful, update to FAILED conditionally
    if (!verification.verified || (verification.status !== PaymentStatus.PAID && verification.status !== PaymentStatus.SUCCESS)) {
      validatePaymentTransition(payment.status, PaymentStatus.FAILED);
      const failed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: now,
          failedReason: verification.failureReason || 'Provider verification rejected transaction',
        },
        include: { user: true, refunds: true },
      });
      return failed;
    }

    // Validate expected amount against verified amount (tolerance 0.01)
    if (Math.abs(Number(payment.amount) - verification.amount) > 0.01) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Payment amount mismatch: expected ${payment.amount}, verified ${verification.amount}`,
        PAYMENT_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
      );
    }

    // Validate expected currency against verified currency
    if (payment.currency.toUpperCase() !== verification.currency.toUpperCase()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Payment currency mismatch: expected ${payment.currency}, verified ${verification.currency}`,
        PAYMENT_ERROR_CODES.PAYMENT_CURRENCY_MISMATCH,
      );
    }

    // Validate transition
    validatePaymentTransition(payment.status, PaymentStatus.PAID);

    const paid = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: verification.paidAt || now,
        providerTransactionId: verification.providerTransactionId || payment.providerTransactionId,
      },
      include: { user: true, refunds: true },
    });

    return paid;
  });

  // 2. Post-commit operations (Emails, In-App Notifications, Audit Logs)
  if (updated.status === PaymentStatus.PAID || updated.status === PaymentStatus.SUCCESS) {
    await logAuditEvent({
      actorId: actorId || updated.userId,
      action: 'PAYMENT_SUCCEEDED',
      entity: 'Payment',
      entityId: updated.id,
      metadata: {
        amount: Number(updated.amount),
        currency: updated.currency,
        provider: updated.provider,
        transactionId: updated.transactionId,
        providerTransactionId: updated.providerTransactionId,
      },
    });

    if (updated.user?.email) {
      sendPaymentSuccessEmail(updated.user.email, {
        name: updated.user.name,
        invoiceId: updated.transactionId || updated.id,
        amount: `${updated.currency} ${Number(updated.amount).toFixed(2)}`,
        purpose: updated.paymentPurpose,
        paymentMethod: updated.provider === PaymentProvider.SSLCOMMERZ ? 'SSLCommerz' : 'Stripe Card',
        date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }).catch((err) => console.warn('[Email] Success email dispatch error:', err.message));
    }

    createNotification({
      userId: updated.userId,
      type: NotificationType.PAYMENT,
      title: 'Payment Successful',
      message: `Your payment of ${updated.currency} ${Number(updated.amount).toFixed(2)} for ${updated.paymentPurpose} was processed successfully. Thank you for supporting PulseBridge!`,
      metadata: { paymentId: updated.id, transactionId: updated.transactionId },
    }).catch(() => {});
  } else if (updated.status === PaymentStatus.FAILED) {
    await logAuditEvent({
      actorId: actorId || updated.userId,
      action: 'PAYMENT_FAILED',
      entity: 'Payment',
      entityId: updated.id,
      metadata: { paymentId: updated.id, reason: updated.failedReason },
    });
  }

  return toPaymentDetailResponse(updated, UserRole.ADMIN, true);
};

/**
 * Reconciles and verifies a payment status directly with the upstream provider.
 * Supports identifier as either PostgreSQL primary key `id` OR gateway `transactionId`.
 */
export const verifyPayment = async (
  paymentIdOrTransactionId: string,
  actor: AuthUser,
  idempotencyKey?: string,
): Promise<PaymentDetailResponse> => {
  // Check idempotency if key provided
  if (idempotencyKey) {
    const idemp = await checkIdempotency(
      idempotencyKey,
      IdempotencyOperation.PAYMENT_VERIFICATION,
      { paymentId: paymentIdOrTransactionId },
      actor.id,
    );
    if (idemp.hit) {
      return idemp.body as PaymentDetailResponse;
    }
  }

  // Lookup payment by id OR transactionId
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { id: paymentIdOrTransactionId },
        { transactionId: paymentIdOrTransactionId },
      ],
    },
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
    const res = toPaymentDetailResponse(payment, actor.role, isOwner);
    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, IdempotencyOperation.PAYMENT_VERIFICATION, { paymentId: payment.id }, httpStatus.OK, res, actor.id, payment.id);
    }
    return res;
  }

  await logAuditEvent({
    actorId: actor.id,
    action: 'PAYMENT_VERIFICATION_STARTED',
    entity: 'Payment',
    entityId: payment.id,
  });

  // Call provider validation
  const provider = getPaymentProviderInstance(payment.provider);
  let verification = await provider.verifyPayment({
    transactionId: payment.transactionId || '',
    providerTransactionId: payment.providerTransactionId || undefined,
    sessionReference: payment.paymentSessionId || undefined,
  });

  // If running in development/sandbox and provider verification returned PENDING due to localhost IPN unreachable,
  // safely validate if in dev environment or sandbox simulation
  if (
    !verification.verified &&
    env.NODE_ENV !== 'production' &&
    (verification.status === PaymentStatus.PENDING || !env.SSLCOMMERZ_IS_LIVE)
  ) {
    verification = {
      verified: true,
      status: PaymentStatus.PAID,
      providerTransactionId: payment.providerTransactionId || `sim-verify-${payment.transactionId}`,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: new Date(),
      rawResponse: { devModeAutoVerified: true },
    };
  }

  const result = await processVerifiedPayment(payment.id, verification, actor.id);

  if (idempotencyKey) {
    await saveIdempotency(idempotencyKey, IdempotencyOperation.PAYMENT_VERIFICATION, { paymentId: payment.id }, httpStatus.OK, result, actor.id, payment.id);
  }

  return result;
};

export const verifyPaymentById = verifyPayment;

/**
 * Reconciles payment status against provider gateway.
 */
export const reconcilePaymentStatus = async (paymentId: string): Promise<PaymentDetailResponse> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, refunds: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for reconciliation', PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND);
  }

  const provider = getPaymentProviderInstance(payment.provider);
  const verification = await provider.verifyPayment({
    transactionId: payment.transactionId || '',
    providerTransactionId: payment.providerTransactionId || undefined,
    sessionReference: payment.paymentSessionId || undefined,
  });

  if (verification.verified && (verification.status === PaymentStatus.PAID || verification.status === PaymentStatus.SUCCESS)) {
    const res = await processVerifiedPayment(payment.id, verification);
    await logAuditEvent({
      action: 'PAYMENT_RECONCILED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: { reconciledStatus: 'PAID' },
    });
    return res;
  }

  return toPaymentDetailResponse(payment, UserRole.ADMIN, true);
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
  const verification = await verifySSLCommerzPayment(tranId, valId, body);
  return processVerifiedPayment(payment.id, verification);
};

/**
 * Handles SSLCommerz Fail POST Callback.
 */
export const handleSSLCommerzFail = async (body: Record<string, unknown>) => {
  const tranId = (body.tran_id || body.transaction_id) as string;
  if (!tranId) return null;

  const payment = await prisma.payment.findUnique({ where: { transactionId: tranId } });
  if (!payment) return null;

  // Never overwrite already successful or paid payment
  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS) {
    return toPaymentDetailResponse(payment, UserRole.ADMIN, true);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      failedReason: String(body.error || body.failedreason || 'Payment failed at SSLCommerz'),
    },
  });

  await logAuditEvent({
    action: 'PAYMENT_FAILED',
    entity: 'Payment',
    entityId: updated.id,
    metadata: { reason: updated.failedReason },
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

  // Never overwrite already successful or paid payment
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

  await logAuditEvent({
    action: 'PAYMENT_CANCELLED',
    entity: 'Payment',
    entityId: updated.id,
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

  const ipnEventId = valId ? `ssl_ipn_${valId}` : `ssl_ipn_${tranId}_${Date.now()}`;
  const { isDuplicate } = await recordWebhookEvent(
    PaymentProvider.SSLCOMMERZ,
    ipnEventId,
    'sslcommerz.ipn',
    body,
    payment.id,
  );

  if (isDuplicate) {
    return { success: true, message: 'Duplicate IPN event' };
  }

  await claimWebhookEvent(ipnEventId);

  // Validate via official server API
  const verification = await verifySSLCommerzPayment(tranId, valId, body);

  if (verification.verified && verification.status === PaymentStatus.PAID) {
    await processVerifiedPayment(payment.id, verification);
    await markWebhookProcessed(ipnEventId, payment.id);
  } else if (verification.status === PaymentStatus.PENDING) {
    // Transient network failure: keep event for retry without failing payment
    await markWebhookFailed(ipnEventId, verification.failureReason || 'Transient IPN validation failure', false);
  } else {
    await markWebhookFailed(ipnEventId, verification.failureReason || 'IPN validation failed', true);
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

  // 2. Durable webhook event registration & idempotency check
  if (eventId) {
    const { isDuplicate } = await recordWebhookEvent(
      PaymentProvider.STRIPE,
      eventId,
      eventType,
      event,
    );

    if (isDuplicate) {
      return { received: true, duplicate: true, idempotent: true };
    }

    const claimed = await claimWebhookEvent(eventId);
    if (!claimed) {
      return { received: true, duplicate: true, inFlight: true };
    }
  }

  const eventData = (event.data as { object: Record<string, unknown> })?.object || {};

  try {
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

      if (payment) {
        const verification = {
          verified: true,
          status: PaymentStatus.PAID,
          providerTransactionId: eventData.payment_intent ? String(eventData.payment_intent) : sessionId,
          amount: Number(eventData.amount_total || 0) / 100,
          currency: String(eventData.currency || 'USD').toUpperCase(),
          paidAt: new Date(),
        };

        const updated = await processVerifiedPayment(payment.id, verification);
        if (eventId) await markWebhookProcessed(eventId, payment.id);
        return { received: true, paymentId: updated.id, status: updated.status };
      }
    } else if (eventType === 'payment_intent.succeeded') {
      const piId = String(eventData.id || '');
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [{ providerTransactionId: piId }, { paymentSessionId: piId }],
        },
      });

      if (payment) {
        const verification = {
          verified: true,
          status: PaymentStatus.PAID,
          providerTransactionId: piId,
          amount: Number(eventData.amount || 0) / 100,
          currency: String(eventData.currency || 'USD').toUpperCase(),
          paidAt: new Date(),
        };

        const updated = await processVerifiedPayment(payment.id, verification);
        if (eventId) await markWebhookProcessed(eventId, payment.id);
        return { received: true, paymentId: updated.id, status: updated.status };
      }
    } else if (
      eventType === 'checkout.session.async_payment_failed' ||
      eventType === 'payment_intent.payment_failed'
    ) {
      const targetId = String(eventData.id || '');
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [{ providerTransactionId: targetId }, { paymentSessionId: targetId }],
        },
      });

      if (payment && payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.SUCCESS) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failedReason: 'Stripe payment failed event received',
          },
        });
      }
      if (eventId) await markWebhookProcessed(eventId, payment?.id);
    } else if (eventType === 'charge.refunded' || eventType === 'charge.refund.updated') {
      const piId = eventData.payment_intent ? String(eventData.payment_intent) : String(eventData.id || '');
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [{ providerTransactionId: piId }, { paymentSessionId: piId }],
        },
      });

      if (payment) {
        const amountRefunded = Number(eventData.amount_refunded || 0) / 100;
        const totalPaid = Number(payment.amount);
        const nextStatus = amountRefunded >= totalPaid - 0.001 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: nextStatus,
            refundAmount: amountRefunded,
            refundedAt: new Date(),
          },
        });
        if (eventId) await markWebhookProcessed(eventId, payment.id);
        return { received: true, paymentId: payment.id, status: nextStatus };
      }
    } else {
      if (eventId) await markWebhookIgnored(eventId, `Unhandled event type: ${eventType}`);
    }

    if (eventId) await markWebhookProcessed(eventId);
    return { received: true };
  } catch (err) {
    if (eventId) await markWebhookFailed(eventId, (err as Error).message);
    throw err;
  }
};

/**
 * Concurrency-safe atomic refund execution preventing over-refunds.
 */
export const refundPayment = async (
  paymentId: string,
  actor: AuthUser,
  data: RefundPaymentDTO,
): Promise<PaymentDetailResponse> => {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only authorized administrators can initiate refunds', PAYMENT_ERROR_CODES.PAYMENT_NOT_AUTHORIZED);
  }

  // 1. Idempotency check
  if (data.idempotencyKey) {
    const idemp = await checkIdempotency(
      data.idempotencyKey,
      IdempotencyOperation.REFUND_INITIATION,
      { paymentId, amount: data.amount, reason: data.reason },
      actor.id,
    );
    if (idemp.hit) {
      return idemp.body as PaymentDetailResponse;
    }
  }

  // 2. Phase 1: Database transaction to reserve refund amount and record PROCESSING refund
  const { payment, refundRecord, refundAmount } = await prisma.$transaction(async (tx) => {
    // Acquire PostgreSQL exclusive row lock to serialize concurrent refund requests
    await tx.$queryRawUnsafe(`SELECT "id" FROM "payments" WHERE "id" = $1 FOR UPDATE`, paymentId);

    const p = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, user: true },
    });

    if (!p) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment not found', PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND);
    }

    if (
      p.status !== PaymentStatus.PAID &&
      p.status !== PaymentStatus.SUCCESS &&
      p.status !== PaymentStatus.PARTIALLY_REFUNDED &&
      p.status !== PaymentStatus.REFUND_PENDING
    ) {
      throw new AppError(httpStatus.BAD_REQUEST, `Cannot refund a payment with status '${p.status}'`, PAYMENT_ERROR_CODES.REFUND_NOT_ALLOWED);
    }

    const totalPaid = Number(p.amount);
    // Active reservations = SUCCEEDED + PROCESSING + PENDING
    const activeRefunds = p.refunds.filter(
      (r) =>
        r.status === RefundStatus.SUCCESS ||
        r.status === RefundStatus.SUCCEEDED ||
        r.status === RefundStatus.PROCESSING ||
        r.status === RefundStatus.PENDING,
    );
    const totalReserved = activeRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const refundableRemaining = Math.max(0, totalPaid - totalReserved);

    if (refundableRemaining <= 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment is already fully refunded or has pending refund reservations', PAYMENT_ERROR_CODES.PAYMENT_ALREADY_REFUNDED);
    }

    const amountToRefund = data.amount ? Number(data.amount) : refundableRemaining;

    if (isNaN(amountToRefund) || amountToRefund <= 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid refund amount requested', PAYMENT_ERROR_CODES.REFUND_AMOUNT_INVALID);
    }

    if (amountToRefund > refundableRemaining + 0.001) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Requested refund amount (${amountToRefund}) exceeds available refundable balance (${refundableRemaining.toFixed(2)})`,
        PAYMENT_ERROR_CODES.REFUND_AMOUNT_EXCEEDED,
      );
    }

    // Create refund reservation record with PROCESSING status
    const refund = await tx.paymentRefund.create({
      data: {
        paymentId: p.id,
        amount: amountToRefund,
        currency: p.currency,
        reason: data.reason,
        status: RefundStatus.PROCESSING,
        actorId: actor.id,
        idempotencyKey: data.idempotencyKey || null,
        requestedAt: new Date(),
      },
    });

    // Mark payment as REFUND_PENDING during processing
    await tx.payment.update({
      where: { id: p.id },
      data: { status: PaymentStatus.REFUND_PENDING },
    });

    return { payment: p, refundRecord: refund, refundAmount: amountToRefund };
  });

  await logAuditEvent({
    actorId: actor.id,
    action: 'REFUND_REQUESTED',
    entity: 'PaymentRefund',
    entityId: refundRecord.id,
    metadata: { paymentId, amount: refundAmount, reason: data.reason },
  });

  // 3. Phase 2: Outside DB transaction - execute upstream provider refund call
  const provider = getPaymentProviderInstance(payment.provider);
  let refundResult;
  try {
    refundResult = await provider.processRefund({
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        providerTransactionId: payment.providerTransactionId,
        amount: Number(payment.amount),
        currency: payment.currency,
        paymentSessionId: payment.paymentSessionId,
      },
      refundAmount,
      reason: data.reason,
      idempotencyKey: data.idempotencyKey,
    });
  } catch (err) {
    refundResult = {
      success: false,
      status: RefundStatus.FAILED,
      amount: refundAmount,
      failureReason: (err as Error).message || 'Provider communication failure',
    };
  }

  // 4. Phase 3: Update DB with final provider refund outcome
  const now = new Date();
  const finalPayment = await prisma.$transaction(async (tx) => {
    if (refundResult.success && (refundResult.status === RefundStatus.SUCCESS || refundResult.status === RefundStatus.SUCCEEDED)) {
      await tx.paymentRefund.update({
        where: { id: refundRecord.id },
        data: {
          status: RefundStatus.SUCCESS,
          processedAt: now,
          providerRefundId: refundResult.providerRefundId || null,
        },
      });

      // Recalculate completed refunds
      const allCompleted = await tx.paymentRefund.findMany({
        where: {
          paymentId: payment.id,
          status: { in: [RefundStatus.SUCCESS, RefundStatus.SUCCEEDED] },
        },
      });
      const totalCompletedAmount = allCompleted.reduce((sum, r) => sum + Number(r.amount), 0);
      const isFull = totalCompletedAmount >= Number(payment.amount) - 0.001;
      const nextStatus = isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          refundAmount: totalCompletedAmount,
          refundedAt: now,
        },
        include: { refunds: true, user: true },
      });

      return updated;
    } else {
      // Refund failed at provider: release reservation and revert status if no prior partial refunds
      await tx.paymentRefund.update({
        where: { id: refundRecord.id },
        data: {
          status: RefundStatus.FAILED,
          failedAt: now,
          failureReason: refundResult.failureReason || 'Provider rejected refund',
        },
      });

      const priorCompleted = await tx.paymentRefund.count({
        where: {
          paymentId: payment.id,
          status: { in: [RefundStatus.SUCCESS, RefundStatus.SUCCEEDED] },
        },
      });

      const revertStatus = priorCompleted > 0 ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.PAID;

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: revertStatus },
        include: { refunds: true, user: true },
      });

      return updated;
    }
  });

  // 5. Post-commit operations
  if (refundResult.success) {
    await logAuditEvent({
      actorId: actor.id,
      action: 'REFUND_SUCCEEDED',
      entity: 'PaymentRefund',
      entityId: refundRecord.id,
      metadata: { paymentId, amount: refundAmount, providerRefundId: refundResult.providerRefundId },
    });

    if (finalPayment.user?.email) {
      sendPaymentRefundEmail(finalPayment.user.email, {
        name: finalPayment.user.name,
        invoiceId: finalPayment.transactionId || finalPayment.id,
        amount: `${finalPayment.currency} ${Number(refundAmount).toFixed(2)}`,
        totalRefunded: `${finalPayment.currency} ${Number(finalPayment.refundAmount).toFixed(2)}`,
        reason: data.reason,
        status: finalPayment.status,
        date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }).catch((err) => console.warn('[Email] Payment refund email dispatch error:', err.message));
    }

    createNotification({
      userId: finalPayment.userId,
      type: NotificationType.PAYMENT,
      title: 'Payment Refund Processed',
      message: `A refund of ${finalPayment.currency} ${Number(refundAmount).toFixed(2)} has been processed for your payment.`,
      metadata: { paymentId, refundId: refundRecord.id },
    }).catch(() => {});

    const res = toPaymentDetailResponse(finalPayment, actor.role, true);

    if (data.idempotencyKey) {
      await saveIdempotency(
        data.idempotencyKey,
        IdempotencyOperation.REFUND_INITIATION,
        { paymentId, amount: data.amount, reason: data.reason },
        httpStatus.OK,
        res,
        actor.id,
        paymentId,
      );
    }

    return res;
  } else {
    await logAuditEvent({
      actorId: actor.id,
      action: 'REFUND_FAILED',
      entity: 'PaymentRefund',
      entityId: refundRecord.id,
      metadata: { paymentId, error: refundResult.failureReason },
    });

    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Provider refund processing failed: ${refundResult.failureReason || 'Provider rejected refund'}`,
      PAYMENT_ERROR_CODES.REFUND_PROCESSING_FAILED,
    );
  }
};

/**
 * Retrieves refund by ID with ownership enforcement.
 */
export const getRefundById = async (
  refundId: string,
  actor: AuthUser,
): Promise<RefundRecordResponse> => {
  const refund = await prisma.paymentRefund.findUnique({
    where: { id: refundId },
    include: { payment: true },
  });

  if (!refund) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund record not found', PAYMENT_ERROR_CODES.REFUND_NOT_FOUND);
  }

  const isOwner = refund.payment.userId === actor.id;
  const isAdmin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to view this refund', PAYMENT_ERROR_CODES.PAYMENT_NOT_AUTHORIZED);
  }

  return toRefundRecordResponse(refund);
};

/**
 * Retrieves paginated refunds for administrators.
 */
export const getAdminRefunds = async (
  query: RefundQueryDTO,
): Promise<{ data: RefundRecordResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 10)));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.paymentId) where.paymentId = query.paymentId;
  if (query.minAmount || query.maxAmount) {
    where.amount = {};
    if (query.minAmount) where.amount.gte = query.minAmount;
    if (query.maxAmount) where.amount.lte = query.maxAmount;
  }
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  const [total, refunds] = await Promise.all([
    prisma.paymentRefund.count({ where }),
    prisma.paymentRefund.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      include: { payment: true },
    }),
  ]);

  return {
    data: refunds.map(toRefundRecordResponse),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Retries a failed refund for administrators.
 */
export const retryFailedRefund = async (
  refundId: string,
  actor: AuthUser,
): Promise<PaymentDetailResponse> => {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only authorized administrators can retry refunds', PAYMENT_ERROR_CODES.PAYMENT_NOT_AUTHORIZED);
  }

  const refund = await prisma.paymentRefund.findUnique({
    where: { id: refundId },
    include: { payment: true },
  });

  if (!refund) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund record not found', PAYMENT_ERROR_CODES.REFUND_NOT_FOUND);
  }

  if (refund.status !== RefundStatus.FAILED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot retry refund with status '${refund.status}'. Only FAILED refunds can be retried.`,
      PAYMENT_ERROR_CODES.REFUND_NOT_ALLOWED,
    );
  }

  return refundPayment(
    refund.paymentId,
    actor,
    {
      amount: Number(refund.amount),
      reason: refund.reason || 'Retry of failed refund',
      idempotencyKey: refund.idempotencyKey || `retry-${refund.id}-${Date.now()}`,
    },
  );
};

/**
 * Retrieves payment details by ID or transactionId with ownership enforcement.
 */
export const getPaymentById = async (
  paymentIdOrTransactionId: string,
  actor: AuthUser,
): Promise<PaymentDetailResponse> => {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { id: paymentIdOrTransactionId },
        { transactionId: paymentIdOrTransactionId },
      ],
    },
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
): Promise<{ data: PaymentDetailResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 10)));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (query.userId) where.userId = query.userId;
  if (query.status) where.status = query.status;
  if (query.provider) where.provider = query.provider;
  if (query.paymentPurpose) where.paymentPurpose = query.paymentPurpose;
  if (query.currency) where.currency = query.currency.toUpperCase();
  if (query.transactionId) where.transactionId = { contains: query.transactionId };

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

  const orderByField = query.sortBy || 'createdAt';
  const orderDirection = query.sortOrder || 'desc';

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderByField]: orderDirection },
      include: { user: true, refunds: true },
    }),
  ]);

  return {
    data: payments.map((p) => toPaymentDetailResponse(p, viewerRole, isPrivileged)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Calculates payment financial analytics and metrics.
 */
export const getAdminPaymentStatistics = async (): Promise<PaymentStatisticsResponse> => {
  const payments = await prisma.payment.findMany({
    select: {
      amount: true,
      refundAmount: true,
      currency: true,
      provider: true,
      status: true,
    },
  });

  let totalPayments = 0;
  let successfulPayments = 0;
  let pendingPayments = 0;
  let failedPayments = 0;
  let refundedPayments = 0;

  const currencyBreakdown: PaymentStatisticsResponse['currencyBreakdown'] = {};
  const providerBreakdown: PaymentStatisticsResponse['providerBreakdown'] = {
    [PaymentProvider.SSLCOMMERZ]: { totalCount: 0, successfulCount: 0, currencyTotals: {} },
    [PaymentProvider.STRIPE]: { totalCount: 0, successfulCount: 0, currencyTotals: {} },
  };

  for (const p of payments) {
    totalPayments += 1;
    const cur = p.currency;
    const amt = Number(p.amount);
    const ref = Number(p.refundAmount || 0);

    const isSuccess = p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS;
    const isRefund = p.status === PaymentStatus.REFUNDED || p.status === PaymentStatus.PARTIALLY_REFUNDED;

    if (isSuccess || isRefund) successfulPayments += 1;
    if (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING) pendingPayments += 1;
    if (p.status === PaymentStatus.FAILED || p.status === PaymentStatus.CANCELLED) failedPayments += 1;
    if (p.status === PaymentStatus.REFUNDED) refundedPayments += 1;

    // Currency breakdown
    if (!currencyBreakdown[cur]) {
      currencyBreakdown[cur] = {
        successfulAmount: 0,
        refundedAmount: 0,
        netAmount: 0,
        transactionCount: 0,
      };
    }

    currencyBreakdown[cur].transactionCount += 1;
    if (isSuccess || isRefund) {
      currencyBreakdown[cur].successfulAmount += amt;
      currencyBreakdown[cur].refundedAmount += ref;
      currencyBreakdown[cur].netAmount = currencyBreakdown[cur].successfulAmount - currencyBreakdown[cur].refundedAmount;
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
