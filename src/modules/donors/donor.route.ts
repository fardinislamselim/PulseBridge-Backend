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
  searchDonorsController,
  getCompatibleDonorsController,
} from './donor.controller.js';
import {
  updateDonorProfileSchema,
  updateDonorAvailabilitySchema,
  getDonorsQuerySchema,
  nearbyDonorsQuerySchema,
  donorIdParamSchema,
  donorSearchSchema,
  compatibleDonorsQuerySchema,
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

// Advanced donor search & discovery (Auth required)
router.get(
  '/search',
  authenticate,
  validateRequest(donorSearchSchema),
  searchDonorsController,
);

// Compatible donors discovery (Auth required)
router.get(
  '/compatible',
  authenticate,
  validateRequest(compatibleDonorsQuerySchema),
  getCompatibleDonorsController,
);

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
