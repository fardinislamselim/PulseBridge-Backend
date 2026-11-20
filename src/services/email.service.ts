import { env } from '../config/env.js';
import { renderEmailTemplate } from '../utils/email-renderer.js';
import {
  sendEmail as dispatchEmail,
  getEmailTransporter,
  verifyEmailTransporter,
  type SendEmailOptions,
} from '../utils/email-sender.js';

export { getEmailTransporter, verifyEmailTransporter, type SendEmailOptions };

export interface SendTemplateEmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
  from?: string;
}

/**
 * Sends a raw HTML email using the centralized email sender utility.
 * Kept for backwards compatibility and direct sending needs.
 */
export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  try {
    await dispatchEmail(options);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EmailService] Failed to send email to recipient: ${message}`);
    return false;
  }
};

/**
 * Renders an EJS template and dispatches the email using the centralized email sender utility.
 */
export const sendTemplateEmail = async (options: SendTemplateEmailOptions): Promise<boolean> => {
  try {
    const rendered = await renderEmailTemplate(options.template, {
      ...options.data,
      subject: options.subject,
    });

    await dispatchEmail({
      to: options.to,
      subject: options.subject,
      html: rendered.html,
      text: rendered.text,
      from: options.from,
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EmailService] Failed to send template email: ${message}`);
    return false;
  }
};

// ==========================================
// Specialized Domain Email Helpers
// ==========================================

export const sendWelcomeEmail = async (
  email: string,
  name: string,
  profileUrl?: string
): Promise<boolean> => {
  const subject = 'Welcome to PulseBridge - Connect, Donate, Save Lives';
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'welcome',
    data: {
      name,
      profileUrl: profileUrl || `${env.FRONTEND_URL}/profile`,
      dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
      subject,
    },
  });
};

export const sendVerificationEmail = async (
  email: string,
  verificationUrl: string,
  name?: string
): Promise<boolean> => {
  const subject = 'Verify your PulseBridge Account';
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'email-verification',
    data: {
      name: name || 'Valued Member',
      verificationUrl,
      subject,
    },
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  resetUrl: string,
  name?: string
): Promise<boolean> => {
  const subject = 'Password Reset Request - PulseBridge';
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'password-reset',
    data: {
      name: name || 'PulseBridge User',
      resetUrl,
      expiresInMinutes: 15,
      subject,
    },
  });
};

export interface BloodRequestCreatedData {
  recipientName: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  hospitalName: string;
  hospitalAddress: string;
  contactNumber: string;
  neededBy: string;
  requestUrl?: string;
}

export const sendBloodRequestCreatedEmail = async (
  email: string,
  details: BloodRequestCreatedData
): Promise<boolean> => {
  const subject = `Blood Request Confirmation: ${details.units} Unit(s) of ${details.bloodGroup}`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'blood-request-created',
    data: {
      ...details,
      subject,
    },
  });
};

export interface EmergencyBloodRequestData {
  donorName: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  hospitalName: string;
  hospitalAddress: string;
  contactNumber: string;
  neededBy: string;
  urgencyLevel?: 'CRITICAL' | 'HIGH' | 'EMERGENCY';
  actionUrl?: string;
}

export const sendEmergencyBloodRequestEmail = async (
  email: string,
  details: EmergencyBloodRequestData
): Promise<boolean> => {
  const subject = `URGENT EMERGENCY: ${details.bloodGroup} Blood Needed Immediately at ${details.hospitalName}`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'emergency-blood-request',
    data: {
      ...details,
      subject,
    },
  });
};

export interface DonorAssignmentData {
  donorName: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  hospitalName: string;
  hospitalAddress: string;
  contactPerson: string;
  contactNumber: string;
  donationTime: string;
  assignmentUrl?: string;
}

export const sendDonorAssignmentEmail = async (
  email: string,
  details: DonorAssignmentData
): Promise<boolean> => {
  const subject = `Action Required: You are Assigned to a Donation (${details.bloodGroup})`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'donor-assignment',
    data: {
      ...details,
      subject,
    },
  });
};

