import { Router } from 'express';
import { healthRoutes } from './health.route.js';

const router = Router();

// Infrastructure & health routes
router.use('/', healthRoutes);

// Future business modules will be registered here:
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);
// router.use('/donors', donorRoutes);
// router.use('/requests', requestRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/admin', adminRoutes);

export const appRouter = router;
