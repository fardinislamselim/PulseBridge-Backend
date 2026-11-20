import type { Server } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { printStartupBanner } from './utils/startup-logger.js';
import { verifyEmailTransporter } from './utils/email-sender.js';
import {
  startBloodRequestExpirationCron,
  stopBloodRequestExpirationCron,
} from './modules/requests/request-expiration.service.js';
import {
  startPaymentReconciliationCron,
  stopPaymentReconciliationCron,
} from './modules/payments/payment-reconciliation.service.js';

let server: Server | null = null;

export const startServer = async (): Promise<Server> => {
  try {
    // Verify infrastructure connections
    const [dbConnected, redisConnected] = await Promise.all([connectDatabase(), connectRedis()]);
    void verifyEmailTransporter();

    return new Promise((resolve) => {
      server = app.listen(env.PORT, () => {
        printStartupBanner({
          port: env.PORT,
          dbConnected,
          redisConnected,
        });
        startBloodRequestExpirationCron();
        startPaymentReconciliationCron();
        resolve(server!);
      });
    });
  } catch (error) {
    console.error('[PulseBridge] Fatal startup error:', error);
    process.exit(1);
  }
};

export const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`[PulseBridge] Received ${signal}. Commencing graceful shutdown...`);

  stopBloodRequestExpirationCron();
  stopPaymentReconciliationCron();

  if (server) {
    server.close(() => {
      console.log('[PulseBridge] HTTP server closed.');
    });
  }

  try {
    await Promise.all([disconnectDatabase(), disconnectRedis()]);
    console.log('[PulseBridge] Infrastructure connections closed cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[PulseBridge] Error encountered during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('[PulseBridge] Uncaught Exception:', error);
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[PulseBridge] Unhandled Rejection:', reason);
  void gracefulShutdown('unhandledRejection');
});

// Auto-start only when executed as the main script
if (process.env.NODE_ENV !== 'test') {
  void startServer();
}
