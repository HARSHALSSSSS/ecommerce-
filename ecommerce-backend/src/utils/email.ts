import axios from 'axios';
import nodemailer from 'nodemailer';

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '';

// Verify hCaptcha
export async function verifyHCaptcha(token: string): Promise<boolean> {
  try {
    if (!HCAPTCHA_SECRET) {
      console.warn('hCaptcha secret not configured, skipping verification');
      return true;
    }

    const response = await axios.post(
      'https://hcaptcha.com/siteverify',
      { secret: HCAPTCHA_SECRET, response: token },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return response.data.success;
  } catch (error) {
    console.error('hCaptcha verification error:', error);
    return false;
  }
}

// Setup email transporter
let transporter: nodemailer.Transporter | null = null;

function getEmailTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

// Send email
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const transport = getEmailTransporter();

    await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { background-color: #E07856; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to proceed:</p>
          <a href="${resetLink}" class="button">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link expires in 1 hour.</p>
          <div class="footer">
            <p>© 2024 Ecommerce. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, 'Password Reset Request', html);
}

// Send welcome email
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome ${name}!</h2>
          <p>Thank you for registering. Your account has been created successfully.</p>
          <p>You can now log in to your account and start shopping.</p>
          <div class="footer">
            <p>© 2024 Ecommerce. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, 'Welcome to Ecommerce!', html);
}
