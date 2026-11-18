import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { globalRateLimiter } from './middlewares/rateLimiter.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { appRouter } from './routes/index.js';
import { docsRouter } from './docs/swagger.js';
import { sendSuccess } from './utils/ApiResponse.js';

export const createApp = (): Application => {
  const app = express();

  // Trust proxy for reverse proxies / load balancers
  app.set('trust proxy', 1);

  // Security headers (relaxed CSP for Swagger UI)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: [env.FRONTEND_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request logger
  app.use(requestLogger);

  // Global rate limiter
  app.use(globalRateLimiter);

  // Root welcome route
  app.get('/', (_req, res) => {
    sendSuccess(res, 'PulseBridge API service is active', {
      name: 'PulseBridge Backend',
      version: '1.0.0',
      health: `${env.API_PREFIX}/health`,
      docs: '/api-docs',
    });
  });

  // Documentation Routes (Swagger UI, OpenAPI JSON & YAML, Postman collection)
  app.use(docsRouter);

  // Mount primary API v1 router
  app.use(env.API_PREFIX, appRouter);

  // 404 Not Found handler
  app.use(notFound);

  // Centralized Global Error handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