export interface DonationConfirmationData {
  donorName: string;
  bloodGroup: string;
  unitsDonated: number;
  hospitalName: string;
  donationDate: string;
  nextEligibleDate: string;
  certificateUrl?: string;
}

export const sendDonationConfirmationEmail = async (
  email: string,
  details: DonationConfirmationData
): Promise<boolean> => {
  const subject = 'Thank You for Saving Lives! Donation Completed - PulseBridge';
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'donation-confirmation',
    data: {
      ...details,
      subject,
    },
  });
};

export interface PaymentSuccessData {
  name: string;
  invoiceId: string;
  amount: string;
  currency?: string;
  purpose: string;
  paymentMethod: string;
  date: string;
  receiptUrl?: string;
}

export const sendPaymentSuccessEmail = async (
  email: string,
  details: PaymentSuccessData
): Promise<boolean> => {
  const subject = `Payment Received: Receipt #${details.invoiceId} - PulseBridge`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'payment-success',
    data: {
      currency: 'BDT',
      ...details,
      subject,
    },
  });
};

export interface PaymentFailedData {
  name: string;
  invoiceId: string;
  amount: string;
  currency?: string;
  failureReason?: string;
  retryUrl?: string;
}

export const sendPaymentFailedEmail = async (
  email: string,
  details: PaymentFailedData
): Promise<boolean> => {
  const subject = `Payment Notice: Transaction Unsuccessful for Invoice #${details.invoiceId}`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'payment-failed',
    data: {
      currency: 'BDT',
      ...details,
      subject,
    },
  });
};

export interface PaymentRefundData {
  name: string;
  invoiceId: string;
  amount: string;
  totalRefunded?: string;
  reason?: string;
  status?: string;
  date: string;
}

export const sendPaymentRefundEmail = async (
  email: string,
  details: PaymentRefundData
): Promise<boolean> => {
  const subject = `Payment Refund Notice: Invoice #${details.invoiceId} - PulseBridge`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'payment-refund',
    data: {
      ...details,
      subject,
    },
  });
};

export interface AccountStatusData {
  name: string;
  status: 'ACTIVE' | 'VERIFIED' | 'BLOCKED' | 'SUSPENDED';
  reason?: string;
  effectiveDate?: string;
  actionUrl?: string;
}

export const sendAccountStatusEmail = async (
  email: string,
  details: AccountStatusData
): Promise<boolean> => {
  const subject = `PulseBridge Account Status Update: ${details.status}`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'account-status',
    data: {
      ...details,
      subject,
    },
  });
};

export const sendEmailVerificationOtpEmail = async (
  email: string,
  otp: string,
  name?: string
): Promise<boolean> => {
  const subject = 'Your PulseBridge Verification Code';
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'email-verification-otp',
    data: {
      name: name || 'Valued Member',
      otp,
      expiresInMinutes: Math.round(env.OTP_EXPIRES_IN / 60) || 5,
      subject,
    },
  });
};

export const sendPasswordResetOtpEmail = async (
  email: string,
  otp: string,
  name?: string
): Promise<boolean> => {
  const subject = 'Your PulseBridge Password Reset Code';
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'password-reset-otp',
    data: {
      name: name || 'User',
      otp,
      expiresInMinutes: Math.round(env.OTP_EXPIRES_IN / 60) || 5,
      subject,
    },
  });
};

export interface BloodRequestStatusEmailData {
  recipientName: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  hospitalName: string;
  hospitalAddress?: string;
  contactNumber?: string;
  neededBy?: string;
  status: string;
  reason?: string;
  requestUrl?: string;
}

export const sendBloodRequestStatusEmail = async (
  email: string,
  details: BloodRequestStatusEmailData
): Promise<boolean> => {
  const subject = `Update: Blood Request for ${details.patientName} is ${details.status}`;
  return sendTemplateEmail({
    to: email,
    subject,
    template: 'blood-request-created',
    data: {
      ...details,
      subject,
    },
  });
};
