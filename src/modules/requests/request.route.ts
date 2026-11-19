import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  createBloodRequestController,
  getBloodRequestsController,
  getMyBloodRequestsController,
  getBloodRequestByIdController,
  updateBloodRequestController,
  cancelBloodRequestController,
  approveBloodRequestController,
  rejectBloodRequestController,
} from './request.controller.js';
import {
  createBloodRequestSchema,
  updateBloodRequestSchema,
  cancelBloodRequestSchema,
  rejectBloodRequestSchema,
  requestIdParamSchema,
  getBloodRequestsQuerySchema,
} from './request.validation.js';

const router = Router();

// 1. Create blood donation request (REQUESTER, ADMIN, SUPER_ADMIN)
router.post(
  '/',
  authorize(UserRole.REQUESTER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(createBloodRequestSchema),
  createBloodRequestController
);

// 2. Get blood requests (Public / Directory with optionalAuth)
router.get(
  '/',
  optionalAuth,
  validateRequest(getBloodRequestsQuerySchema),
  getBloodRequestsController
);

// 3. Get my blood requests (Must be before /:requestId)
router.get(
  '/me',
  authenticate,
  validateRequest(getBloodRequestsQuerySchema),
  getMyBloodRequestsController
);

// 4. Get single blood request details
router.get(
  '/:requestId',
  optionalAuth,
  validateRequest(requestIdParamSchema),
  getBloodRequestByIdController
);

// 5. Update blood request
router.patch(
  '/:requestId',
  authenticate,
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: updateBloodRequestSchema,
  }),
  updateBloodRequestController
);

// 6. Cancel blood request
router.patch(
  '/:requestId/cancel',
  authenticate,
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: cancelBloodRequestSchema,
  }),
  cancelBloodRequestController
);

// 7. Administrative approval (ADMIN, SUPER_ADMIN)
router.patch(
  '/:requestId/approve',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(requestIdParamSchema),
  approveBloodRequestController
);

// 8. Administrative rejection (ADMIN, SUPER_ADMIN)
router.patch(
  '/:requestId/reject',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: rejectBloodRequestSchema,
  }),
  rejectBloodRequestController
);

export const bloodRequestRoutes = router;
