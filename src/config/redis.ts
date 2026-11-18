import { createClient, type RedisClientType } from 'redis';
import config from './env.js';

export const redisClient: RedisClientType = createClient({
  username: config.redis_user || undefined,
  password: config.redis_password || undefined,
  socket: {
    host: config.redis_host,
    port: Number(config.redis_port),
    connectTimeout: 1000,
    reconnectStrategy: false,
  },
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully.');
});

redisClient.on('ready', () => {
  console.log('[Redis] Client is ready for commands.');
});

redisClient.on('error', (err) => {
  // Suppress uncaught error crash
  if (config.env !== 'test') {
    console.error('[Redis] Error encountered:', err.message);
  }
});

redisClient.on('end', () => {
  if (config.env !== 'test') {
    console.warn('[Redis] Connection closed.');
  }
});

export const connectRedis = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await Promise.race([
        redisClient.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timed out')), 1500)
        ),
      ]);
    }
    await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timed out')), 1500)),
    ]);
    console.log('[Redis] Connection verified via ping.');
    return true;
  } catch (error) {
    console.error('[Redis] Failed to connect:', error instanceof Error ? error.message : error);
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log('[Redis] Client disconnected.');
    } catch (error) {
      console.error('[Redis] Error during quit:', error);
      await redisClient.disconnect();
    }
  }
};

export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await Promise.race([
        redisClient.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis check timed out')), 1000)
        ),
      ]);
    }
    const pingResult = await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timed out')), 1000)),
    ]);
    return pingResult === 'PONG';
  } catch {
    return false;
  }
};

export const redis = redisClient;
