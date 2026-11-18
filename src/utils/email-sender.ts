import nodemailer from 'nodemailer';
import type { Transporter, SentMessageInfo } from 'nodemailer';
import { config, env } from '../config/env.js';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

// Module-level reusable transporter singleton
let transporterInstance: Transporter | null = null;

/**
 * Returns or creates the centralized reusable Nodemailer transporter using Gmail SMTP.
 * In test environment, uses an in-memory jsonTransport to prevent external network traffic.
 */
export const getEmailTransporter = (): Transporter => {
  if (transporterInstance) {
    return transporterInstance;
  }

  if (env.NODE_ENV === 'test') {
    transporterInstance = nodemailer.createTransport({
      jsonTransport: true,
    });
    return transporterInstance;
  }

  transporterInstance = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    },
  });

  return transporterInstance;
};

/**
 * Verifies the Gmail SMTP transporter connection during application startup.
 */
export const verifyEmailTransporter = async (): Promise<boolean> => {
  if (env.NODE_ENV === 'test') {
    return true;
  }

  const user = config.EMAIL_USER;
  const pass = config.EMAIL_PASS;

  if (!user || !pass) {
    console.warn(
      '[EmailSender] Gmail credentials (EMAIL_USER, EMAIL_PASS) are not configured. Real email delivery is disabled.'
    );
    return false;
  }

  try {
    const transporter = getEmailTransporter();
    await transporter.verify();
    console.log('[EmailSender] Gmail SMTP connection verified successfully.');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP verification error';
    console.error(`[EmailSender] Gmail SMTP verification failed: ${message}`);
    return false;
  }
};

/**
 * Sends an email using the centralized Nodemailer Gmail transporter.
 * Awaits delivery, returns the SentMessageInfo result, and propagates errors without leaking credentials.
 */
export const sendEmail = async (options: SendEmailOptions): Promise<SentMessageInfo> => {
  const senderEmail = config.EMAIL_USER || 'noreply@pulsebridge.org';
  const defaultFrom = `"${config.EMAIL_FROM_NAME || 'PulseBridge'}" <${senderEmail}>`;
  const transporter = getEmailTransporter();

  try {
    const info = await transporter.sendMail({
      from: options.from || defaultFrom,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return info;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP transmission error';
    console.error(`[EmailSender] Failed to dispatch email: ${message}`);
    throw error;
  }
};
