/*
 * Password-reset email delivery.
 *
 * Uses nodemailer against any standard SMTP server. Nodemailer is MIT licensed
 * and SMTP accounts from providers such as Gmail (app passwords), Outlook, or
 * Mailtrap are free, so no paid mail service is required.
 *
 * Delivery is optional by design. When SMTP is not configured the reset link is
 * written to the server log instead of being emailed, which keeps the feature
 * usable in development and in a deployment that has no mail credentials yet.
 * The link is never returned in an API response.
 */

const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;

  if (!host) {
    return null;
  }

  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  };
}

function isEmailConfigured() {
  return getSmtpConfig() !== null;
}

function buildResetEmail(recipientName, resetUrl) {
  return {
    from: process.env.SMTP_FROM || 'HealthBridge <no-reply@healthbridge.org>',
    to: recipientName,
    subject: 'Reset your HealthBridge password',
    text: [
      `Hello ${recipientName},`,
      '',
      'A password reset was requested for your HealthBridge account.',
      'Open the link below to choose a new password:',
      '',
      resetUrl,
      '',
      'This link expires in 30 minutes and can only be used once.',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1f2933;">
        <h2 style="margin: 0 0 16px;">Reset your HealthBridge password</h2>
        <p>Hello ${recipientName},</p>
        <p>A password reset was requested for your HealthBridge account.
           Choose a new password using the button below.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #0f766e; color: #ffffff; padding: 12px 20px;
                    border-radius: 6px; text-decoration: none; display: inline-block;">
            Reset my password
          </a>
        </p>
        <p style="font-size: 13px; color: #52606d;">
          This link expires in 30 minutes and can only be used once.
          If you did not request a reset, you can safely ignore this email.
        </p>
      </div>
    `.trim(),
  };
}

async function sendPasswordResetEmail(recipientEmail, recipientName, resetUrl) {
  const smtp = getSmtpConfig();
  const mail = buildResetEmail(recipientEmail, resetUrl);

  if (!smtp) {
    // No mail credentials configured: record the link in the server log instead.
    console.log('SMTP is not configured; password reset link written to the log:');
    console.log(`  PASSWORD_RESET_LINK: ${resetUrl}`);
    return { delivered: false, channel: 'log' };
  }

  try {
    const transport = nodemailer.createTransport(smtp);
    await transport.sendMail(mail);
    console.log(`Password reset email sent to ${recipientEmail}.`);
    return { delivered: true, channel: 'email' };
  } catch (error) {
    // A mail outage must not lock the user out of their own account.
    console.error('Password reset email could not be sent:', error.message);
    console.log(`PASSWORD_RESET_LINK: ${resetUrl}`);
    return { delivered: false, channel: 'log' };
  }
}

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
};
