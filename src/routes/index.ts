import { Router } from 'express';
import { healthRoutes } from './health.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { userRoutes } from '../modules/users/user.route.js';
import { donorRoutes } from '../modules/donors/donor.route.js';
import { bloodRequestRoutes } from '../modules/requests/request.route.js';
import { adminRoutes } from '../modules/admin/admin.route.js';

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

// Administration & Analytics
router.use('/admin', adminRoutes);

export const appRouter = router;
