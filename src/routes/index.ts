import { Router } from 'express';
import { healthRoutes } from './health.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { userRoutes } from '../modules/users/user.route.js';
import { donorRoutes } from '../modules/donors/donor.route.js';
import { bloodRequestRoutes } from '../modules/requests/request.route.js';
import { matchingRoutes } from '../modules/matching/matching.route.js';
import { donationRoutes } from '../modules/donations/donation.route.js';
import { paymentRoutes } from '../modules/payments/payment.route.js';
import { adminRoutes } from '../modules/admin/admin.route.js';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { getRefundByIdController } from '../modules/payments/payment.controller.js';
import { refundIdParamSchema } from '../modules/payments/payment.validation.js';

const router = Router();

// Infrastructure & health routes
router.use('/', healthRoutes);

// Authentication & Identity
router.use('/auth', authRoutes);

// User Profile & Management
router.use('/users', userRoutes);

// Donor Management & Discovery
router.use('/donors', donorRoutes);

// Blood Donation Request Management
router.use('/blood-requests', bloodRequestRoutes);

// Donor Matching & ABO/Rh Compatibility
router.use('/matching', matchingRoutes);

// Donation Management, History & Verification
router.use('/donations', donationRoutes);

// Voluntary Platform Support & Campaign Payments
router.use('/payments', paymentRoutes);

// Single Refund Details (Owner or Admin)
router.get(
  '/refunds/:refundId',
  authenticate,
  validateRequest(refundIdParamSchema),
  getRefundByIdController,
);

// Administration & Analytics
router.use('/admin', adminRoutes);

export const appRouter = router;
