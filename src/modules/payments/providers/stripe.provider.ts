import crypto from 'node:crypto';
import { PaymentProvider, PaymentStatus, RefundStatus } from '../../../generated/prisma/enums.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';
import httpStatus from 'http-status';
import type {
  IPaymentProvider,
  ProviderInitiateParams,
  ProviderInitiateResult,
  ProviderVerifyParams,
  ProviderVerifyResult,
  ProviderRefundParams,
  ProviderRefundResult,
} from './payment-provider.interface.js';

export class StripeProvider implements IPaymentProvider {
  public readonly provider = PaymentProvider.STRIPE;

  private getSecretKey(): string {
    return env.STRIPE_SECRET_KEY;
  }

  private getWebhookSecret(): string {
    return env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Creates a Stripe Checkout Session via Stripe REST API.
   */
  async initiateSession(params: ProviderInitiateParams): Promise<ProviderInitiateResult> {
    const secretKey = this.getSecretKey();

    // Fallback sandbox simulation if secret key is not configured
    if (!secretKey) {
      console.warn('[Stripe] No secret key configured. Returning simulated Stripe checkout session.');
      const simulatedId = `cs_test_sim_${params.transactionId}`;
      const simulatedUrl = `https://checkout.stripe.com/pay/${simulatedId}`;
      return {
        paymentUrl: simulatedUrl,
        providerSessionId: simulatedId,
        providerTransactionId: `pi_sim_${params.transactionId}`,
        rawResponse: { simulated: true },
      };
    }

    const currency = (params.currency || 'USD').toLowerCase();
    // Stripe amounts are represented in cents / smallest currency unit (e.g. $10 = 1000 cents)
    const unitAmount = Math.round(Number(params.amount) * 100);

    const payload = new URLSearchParams();
    payload.append('payment_method_types[0]', 'card');
    payload.append('line_items[0][price_data][currency]', currency);
    payload.append('line_items[0][price_data][unit_amount]', unitAmount.toString());
    payload.append(
      'line_items[0][price_data][product_data][name]',
      params.description || 'PulseBridge Platform Support'
    );
    payload.append('line_items[0][quantity]', '1');
    payload.append('mode', 'payment');
    payload.append('client_reference_id', params.transactionId);
    payload.append('customer_email', params.user.email);
    payload.append('success_url', params.callbackUrls.successUrl);
    payload.append('cancel_url', params.callbackUrls.cancelUrl);
    payload.append('metadata[paymentId]', params.paymentId);
    payload.append('metadata[transactionId]', params.transactionId);
    payload.append('metadata[userId]', params.user.id);

    try {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (response.ok && data?.url) {
        return {
          paymentUrl: String(data.url),
          providerSessionId: String(data.id),
          providerTransactionId: data.payment_intent ? String(data.payment_intent) : undefined,
          rawResponse: data,
        };
      }

      const errMsg = (data?.error as { message?: string })?.message || 'Stripe API error';
      throw new AppError(httpStatus.BAD_GATEWAY, `Stripe session creation failed: ${errMsg}`);
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : 'Stripe service unreachable';
      throw new AppError(httpStatus.BAD_GATEWAY, `Stripe network error: ${msg}`);
    }
  }

  /**
   * Verifies Stripe webhook signature using official HMAC-SHA256 scheme.
   */
  verifyWebhookSignature(payloadRaw: Buffer | string, signatureHeader: string): boolean {
    const webhookSecret = this.getWebhookSecret();
    if (!webhookSecret) {
      console.warn('[Stripe] STRIPE_WEBHOOK_SECRET is empty. Verification allowed in simulation mode only.');
      return true;
    }

    if (!signatureHeader) {
      return false;
    }

    // Header format: t=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
    const parts = signatureHeader.split(',');
    let timestamp = '';
    const signatures: string[] = [];

    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key === 'v1') {
        signatures.push(value);
      }
    }

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    const payloadString = Buffer.isBuffer(payloadRaw) ? payloadRaw.toString('utf8') : payloadRaw;
    const signedPayload = `${timestamp}.${payloadString}`;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    for (const signature of signatures) {
      try {
        const a = Buffer.from(signature, 'hex');
        const b = Buffer.from(expectedSignature, 'hex');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Retrieves and verifies Stripe payment status.
   */
  async verifyPayment(params: ProviderVerifyParams): Promise<ProviderVerifyResult> {
    const secretKey = this.getSecretKey();

    if (!secretKey) {
      return {
        verified: true,
        status: PaymentStatus.PAID,
        providerTransactionId: params.providerTransactionId || `pi_sim_${params.transactionId}`,
        amount: Number(params.rawPayload?.amount || 0),
        currency: String(params.rawPayload?.currency || 'USD').toUpperCase(),
        paidAt: new Date(),
        rawResponse: { simulated: true, ...params.rawPayload },
      };
    }

    const sessionId = params.sessionReference || (params.rawPayload?.id as string);
    if (!sessionId) {
      return {
        verified: false,
        status: PaymentStatus.PENDING,
        amount: 0,
        currency: 'USD',
        failureReason: 'No Stripe session ID provided for verification',
      };
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (response.ok && data?.payment_status === 'paid') {
        return {
          verified: true,
          status: PaymentStatus.PAID,
          providerTransactionId: data.payment_intent ? String(data.payment_intent) : sessionId,
          amount: Number(data.amount_total || 0) / 100,
          currency: String(data.currency || 'USD').toUpperCase(),
          paidAt: new Date(),
          rawResponse: data,
        };
      }

      return {
        verified: false,
        status: data?.status === 'expired' ? PaymentStatus.FAILED : PaymentStatus.PENDING,
        amount: Number(data?.amount_total || 0) / 100,
        currency: String(data?.currency || 'USD').toUpperCase(),
        failureReason: `Payment status is '${data?.payment_status}'`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stripe verification error';
      return {
        verified: false,
        status: PaymentStatus.PENDING,
        amount: 0,
        currency: 'USD',
        failureReason: msg,
      };
    }
  }

  /**
   * Refunds a payment via Stripe Refunds API.
   */
  async processRefund(params: ProviderRefundParams): Promise<ProviderRefundResult> {
    const secretKey = this.getSecretKey();

    if (!secretKey) {
      return {
        success: true,
        status: RefundStatus.SUCCESS,
        providerRefundId: `re_test_sim_${Date.now()}`,
        amount: params.refundAmount,
        rawResponse: { simulated: true },
      };
    }

    const payload = new URLSearchParams();
    if (params.payment.providerTransactionId?.startsWith('pi_')) {
      payload.append('payment_intent', params.payment.providerTransactionId);
    } else if (params.payment.providerTransactionId?.startsWith('ch_')) {
      payload.append('charge', params.payment.providerTransactionId);
    }

    const amountInCents = Math.round(params.refundAmount * 100);
    payload.append('amount', amountInCents.toString());
    payload.append('reason', 'requested_by_customer');
    payload.append('metadata[refundReason]', params.reason);
    payload.append('metadata[paymentId]', params.payment.id);

    try {
      const response = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (response.ok && data?.status === 'succeeded') {
        return {
          success: true,
          status: RefundStatus.SUCCESS,
          providerRefundId: String(data.id),
          amount: Number(data.amount) / 100,
          rawResponse: data,
        };
      }

      if (response.ok && data?.status === 'pending') {
        return {
          success: true,
          status: RefundStatus.PENDING,
          providerRefundId: String(data.id),
          amount: Number(data.amount) / 100,
          rawResponse: data,
        };
      }

      const errMsg = (data?.error as { message?: string })?.message || 'Refund failed at Stripe';
      return {
        success: false,
        status: RefundStatus.FAILED,
        amount: params.refundAmount,
        failureReason: errMsg,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stripe refund network error';
      return {
        success: false,
        status: RefundStatus.FAILED,
        amount: params.refundAmount,
        failureReason: msg,
      };
    }
  }
}
