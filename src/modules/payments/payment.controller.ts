import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/ApiResponse.js';
import { env } from '../../config/env.js';
import {
  initiatePayment,
  getPaymentById,
  verifyPaymentById,
  refundPayment,
  getPaymentRefunds,
  getMyPayments,
  getAdminPayments,
  getAdminPaymentStatistics,
  handleSSLCommerzSuccess,
  handleSSLCommerzFail,
  handleSSLCommerzCancel,
  handleSSLCommerzIPN,
  handleStripeWebhook,
} from './payment.service.js';

export const initiatePaymentController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await initiatePayment(req.body, req.user!);
    return sendCreated(res, 'Payment session initiated successfully', result);
  },
);

export const getPaymentByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    const result = await getPaymentById(paymentId, req.user!);
    return sendSuccess(res, 'Payment details retrieved successfully', result);
  },
);

export const verifyPaymentByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    const result = await verifyPaymentById(paymentId, req.user!);
    return sendSuccess(res, 'Payment verification status checked successfully', result);
  },
);

export const getPaymentRefundsController = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    const result = await getPaymentRefunds(paymentId, req.user!);
    return sendSuccess(res, 'Payment refunds retrieved successfully', result);
  },
);

export const getMyPaymentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getMyPayments(req.query, req.user!);
    return sendSuccess(
      res,
      'My payments retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta,
    );
  },
);

export const refundPaymentController = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    const result = await refundPayment(paymentId, req.user!, req.body);
    return sendSuccess(res, 'Payment refund processed successfully', result);
  },
);

export const getAdminPaymentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getAdminPayments(req.query, req.user);
    return sendSuccess(
      res,
      'Admin payments retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta,
    );
  },
);

export const getAdminPaymentStatisticsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await getAdminPaymentStatistics();
    return sendSuccess(res, 'Payment statistics retrieved successfully', result);
  },
);

export const handleSSLCommerzSuccessController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await handleSSLCommerzSuccess(req.body);

    const wantsJson =
      req.headers.accept?.includes('application/json') ||
      req.query.json === 'true' ||
      req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (wantsJson) {
      return sendSuccess(res, 'Payment completed successfully', result);
    }

    const frontendBase = env.FRONTEND_URL.replace(/\/+$/, '');
    const redirectUrl = `${frontendBase}/payment/success?paymentId=${result.id}&transactionId=${result.transactionId}&status=${result.status}`;
    return res.redirect(redirectUrl);
  },
);

export const handleSSLCommerzFailController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await handleSSLCommerzFail(req.body);

    const wantsJson =
      req.headers.accept?.includes('application/json') ||
      req.query.json === 'true' ||
      req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (wantsJson) {
      return sendSuccess(res, 'Payment failed recorded', result);
    }

    const tranId = (req.body.tran_id || req.body.transaction_id || '') as string;
    const frontendBase = env.FRONTEND_URL.replace(/\/+$/, '');
    const redirectUrl = `${frontendBase}/payment/failed?transactionId=${tranId}&status=FAILED`;
    return res.redirect(redirectUrl);
  },
);

export const handleSSLCommerzCancelController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await handleSSLCommerzCancel(req.body);

    const wantsJson =
      req.headers.accept?.includes('application/json') ||
      req.query.json === 'true' ||
      req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (wantsJson) {
      return sendSuccess(res, 'Payment cancellation recorded', result);
    }

    const tranId = (req.body.tran_id || req.body.transaction_id || '') as string;
    const frontendBase = env.FRONTEND_URL.replace(/\/+$/, '');
    const redirectUrl = `${frontendBase}/payment/cancelled?transactionId=${tranId}&status=CANCELLED`;
    return res.redirect(redirectUrl);
  },
);

export const handleSSLCommerzIPNController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await handleSSLCommerzIPN(req.body);
    return sendSuccess(res, 'SSLCommerz IPN handled successfully', result);
  },
);

export const handleStripeWebhookController = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return res.status(httpStatus.BAD_REQUEST).json({ error: 'Missing stripe-signature header' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPayload = (req as any).rawBody || req.body;

    const result = await handleStripeWebhook(rawPayload, signature);
    return res.status(httpStatus.OK).json(result);
  },
);
