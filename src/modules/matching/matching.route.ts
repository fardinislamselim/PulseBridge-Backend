import { Router } from 'express';
import { optionalAuth } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  getCompatibilityController,
  findEligibleDonorsController,
} from './matching.controller.js';
import {
  compatibilityQuerySchema,
  findDonorsQuerySchema,
  matchingRequestIdParamSchema,
} from './matching.validation.js';

const router = Router();

// 1. ABO/Rh Compatibility Checker & Lookup
router.get(
  '/compatibility',
  validateRequest(compatibilityQuerySchema),
  getCompatibilityController
);

// 2. Discover compatible & eligible donors for a blood request
router.get(
  '/requests/:requestId/donors',
  optionalAuth,
  validateRequest(matchingRequestIdParamSchema),
  findEligibleDonorsController
);

// 3. Search compatible & eligible donors via query filters
router.get(
  '/find-donors',
  optionalAuth,
  validateRequest(findDonorsQuerySchema),
  findEligibleDonorsController
);

export const matchingRoutes = router;
