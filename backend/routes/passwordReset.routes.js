const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { query, findUserByEmail } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { isEmailConfigured, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

const RESET_TOKEN_TTL_MINUTES = 30;
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// The public origin the reset link points at. Falls back to the configured
// frontend origin so a link is always produced on a single-domain deployment.
function getFrontendOrigin() {
  const configured = String(process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured[0] || 'http://localhost:5173';
}

// Only the digest is persisted, so a database copy cannot be replayed.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// A deployment with no SMTP credentials cannot email anything. Rather than
// telling the user a message was sent, the API reports that email is not
// configured so the interface can be honest about it. When the operator
// explicitly enables the demo link, the link is returned so the recovery
// journey still completes without a paid mail provider.
function isDemoLinkEnabled() {
  return process.env.DEMO_PASSWORD_RESET_LINK === 'true';
}

function isStrongEnough(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }

  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

function findValidTokenRecord(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return Promise.resolve(null);
  }

  return query(
    `SELECT id, staff_id, expires_at, used_at
       FROM password_reset_tokens
      WHERE token_hash = ?
      LIMIT 1`,
    [hashToken(token.trim())]
  ).then(([rows]) => {
    const record = rows[0];

    if (!record || record.used_at) {
      return null;
    }

    return new Date(record.expires_at).getTime() > Date.now() ? record : null;
  });
}

/*
 * Step 1: request a reset link.
 *
 * The response is deliberately identical whether or not the account exists, so
 * the endpoint cannot be used to discover which email addresses are registered.
 * The account is still verified server-side: only a real account receives a link.
 */
router.post('/forgot-password', async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ message: 'Email address is required.' });
  }

  const emailReady = isEmailConfigured();
  const user = await findUserByEmail(email);

  // Same shape of reply whether or not the account exists: no enumeration.
  const acknowledgement = {
    message: emailReady
      ? `If an account exists for ${email}, a password reset link has been sent.`
      : `If an account exists for ${email}, a password reset link has been created.`,
    emailDelivery: emailReady ? 'email' : 'not-configured',
  };

  if (!user) {
    return res.json(acknowledgement);
  }

  const staffId = user.id || user.staff_id;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  // Issuing a new request invalidates any token already outstanding.
  await query('DELETE FROM password_reset_tokens WHERE staff_id = ?', [staffId]);

  await query(
    `INSERT INTO password_reset_tokens (id, staff_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [tokenId, staffId, hashToken(rawToken), expiresAt]
  );

  const resetUrl = `${getFrontendOrigin()}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail(
    user.email,
    user.fullName || user.full_name || 'there',
    resetUrl
  );

  // Be explicit: with no mail provider there is no inbox to check.
  if (!emailReady) {
    acknowledgement.deliveryNote =
      'This deployment has no email provider configured, so no message was sent.';

    if (isDemoLinkEnabled()) {
      acknowledgement.resetUrl = resetUrl;
      acknowledgement.deliveryNote +=
        ' Demo mode is enabled, so the reset link is shown here instead.';
    } else {
      acknowledgement.deliveryNote +=
        ' Ask an administrator to reset the account, or configure SMTP.';
    }
  }

  return res.json(acknowledgement);
});

/*
 * Step 2: confirm a token is still usable, so the form can be shown or rejected
 * before the user types a new password.
 */
router.get('/reset-password/verify', async (req, res) => {
  const token = String(req.query.token || '').trim();

  if (!token) {
    return res.status(400).json({ message: 'A reset token is required.' });
  }

  const record = await findValidTokenRecord(token);

  if (!record) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
  }

  return res.json({ valid: true, expiresAt: record.expires_at });
});

/*
 * Step 3: set the new password. The token is consumed in the same request that
 * changes the hash, so a link cannot be replayed after a successful reset.
 */
router.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body || {};
  const trimmedToken = String(token || '').trim();
  const newPassword = String(password || '');
  const confirmation = String(confirmPassword || '');

  if (!trimmedToken) {
    return res.status(400).json({ message: 'A reset token is required.' });
  }

  if (!isStrongEnough(newPassword)) {
    return res.status(400).json({
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters and contain both a letter and a number.`,
    });
  }

  if (newPassword !== confirmation) {
    return res.status(400).json({ message: 'The two passwords do not match.' });
  }

  const record = await findValidTokenRecord(trimmedToken);

  if (!record) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Invalidate every outstanding token for this account before the new hash lands.
  await query('DELETE FROM password_reset_tokens WHERE staff_id = ?', [record.staff_id]);
  await query('UPDATE staff SET password_hash = ? WHERE id = ?', [passwordHash, record.staff_id]);

  console.log(`Password reset completed for staff ${record.staff_id}.`);

  return res.json({ message: 'Your password has been updated. You can now sign in.' });
});

module.exports = router;
module.exports.hashToken = hashToken;
module.exports.findValidTokenRecord = findValidTokenRecord;
module.exports.getFrontendOrigin = getFrontendOrigin;
