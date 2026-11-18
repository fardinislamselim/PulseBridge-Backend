import { Router } from 'express';
import httpStatus from 'http-status';
import { checkDatabaseHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/ApiResponse.js';
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
      return sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'PulseBridge API is healthy and operational',
        data: healthData,
      });
    }

    return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      success: false,
      statusCode: httpStatus.SERVICE_UNAVAILABLE,
      message: 'PulseBridge API service degraded or infrastructure unavailable',
      error: {
        name: 'ServiceUnavailableError',
        database: isDbHealthy ? 'connected' : 'disconnected',
        redis: isRedisHealthy ? 'connected' : 'disconnected',
      },
      data: healthData,
    });
  })
);

export const healthRoutes = router;
