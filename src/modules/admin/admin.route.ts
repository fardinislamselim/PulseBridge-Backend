import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { getAdminDashboardController, getAuditLogsController } from './admin.controller.js';
import { getAuditLogsQuerySchema } from './admin.validation.js';
import {
  getUsersController,
  getUserByIdController,
  updateUserStatusController,
  updateUserRoleController,
} from '../users/user.controller.js';
import {
  getUsersQuerySchema,
  getUserDetailsParamsSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
} from '../users/user.validation.js';
import {
  getDonorsController,
  getDonorByIdController,
  adminVerifyDonorController,
  adminRestrictDonorController,
  getAdminDonorEligibilityController,
} from '../donors/donor.controller.js';
import {
  getDonorsQuerySchema,
  donorIdParamSchema,
  adminVerifyDonorSchema,
  adminRestrictDonorSchema,
} from '../donors/donor.validation.js';
import {
  getDonationsController,
  getDonationByIdController,
  getDonorDonationHistoryForAdminController,
} from '../donations/donation.controller.js';
import {
  donationQuerySchema,
  donationIdParamSchema,
} from '../donations/donation.validation.js';
import {
  getAdminBloodRequestsController,
  getAdminBloodRequestByIdController,
  approveBloodRequestController,
  rejectBloodRequestController,
  updateBloodRequestUrgencyController,
  expireBloodRequestController,
} from '../requests/request.controller.js';
import {
  adminGetBloodRequestsQuerySchema,
  requestIdParamSchema,
  rejectBloodRequestSchema,
  updateUrgencySchema,
  expireBloodRequestSchema,
} from '../requests/request.validation.js';
import {
  getAdminPaymentsController,
  getAdminPaymentStatisticsController,
  getPaymentByIdController,
  getPaymentRefundsController,
  refundPaymentController,
} from '../payments/payment.controller.js';
import {
  paymentQuerySchema,
  paymentIdParamSchema,
  refundPaymentSchema,
} from '../payments/payment.validation.js';

const router = Router();

// Apply auth & role authorization to all admin routes
router.use(authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN));

// Dashboard metrics (ADMIN & SUPER_ADMIN)
router.get('/dashboard', getAdminDashboardController);

// Audit logs (ADMIN & SUPER_ADMIN)
router.get(
  '/audit-logs',
  validateRequest(getAuditLogsQuerySchema),
  getAuditLogsController
);

// Administrative User Management
router.get(
  '/users',
  validateRequest(getUsersQuerySchema),
  getUsersController
);

router.get(
  '/users/:userId',
  validateRequest(getUserDetailsParamsSchema),
  getUserByIdController
);

router.patch(
  '/users/:userId/status',
  validateRequest(updateUserStatusSchema),
  updateUserStatusController
);

router.patch(
  '/users/:userId/role',
  validateRequest(updateUserRoleSchema),
  updateUserRoleController
);

// Administrative Donor Management
router.get(
  '/donors',
  validateRequest(getDonorsQuerySchema),
  getDonorsController
);

router.get(
  '/donors/:donorId',
  validateRequest(donorIdParamSchema),
  getDonorByIdController
);

router.patch(
  '/donors/:donorId/verification',
  validateRequest(adminVerifyDonorSchema),
  adminVerifyDonorController
);

router.patch(
  '/donors/:donorId/restrictions',
  validateRequest(adminRestrictDonorSchema),
  adminRestrictDonorController
);

router.get(
  '/donors/:donorId/eligibility',
  validateRequest(donorIdParamSchema),
  getAdminDonorEligibilityController
);

router.get(
  '/donors/:donorId/donation-history',
  validateRequest({
    params: donorIdParamSchema.shape.params,
    query: donationQuerySchema.shape.query,
  }),
  getDonorDonationHistoryForAdminController
);

// Administrative Donation Management
router.get(
  '/donations',
  validateRequest(donationQuerySchema),
  getDonationsController
);

router.get(
  '/donations/:donationId',
  validateRequest(donationIdParamSchema),
  getDonationByIdController
);

// Administrative Blood Request Management
router.get(
  '/blood-requests',
  validateRequest(adminGetBloodRequestsQuerySchema),
  getAdminBloodRequestsController
);

router.get(
  '/blood-requests/:requestId',
  validateRequest(requestIdParamSchema),
  getAdminBloodRequestByIdController
);

router.patch(
  '/blood-requests/:requestId/approve',
  validateRequest(requestIdParamSchema),
  approveBloodRequestController
);

router.patch(
  '/blood-requests/:requestId/reject',
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: rejectBloodRequestSchema,
  }),
  rejectBloodRequestController
);

router.patch(
  '/blood-requests/:requestId/urgency',
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: updateUrgencySchema,
  }),
  updateBloodRequestUrgencyController
);

router.patch(
  '/blood-requests/:requestId/expire',
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: expireBloodRequestSchema,
  }),
  expireBloodRequestController
);

// Administrative Payment Management
router.get(
  '/payments/statistics',
  getAdminPaymentStatisticsController
);

router.get(
  '/payments',
  validateRequest(paymentQuerySchema),
  getAdminPaymentsController
);

router.get(
  '/payments/:paymentId',
  validateRequest(paymentIdParamSchema),
  getPaymentByIdController
);

router.get(
  '/payments/:paymentId/refunds',
  validateRequest(paymentIdParamSchema),
  getPaymentRefundsController
);

router.post(
  '/payments/:paymentId/refund',
  validateRequest({
    params: paymentIdParamSchema.shape.params,
    body: refundPaymentSchema.shape.body,
  }),
  refundPaymentController
);

export const adminRoutes = router;
