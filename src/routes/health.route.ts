import { Router } from 'express';
import { checkDatabaseHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { HealthCheckData } from '../types/index.js';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const [isDbHealthy, isRedisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isHealthy = isDbHealthy && isRedisHealthy;
    const isDegraded = !isHealthy && (isDbHealthy || isRedisHealthy);

    const healthData: HealthCheckData = {
      status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      application: 'PulseBridge',
      services: {
        database: isDbHealthy ? 'connected' : 'disconnected',
        redis: isRedisHealthy ? 'connected' : 'disconnected',
      },
    };

    if (isHealthy) {
      return res.status(200).json({
        success: true,
        message: 'PulseBridge API is healthy and operational',
        data: healthData,
      });
    }

    const errors: string[] = [];
    if (!isDbHealthy) {
      errors.push('Database service is disconnected');
    }
    if (!isRedisHealthy) {
      errors.push('Redis service is disconnected');
    }

    return res.status(503).json({
      success: false,
      message: 'PulseBridge API service degraded or infrastructure unavailable',
      errors,
      data: healthData,
    });
  })
);

export const healthRoutes = router;
