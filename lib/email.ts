import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';
import { appConfig } from '@/config/app';

// Create SMTP transporter or fallback to file transport
async function createTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // If SMTP credentials are available, try to use SMTP
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: appConfig.email.host,
        port: appConfig.email.port,
        secure: false, // Use STARTTLS
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Verify connection
      await transporter.verify();
      console.log('[email] ✓ SMTP connection verified');
      return transporter;
    } catch (error) {
      console.warn('[email] ⚠ SMTP connection failed, falling back to file transport:', error);
    }
  } else {
    console.warn('[email] ⚠ SMTP credentials not found, using file transport');
  }

  // Fallback to file transport for development
  const mailDir = '/tmp/mails';
  await fs.mkdir(mailDir, { recursive: true });
  
  const fileTransporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
  });

  console.log(`[email] ✓ File transport enabled, emails will be written to ${mailDir}`);
  
  return {
    ...fileTransporter,
    async sendMail(mailOptions: any) {
      const result = await fileTransporter.sendMail(mailOptions);
      
      // Write email to file
      const timestamp = Date.now();
      const filename = `${timestamp}-${mailOptions.to.replace(/[^a-z0-9]/gi, '_')}.eml`;
      const filepath = path.join(mailDir, filename);
      
      const content = `From: ${mailOptions.from}
To: ${mailOptions.to}
Subject: ${mailOptions.subject}
Date: ${new Date().toUTCString()}

${mailOptions.text || ''}

${mailOptions.html ? '\n---HTML VERSION---\n' + mailOptions.html : ''}`;

      await fs.writeFile(filepath, content);
      console.log(`[email] ✉ Email saved to ${filepath}`);
      
      return result;
    },
  };
}

let transporterPromise: Promise<any> | null = null;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }
  return transporterPromise;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const transporter = await getTransporter();
  
  const mailOptions = {
    from: appConfig.email.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendVerificationEmail(email: string, token: string, baseUrl?: string) {
  // Use provided baseUrl (from request) or fall back to appConfig.url
  const base = baseUrl || appConfig.url;
  const verifyUrl = `${base}/api/auth/verify?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: 'Verify your TrackMyBird account',
    text: `Welcome to TrackMyBird!\n\nPlease verify your email address by clicking this link:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.`,
    html: `
      <h2>Welcome to TrackMyBird!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${verifyUrl}</p>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string, baseUrl?: string) {
  // Use provided baseUrl (from request) or fall back to appConfig.url
  const base = baseUrl || appConfig.url;
  const resetUrl = `${base}/reset-password?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: 'Reset your TrackMyBird password',
    text: `You requested to reset your password.\n\nClick this link to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <h2>Reset your password</h2>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${resetUrl}</p>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
    `,
  });
}
