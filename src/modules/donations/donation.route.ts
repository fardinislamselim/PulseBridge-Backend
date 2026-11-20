import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  createDonationController,
  verifyDonationController,
  rejectDonationController,
  getMyDonationHistoryController,
  getDonationsController,
  getDonationByIdController,
} from './donation.controller.js';
import {
  createDonationSchema,
  verifyDonationSchema,
  rejectDonationSchema,
  donationQuerySchema,
  donationIdParamSchema,
} from './donation.validation.js';

const router = Router();

// 1. Get authenticated donor's own history & 90-day cooldown status
router.get(
  '/me',
  authenticate,
  authorize(UserRole.DONOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(donationQuerySchema),
  getMyDonationHistoryController,
);

// 2. Create a donation record (Requesters for their requests, Admins)
router.post(
  '/',
  authenticate,
  authorize(UserRole.REQUESTER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(createDonationSchema),
  createDonationController,
);

// 3. List donations (Scoped by role: Admin sees all; Requester sees own requests; Donor sees own)
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REQUESTER, UserRole.DONOR),
  validateRequest(donationQuerySchema),
  getDonationsController,
);

// 4. Get specific donation details
router.get(
  '/:donationId',
  authenticate,
  validateRequest(donationIdParamSchema),
  getDonationByIdController,
);

// 5. Verify & atomically complete donation (Admin only)
router.patch(
  '/:donationId/verify',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: donationIdParamSchema.shape.params,
    body: verifyDonationSchema.shape.body,
  }),
  verifyDonationController,
);

// 6. Reject donation record (Admin only)
router.patch(
  '/:donationId/reject',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({
    params: donationIdParamSchema.shape.params,
    body: rejectDonationSchema.shape.body,
  }),
  rejectDonationController,
);

export const donationRoutes = router;
