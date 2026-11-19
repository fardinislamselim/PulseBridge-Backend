import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  getMyDonorProfileController,
  updateMyDonorProfileController,
  updateMyDonorAvailabilityController,
  getDonorEligibilityController,
  getNearbyDonorsController,
  getDonorByIdController,
  getDonorsController,
} from './donor.controller.js';
import {
  updateDonorProfileSchema,
  updateDonorAvailabilitySchema,
  getDonorsQuerySchema,
  nearbyDonorsQuerySchema,
  donorIdParamSchema,
} from './donor.validation.js';

const router = Router();

// Current donor profile and management (Auth required)
router.get('/me', authenticate, getMyDonorProfileController);

router.patch(
  '/me',
  authenticate,
  validateRequest(updateDonorProfileSchema),
  updateMyDonorProfileController,
);

router.patch(
  '/me/availability',
  authenticate,
  validateRequest(updateDonorAvailabilitySchema),
  updateMyDonorAvailabilityController,
);

router.get('/me/eligibility', authenticate, getDonorEligibilityController);

// Proximity / nearby search
router.get(
  '/nearby',
  optionalAuth,
  validateRequest(nearbyDonorsQuerySchema),
  getNearbyDonorsController,
);

// Individual donor profile (Public sanitized, privileged full)
router.get(
  '/:donorId',
  optionalAuth,
  validateRequest(donorIdParamSchema),
  getDonorByIdController,
);

// General donor search & directory
router.get(
  '/',
  optionalAuth,
  validateRequest(getDonorsQuerySchema),
  getDonorsController,
);

export const donorRoutes = router;
