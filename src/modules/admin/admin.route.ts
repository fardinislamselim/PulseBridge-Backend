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

export const adminRoutes = router;
