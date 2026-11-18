import { Router } from 'express';
import { healthRoutes } from './health.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';

const router = Router();

// Infrastructure & health routes
router.use('/', healthRoutes);

// Authentication & Identity
router.use('/auth', authRoutes);

// Future business modules will be registered here:
// router.use('/users', userRoutes);
// router.use('/donors', donorRoutes);
// router.use('/requests', requestRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/admin', adminRoutes);

export const appRouter = router;
