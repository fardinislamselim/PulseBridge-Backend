import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  getMyProfileController,
  updateMyProfileController,
  getUsersController,
  getUserByIdController,
  updateUserStatusController,
  updateUserRoleController,
} from './user.controller.js';
import {
  updateMyProfileSchema,
  getUsersQuerySchema,
  getUserDetailsParamsSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
} from './user.validation.js';

const router = Router();

// ==========================================
// Authenticated User Profile Endpoints
// ==========================================
router.get('/me', authenticate, getMyProfileController);
router.patch('/me', authenticate, validateRequest(updateMyProfileSchema), updateMyProfileController);

// ==========================================
// Administrative User Management Endpoints
// ==========================================
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(getUsersQuerySchema),
  getUsersController
);

router.get(
  '/:userId',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(getUserDetailsParamsSchema),
  getUserByIdController
);

router.patch(
  '/:userId/status',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(updateUserStatusSchema),
  updateUserStatusController
);

router.patch(
  '/:userId/role',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(updateUserRoleSchema),
  updateUserRoleController
);

export const userRoutes = router;
