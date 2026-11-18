import 'dotenv/config';
import { z } from 'zod';

const coerceNumber = (defaultVal: number) =>
  z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return defaultVal;
      return val;
    }, z.coerce.number().int().positive())
    .default(defaultVal);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: coerceNumber(5000),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: coerceNumber(6379),
  REDIS_USER: z.string().default('default'),
  REDIS_PASSWORD: z.string().optional().default(''),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  ADMIN_NAME: z.string().optional().default('Admin User'),
  ADMIN_EMAIL: z.string().optional().default('admin@pulsebridge.com'),
  ADMIN_PASSWORD: z.string().optional().default('AdminPassword123!'),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (configRecord: Record<string, unknown> = process.env): Env => {
  const result = envSchema.safeParse(configRecord);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formattedErrors}`);
  }

  return result.data;
};

export const env = validateEnv();

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  api_prefix: env.API_PREFIX,
  database_url: env.DATABASE_URL,
  redis_url: env.REDIS_URL,
  redis_host: env.REDIS_HOST,
  redis_port: env.REDIS_PORT,
  redis_user: env.REDIS_USER,
  redis_password: env.REDIS_PASSWORD,
  jwt_access_secret: env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,
  frontend_url: env.FRONTEND_URL,
  admin_name: env.ADMIN_NAME,
  admin_email: env.ADMIN_EMAIL,
  admin_password: env.ADMIN_PASSWORD,
};

export default config;
