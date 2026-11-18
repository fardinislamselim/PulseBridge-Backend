import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Generates a cryptographically secure numeric OTP preserving leading zeroes.
 */
export const generateNumericOtp = (length: number = env.OTP_LENGTH || 6): string => {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
};

/**
 * Computes an HMAC-SHA256 hash of an OTP using the configured OTP hash secret.
 */
export const hashOtp = (otp: string, secret: string = env.OTP_HASH_SECRET || ''): string => {
  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
};

/**
 * Timing-safe comparison of provided OTP against stored hash.
 */
export const compareOtpHash = (
  inputOtp: string,
  storedHash: string,
  secret: string = env.OTP_HASH_SECRET || ''
): boolean => {
  const inputHash = hashOtp(inputOtp, secret);
  const inputBuffer = Buffer.from(inputHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
};

/**
 * Generates a high-entropy random token for temporary password reset authorization.
 */
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * SHA-256 hash for reset tokens stored in Redis.
 */
export const hashResetToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
