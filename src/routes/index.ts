import { Router } from 'express';
import { healthRoutes } from './health.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { userRoutes } from '../modules/users/user.route.js';
import { adminRoutes } from '../modules/admin/admin.route.js';

const router = Router();

// Infrastructure & health routes
router.use('/', healthRoutes);

// Authentication & Identity
router.use('/auth', authRoutes);

// User Profile & Management
router.use('/users', userRoutes);

// Administration & Analytics
router.use('/admin', adminRoutes);

export const appRouter = router;
