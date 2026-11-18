import type { OtpPurpose } from './otp.types.js';

export const OTP_CONSTANTS = {
  DEFAULT_LENGTH: 6,
  DEFAULT_EXPIRES_IN_SECONDS: 300, // 5 minutes
  DEFAULT_RESEND_COOLDOWN_SECONDS: 60, // 60 seconds
  DEFAULT_MAX_ATTEMPTS: 5,
  DEFAULT_PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS: 600, // 10 minutes
} as const;

export const getOtpKey = (purpose: OtpPurpose, email: string): string => {
  return `pulsebridge:otp:${purpose}:${email.toLowerCase().trim()}`;
};

export const getOtpAttemptsKey = (purpose: OtpPurpose, email: string): string => {
  return `pulsebridge:otp:${purpose}:attempts:${email.toLowerCase().trim()}`;
};

export const getOtpCooldownKey = (purpose: OtpPurpose, email: string): string => {
  return `pulsebridge:otp:${purpose}:cooldown:${email.toLowerCase().trim()}`;
};

export const getPasswordResetTokenKey = (tokenHash: string): string => {
  return `pulsebridge:password-reset-token:${tokenHash}`;
};
