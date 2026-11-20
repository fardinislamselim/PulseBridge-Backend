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
  BACKEND_URL: z.string().default('http://localhost:5000'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  EMAIL_HOST: z.string().optional().default(''),
  EMAIL_PORT: coerceNumber(587),
  EMAIL_USER: z.string().optional().default(''),
  EMAIL_PASS: z.string().optional().default(''),
  EMAIL_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  EMAIL_FROM_NAME: z.string().optional().default('PulseBridge'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return val;
    }, z.coerce.number().int().positive().optional())
    .optional(),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  ADMIN_NAME: z.string().optional().default('Admin User'),
  ADMIN_EMAIL: z.string().optional().default('admin@pulsebridge.com'),
  ADMIN_PASSWORD: z.string().optional().default('AdminPassword123!'),
  SEED_ADMIN_PASSWORD: z.string().optional().default('AdminPassword123!'),
  OTP_LENGTH: coerceNumber(6),
  OTP_EXPIRES_IN: coerceNumber(300),
  OTP_RESEND_COOLDOWN: coerceNumber(60),
  OTP_MAX_ATTEMPTS: coerceNumber(5),
  OTP_HASH_SECRET: z
    .string()
    .optional()
    .default('pulsebridge-default-otp-hash-secret-change-in-production'),
  PASSWORD_RESET_TOKEN_EXPIRES_IN: coerceNumber(600),

  // Payment Configuration
  PAYMENT_DEFAULT_PROVIDER: z.enum(['SSLCOMMERZ', 'STRIPE']).default('SSLCOMMERZ'),
  PAYMENT_MIN_AMOUNT: coerceNumber(10),
  PAYMENT_MAX_AMOUNT: coerceNumber(500000),
  PAYMENT_PENDING_TIMEOUT_MINUTES: coerceNumber(60),
  PAYMENT_RECONCILIATION_INTERVAL_MINUTES: coerceNumber(15),

  // SSLCommerz
  SSLCOMMERZ_STORE_ID: z.string().optional().default(''),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional().default(''),
  SSLCOMMERZ_IS_LIVE: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false),
  SSLCOMMERZ_SUCCESS_URL: z.string().optional().default(''),
  SSLCOMMERZ_FAIL_URL: z.string().optional().default(''),
  SSLCOMMERZ_CANCEL_URL: z.string().optional().default(''),
  SSLCOMMERZ_IPN_URL: z.string().optional().default(''),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_SUCCESS_URL: z.string().optional().default(''),
  STRIPE_CANCEL_URL: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (configRecord: Record<string, unknown> = process.env): Env => {
  const mergedRecord = {
    ...configRecord,
    EMAIL_PASS:
      configRecord.EMAIL_PASS ||
      configRecord.EMAIL_PASSWORD ||
      configRecord.SMTP_PASS ||
      '',
  };

  const result = envSchema.safeParse(mergedRecord);

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
  backend_url: env.BACKEND_URL,
  cookie_domain: env.COOKIE_DOMAIN,
  google_client_id: env.GOOGLE_CLIENT_ID,
  email_host: env.EMAIL_HOST,
  email_port: env.EMAIL_PORT,
  email_user: env.EMAIL_USER,
  email_pass: env.EMAIL_PASS,
  email_password: env.EMAIL_PASS,
  email_from: env.EMAIL_FROM || env.EMAIL_USER,
  email_from_name: env.EMAIL_FROM_NAME,
  EMAIL_USER: env.EMAIL_USER,
  EMAIL_PASS: env.EMAIL_PASS,
  EMAIL_FROM_NAME: env.EMAIL_FROM_NAME,
  admin_name: env.ADMIN_NAME,
  admin_email: env.ADMIN_EMAIL,
  admin_password: env.ADMIN_PASSWORD,
  seed_admin_password: env.SEED_ADMIN_PASSWORD,
  otp_length: env.OTP_LENGTH,
  otp_expires_in: env.OTP_EXPIRES_IN,
  otp_resend_cooldown: env.OTP_RESEND_COOLDOWN,
  otp_max_attempts: env.OTP_MAX_ATTEMPTS,
  otp_hash_secret: env.OTP_HASH_SECRET,
  password_reset_token_expires_in: env.PASSWORD_RESET_TOKEN_EXPIRES_IN,
};

export default config;
