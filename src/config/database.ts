import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

let prismaInstance: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
};

export const prisma = getPrismaClient();

export const connectDatabase = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await Promise.race([
      client.$connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timed out')), 2000)
      ),
    ]);
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timed out')), 2000)
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
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
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
        setTimeout(() => reject(new Error('Database check timed out')), 1500)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
};
