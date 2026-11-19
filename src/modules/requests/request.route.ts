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
  updateBloodRequestUrgencyController,
  expireBloodRequestController,
  getBloodRequestHistoryController,
} from './request.controller.js';
import {
  createBloodRequestSchema,
  updateBloodRequestSchema,
  cancelBloodRequestSchema,
  rejectBloodRequestSchema,
  updateUrgencySchema,
  expireBloodRequestSchema,
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

// 4. Get request lifecycle history (Owner requester, ADMIN, SUPER_ADMIN)
router.get(
  '/:requestId/history',
  authenticate,
  validateRequest(requestIdParamSchema),
  getBloodRequestHistoryController
);

// 5. Get single blood request details
router.get(
  '/:requestId',
  optionalAuth,
  validateRequest(requestIdParamSchema),
  getBloodRequestByIdController
);

// 6. Update blood request (Owner requester or ADMIN)
router.patch(
  '/:requestId',
  authenticate,
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: updateBloodRequestSchema,
  }),
  updateBloodRequestController
);

// 7. Cancel blood request (Owner requester or ADMIN)
router.patch(
  '/:requestId/cancel',
  authenticate,
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: cancelBloodRequestSchema,
  }),
  cancelBloodRequestController
);

// 8. Administrative approval (ADMIN, SUPER_ADMIN)
router.patch(
  '/:requestId/approve',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(requestIdParamSchema),
  approveBloodRequestController
);

// 9. Administrative rejection (ADMIN, SUPER_ADMIN)
router.patch(
  '/:requestId/reject',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: rejectBloodRequestSchema,
  }),
  rejectBloodRequestController
);

// 10. Administrative urgency update (ADMIN, SUPER_ADMIN)
router.patch(
  '/:requestId/urgency',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: updateUrgencySchema,
  }),
  updateBloodRequestUrgencyController
);

// 11. Administrative expiration (ADMIN, SUPER_ADMIN)
router.patch(
  '/:requestId/expire',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: requestIdParamSchema.shape.params,
    body: expireBloodRequestSchema,
  }),
  expireBloodRequestController
);

export const bloodRequestRoutes = router;
