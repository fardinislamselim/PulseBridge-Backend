import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  initiatePaymentController,
  getPaymentByIdController,
  verifyPaymentByIdController,
  getPaymentRefundsController,
  getMyPaymentsController,
  refundPaymentController,
  getAdminPaymentsController,
  getAdminPaymentStatisticsController,
  handleSSLCommerzSuccessController,
  handleSSLCommerzFailController,
  handleSSLCommerzCancelController,
  handleSSLCommerzIPNController,
  handleStripeWebhookController,
} from './payment.controller.js';
import {
  initiatePaymentSchema,
  refundPaymentSchema,
  paymentIdParamSchema,
  paymentQuerySchema,
} from './payment.validation.js';

const router = Router();

// Gateway callbacks & webhooks (Public)
router.post('/sslcommerz/success', handleSSLCommerzSuccessController);
router.post('/sslcommerz/fail', handleSSLCommerzFailController);
router.post('/sslcommerz/cancel', handleSSLCommerzCancelController);
router.post('/sslcommerz/ipn', handleSSLCommerzIPNController);
router.post('/stripe/webhook', handleStripeWebhookController);

// Authenticated User Payment Endpoints
router.post(
  '/initiate',
  authenticate,
  validateRequest(initiatePaymentSchema),
  initiatePaymentController,
);

router.get(
  '/me',
  authenticate,
  validateRequest(paymentQuerySchema),
  getMyPaymentsController,
);

// Admin-only metrics and listing under /payments
router.get(
  '/statistics',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getAdminPaymentStatisticsController,
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(paymentQuerySchema),
  getAdminPaymentsController,
);

router.get(
  '/:paymentId',
  authenticate,
  validateRequest(paymentIdParamSchema),
  getPaymentByIdController,
);

router.get(
  '/:paymentId/verify',
  authenticate,
  validateRequest(paymentIdParamSchema),
  verifyPaymentByIdController,
);

router.get(
  '/:paymentId/refunds',
  authenticate,
  validateRequest(paymentIdParamSchema),
  getPaymentRefundsController,
);

router.post(
  '/:paymentId/refund',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: paymentIdParamSchema.shape.params,
    body: refundPaymentSchema.shape.body,
  }),
  refundPaymentController,
);

export const paymentRoutes = router;
