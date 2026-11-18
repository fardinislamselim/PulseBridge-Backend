import httpStatus from 'http-status';
import { redisClient, connectRedis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import type { OtpPurpose, GeneratedOtp } from './otp.types.js';
import {
  getOtpKey,
  getOtpAttemptsKey,
  getOtpCooldownKey,
  getPasswordResetTokenKey,
} from './otp.constants.js';
import {
  generateNumericOtp,
  hashOtp,
  compareOtpHash,
  generateResetToken,
  hashResetToken,
} from './otp.utils.js';

/**
 * Ensures Redis is connected before performing OTP operations.
 */
const ensureRedisConnection = async (): Promise<void> => {
  if (!redisClient.isOpen) {
    const connected = await connectRedis();
    if (!connected) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Verification service is temporarily unavailable. Please try again shortly.'
      );
    }
  }
};

/**
 * Generates and stores a cryptographically secure, hashed OTP in Redis.
 * Enforces resend cooldown and resets attempt counters.
 */
export const createAndStoreOtp = async (
  email: string,
  purpose: OtpPurpose,
  checkCooldown: boolean = true
): Promise<GeneratedOtp> => {
  await ensureRedisConnection();

  const normalizedEmail = email.toLowerCase().trim();
  const cooldownKey = getOtpCooldownKey(purpose, normalizedEmail);
  const otpKey = getOtpKey(purpose, normalizedEmail);
  const attemptsKey = getOtpAttemptsKey(purpose, normalizedEmail);

  // Check cooldown if requested
  if (checkCooldown) {
    const cooldownTtl = await redisClient.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS,
        `Please wait ${cooldownTtl} second(s) before requesting another verification code.`
      );
    }
  }

  const otp = generateNumericOtp(env.OTP_LENGTH);
  const hashed = hashOtp(otp);

  // Invalidate any active OTP and previous attempts
  await redisClient.del([otpKey, attemptsKey]);

  // Store hashed OTP with configured TTL
  await redisClient.set(otpKey, hashed, { EX: env.OTP_EXPIRES_IN });

  // Set/apply resend cooldown
  await redisClient.set(cooldownKey, '1', { EX: env.OTP_RESEND_COOLDOWN });

  return {
    otp,
    expiresInSeconds: env.OTP_EXPIRES_IN,
  };
};

/**
 * Verifies an OTP against Redis, enforcing maximum attempts and single-use consumption.
 */
export const verifyOtp = async (
  email: string,
  inputOtp: string,
  purpose: OtpPurpose
): Promise<boolean> => {
  await ensureRedisConnection();

  const normalizedEmail = email.toLowerCase().trim();
  const otpKey = getOtpKey(purpose, normalizedEmail);
  const attemptsKey = getOtpAttemptsKey(purpose, normalizedEmail);

  const storedHash = await redisClient.get(otpKey);
  if (!storedHash) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid or expired verification code. Please request a new code.'
    );
  }

  // Increment attempt counter atomically
  const currentAttempts = await redisClient.incr(attemptsKey);
  if (currentAttempts === 1) {
    await redisClient.expire(attemptsKey, env.OTP_EXPIRES_IN);
  }

  // Check if attempts exceeded maximum
  if (currentAttempts > env.OTP_MAX_ATTEMPTS) {
    await redisClient.del(otpKey);
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      'Maximum verification attempts exceeded. For security, this code has been revoked. Please request a new code.'
    );
  }

  const isValid = compareOtpHash(inputOtp.trim(), storedHash);
  if (!isValid) {
    const remainingAttempts = env.OTP_MAX_ATTEMPTS - currentAttempts;
    const hint =
      remainingAttempts > 0
        ? ` You have ${remainingAttempts} attempt(s) remaining.`
        : ' This code has now been invalidated.';
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid verification code.${hint}`);
  }

  // Atomic cleanup of OTP and attempt keys on successful verification
  await redisClient.del([otpKey, attemptsKey]);

  return true;
};

/**
 * Creates a short-lived authorization token in Redis allowing password reset.
 */
export const createPasswordResetAuthorization = async (email: string): Promise<string> => {
  await ensureRedisConnection();

  const normalizedEmail = email.toLowerCase().trim();
  const resetToken = generateResetToken();
  const tokenHash = hashResetToken(resetToken);
  const redisKey = getPasswordResetTokenKey(tokenHash);

  await redisClient.set(redisKey, normalizedEmail, {
    EX: env.PASSWORD_RESET_TOKEN_EXPIRES_IN,
  });

  return resetToken;
};

/**
 * Validates and consumes the temporary password reset authorization token.
 */
export const verifyAndConsumePasswordResetAuthorization = async (
  email: string,
  resetToken: string
): Promise<boolean> => {
  await ensureRedisConnection();

  const normalizedEmail = email.toLowerCase().trim();
  const tokenHash = hashResetToken(resetToken.trim());
  const redisKey = getPasswordResetTokenKey(tokenHash);

  const storedEmail = await redisClient.get(redisKey);
  if (!storedEmail || storedEmail.toLowerCase() !== normalizedEmail) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid or expired password reset authorization. Please restart the password reset process.'
    );
  }

  // Invalidate token immediately to prevent reuse
  await redisClient.del(redisKey);

  // Invalidate any lingering OTP keys for password reset
  const otpKey = getOtpKey('password-reset', normalizedEmail);
  const attemptsKey = getOtpAttemptsKey('password-reset', normalizedEmail);
  const cooldownKey = getOtpCooldownKey('password-reset', normalizedEmail);
  await redisClient.del([otpKey, attemptsKey, cooldownKey]);

  return true;
};

/**
 * Safely invalidates OTP, attempts, and cooldown keys in Redis for an email and purpose.
 * Used during error recovery (e.g., when email delivery fails) so the user is not
 * locked out by a cooldown or stuck with an undelivered OTP.
 */
export const invalidateOtp = async (email: string, purpose: OtpPurpose): Promise<void> => {
  try {
    if (!redisClient.isOpen) {
      await connectRedis();
    }
    const normalizedEmail = email.toLowerCase().trim();
    const otpKey = getOtpKey(purpose, normalizedEmail);
    const attemptsKey = getOtpAttemptsKey(purpose, normalizedEmail);
    const cooldownKey = getOtpCooldownKey(purpose, normalizedEmail);
    await redisClient.del([otpKey, attemptsKey, cooldownKey]);
  } catch {
    // Non-fatal if Redis cleanup fails during error recovery
  }
};

