export type OtpPurpose = 'email-verification' | 'password-reset';

export interface StoredOtpData {
  hash: string;
  createdAt: number;
}

export interface GeneratedOtp {
  otp: string;
  expiresInSeconds: number;
}

export interface PasswordResetAuth {
  email: string;
  resetToken: string;
}
