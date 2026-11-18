import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const getPrismaClient = (): PrismaClient => {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
};

export const prisma = getPrismaClient();

export const connectDatabase = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await Promise.race([
      client.$connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timed out')), 10000)
      ),
    ]);
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timed out')), 10000)
      ),
    ]);
    console.log('[Database] PostgreSQL connection established successfully.');
    return true;
  } catch (error) {
    console.error(
      '[Database] Failed to connect to PostgreSQL:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (globalForPrisma.prisma) {
    try {
      await globalForPrisma.prisma.$disconnect();
      globalForPrisma.prisma = undefined;
      console.log('[Database] PostgreSQL connection disconnected.');
    } catch (error) {
      console.error('[Database] Error while disconnecting PostgreSQL:', error);
    }
  }
};

export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database check timed out')), 5000)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
};
