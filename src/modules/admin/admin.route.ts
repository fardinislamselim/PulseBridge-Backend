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
} from '../donors/donor.controller.js';
import {
  getDonorsQuerySchema,
  donorIdParamSchema,
  adminVerifyDonorSchema,
  adminRestrictDonorSchema,
} from '../donors/donor.validation.js';
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

export const adminRoutes = router;
