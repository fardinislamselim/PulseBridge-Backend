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

export class SSLCommerzProvider implements IPaymentProvider {
  public readonly provider = PaymentProvider.SSLCOMMERZ;

  private getBaseUrl(): string {
    return env.SSLCOMMERZ_IS_LIVE
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  private getCredentials() {
    return {
      storeId: env.SSLCOMMERZ_STORE_ID,
      storePassword: env.SSLCOMMERZ_STORE_PASSWORD,
    };
  }

  async initiateSession(params: ProviderInitiateParams): Promise<ProviderInitiateResult> {
    const { storeId, storePassword } = this.getCredentials();

    // Fallback sandbox simulation if credentials are not configured
    if (!storeId || !storePassword) {
      console.warn('[SSLCommerz] No store credentials configured. Returning simulated sandbox session.');
      const simulatedUrl = `https://sandbox.sslcommerz.com/gwprocess/v4/simulator?tran_id=${params.transactionId}`;
      return {
        paymentUrl: simulatedUrl,
        providerSessionId: `sim-session-${params.transactionId}`,
        providerTransactionId: `sim-tran-${params.transactionId}`,
        rawResponse: { simulated: true },
      };
    }

    const payload = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: Number(params.amount).toFixed(2),
      currency: params.currency || 'BDT',
      tran_id: params.transactionId,
      success_url: params.callbackUrls.successUrl,
      fail_url: params.callbackUrls.failUrl,
      cancel_url: params.callbackUrls.cancelUrl,
      ipn_url: params.callbackUrls.ipnUrl || params.callbackUrls.successUrl,
      cus_name: params.user.name || 'PulseBridge Supporter',
      cus_email: params.user.email,
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: params.user.phone || '01700000000',
      shipping_method: 'NO',
      product_name: params.description || 'PulseBridge Voluntary Platform Support',
      product_category: 'Healthcare',
      product_profile: 'general',
    });

    try {
      const response = await fetch(`${this.getBaseUrl()}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (data?.status === 'SUCCESS' && data?.GatewayPageURL) {
        return {
          paymentUrl: String(data.GatewayPageURL),
          providerSessionId: data.sessionkey ? String(data.sessionkey) : undefined,
          providerTransactionId: params.transactionId,
          rawResponse: data,
        };
      }

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        `SSLCommerz session initiation failed: ${data?.failedreason || 'Unknown provider error'}`,
      );
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : 'SSLCommerz gateway unreachable';
      throw new AppError(httpStatus.BAD_GATEWAY, `SSLCommerz network error: ${msg}`);
    }
  }

  async verifyPayment(params: ProviderVerifyParams): Promise<ProviderVerifyResult> {
    const { storeId, storePassword } = this.getCredentials();

    // Check simulated test mode
    if (!storeId || !storePassword) {
      const valId = params.valId || (params.rawPayload?.val_id as string);
      const isFailed = params.rawPayload?.status === 'FAILED';
      const isCancelled = params.rawPayload?.status === 'CANCELLED';

      if (isFailed) {
        return {
          verified: true,
          status: PaymentStatus.FAILED,
          amount: Number(params.rawPayload?.amount || 0),
          currency: 'BDT',
          failureReason: 'Transaction failed at SSLCommerz gateway',
          rawResponse: params.rawPayload,
        };
      }

      if (isCancelled) {
        return {
          verified: true,
          status: PaymentStatus.CANCELLED,
          amount: Number(params.rawPayload?.amount || 0),
          currency: 'BDT',
          failureReason: 'Payment cancelled by customer',
          rawResponse: params.rawPayload,
        };
      }

      return {
        verified: true,
        status: PaymentStatus.PAID,
        providerTransactionId: valId || `ssl-verified-${params.transactionId}`,
        amount: Number(params.rawPayload?.amount || 0),
        currency: 'BDT',
        paidAt: new Date(),
        rawResponse: { simulated: true, ...params.rawPayload },
      };
    }

    const valId = params.valId || (params.rawPayload?.val_id as string);
    const queryUrl = valId
      ? `${this.getBaseUrl()}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&format=json`
      : `${this.getBaseUrl()}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${encodeURIComponent(params.transactionId)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&format=json`;

    try {
      const response = await fetch(queryUrl);
      const data = (await response.json()) as Record<string, unknown>;

      const statusStr = String(data?.status || '').toUpperCase();
      const isValid = statusStr === 'VALID' || statusStr === 'VALIDATED';

      // Verify store identity if present in response
      if (storeId && data?.store_id && String(data.store_id) !== String(storeId)) {
        return {
          verified: false,
          status: PaymentStatus.FAILED,
          amount: Number(data.amount || 0),
          currency: String(data.currency || 'BDT'),
          failureReason: 'Store identity mismatch in SSLCommerz verification response',
          rawResponse: data,
        };
      }

      if (isValid) {
        return {
          verified: true,
          status: PaymentStatus.PAID,
          providerTransactionId: data.bank_tran_id ? String(data.bank_tran_id) : valId || params.transactionId,
          amount: Number(data.amount || 0),
          currency: String(data.currency || 'BDT'),
          paidAt: data.tran_date ? new Date(String(data.tran_date)) : new Date(),
          rawResponse: data,
        };
      }

      return {
        verified: false,
        status: PaymentStatus.FAILED,
        amount: Number(data.amount || 0),
        currency: String(data.currency || 'BDT'),
        failureReason: String(data.error || data.failedreason || 'Validation status is not VALID'),
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SSLCommerz validation error';
      // Network failure should NOT mark payment as permanently failed; keep pending for reconciliation
      return {
        verified: false,
        status: PaymentStatus.PENDING,
        amount: 0,
        currency: 'BDT',
        failureReason: `Network/Gateway unreachable: ${msg}`,
      };
    }
  }

  async processRefund(params: ProviderRefundParams): Promise<ProviderRefundResult> {
    const { storeId, storePassword } = this.getCredentials();

    if (!storeId || !storePassword) {
      return {
        success: true,
        status: RefundStatus.SUCCESS,
        providerRefundId: `ssl-refund-sim-${Date.now()}`,
        amount: params.refundAmount,
        rawResponse: { simulated: true },
      };
    }

    const queryUrl = `${this.getBaseUrl()}/validator/api/merchantTransIDvalidationAPI.php?bank_tran_id=${encodeURIComponent(
      params.payment.providerTransactionId || ''
    )}&refund_amount=${params.refundAmount}&refund_remarks=${encodeURIComponent(
      params.reason
    )}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&format=json`;

    try {
      const response = await fetch(queryUrl);
      const data = (await response.json()) as Record<string, unknown>;

      const isSuccess = data?.status === 'SUCCESS' || data?.refund_ref_id;
      if (isSuccess) {
        return {
          success: true,
          status: RefundStatus.SUCCESS,
          providerRefundId: String(data.refund_ref_id || `refund-${Date.now()}`),
          amount: params.refundAmount,
          rawResponse: data,
        };
      }

      return {
        success: false,
        status: RefundStatus.FAILED,
        amount: params.refundAmount,
        failureReason: String(data.errorReason || 'Refund rejected by SSLCommerz'),
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SSLCommerz refund request failed';
      return {
        success: false,
        status: RefundStatus.FAILED,
        amount: params.refundAmount,
        failureReason: msg,
      };
    }
  }
}
