import type { Server } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';

let server: Server | null = null;

export const startServer = async (): Promise<Server> => {
  try {
    console.log(`[PulseBridge] Starting application in ${env.NODE_ENV} mode...`);

    // Verify infrastructure connections
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
      console.warn('[PulseBridge] Notice: Database connection was not established at boot.');
    }

    const redisConnected = await connectRedis();
    if (!redisConnected) {
      console.warn('[PulseBridge] Notice: Redis connection was not established at boot.');
    }

    return new Promise((resolve) => {
      server = app.listen(env.PORT, () => {
        console.log(`[PulseBridge] Server listening on port ${env.PORT}`);
        console.log(
          `[PulseBridge] Health endpoint ready at: http://localhost:${env.PORT}${env.API_PREFIX}/health`
        );
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
