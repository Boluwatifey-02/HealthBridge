const express = require('express');
const bcrypt = require('bcrypt');

const { query, isFallbackMode } = require('../config/db');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const { isEmailConfigured, sendPasswordResetEmail } = require('../services/email');
const { issueToken, findValidToken, consumeTokenAndSetPassword } = require('../services/resetTokens');
const { getFrontendOrigin } = require('./passwordReset.routes');
const v = require('../lib/validation');

const router = express.Router();

const BCRYPT_ROUNDS = 10;

function isDemoLinkEnabled() {
  return process.env.DEMO_PASSWORD_RESET_LINK === 'true';
}

/*
 * Step 1: a patient requests a reset link.
 *
 * Mirrors the staff flow exactly, including the identical reply for unknown
 * addresses so this cannot be used to discover which emails belong to patients.
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const email = v.email((req.body || {}).email, 'Email address', { required: true });

    const emailReady = isEmailConfigured();

    const [rows] = isFallbackMode()
      ? [[]]
      : await query(
          'SELECT id, full_name, email, status FROM patients WHERE email = ? LIMIT 1',
          [email]
        );

    const patient = rows[0];

    const acknowledgement = {
      message: emailReady
        ? `If an account exists for ${email}, a password reset link has been sent.`
        : `If an account exists for ${email}, a password reset link has been created.`,
      emailDelivery: emailReady ? 'email' : 'not-configured',
    };

    if (!patient) {
      return res.json(acknowledgement);
    }

    const { token } = await issueToken('patient', patient.id);
    const resetUrl = `${getFrontendOrigin()}/patient-reset-password?token=${token}`;

    await sendPasswordResetEmail(patient.email, patient.full_name || 'there', resetUrl);

    if (!emailReady) {
      acknowledgement.deliveryNote =
        'This deployment has no email provider configured, so no message was sent.';

      if (isDemoLinkEnabled()) {
        acknowledgement.resetUrl = resetUrl;
        acknowledgement.deliveryNote += ' Demo mode is enabled, so the reset link is shown here instead.';
      } else {
        acknowledgement.deliveryNote +=
          ' Please contact the clinic, or configure SMTP so reset emails can be sent.';
      }
    }

    return res.json(acknowledgement);
  })
);

router.get(
  '/reset-password/verify',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
      throw ApiError.badRequest('A reset token is required.');
    }

    const record = await findValidToken('patient', token);

    if (!record) {
      throw ApiError.badRequest('This reset link is invalid or has expired.');
    }

    return res.json({ valid: true, expiresAt: record.expires_at });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password, confirmPassword } = req.body || {};
    const trimmedToken = String(token || '').trim();

    if (!trimmedToken) {
      throw ApiError.badRequest('A reset token is required.');
    }

    const newPassword = v.password(password);
    const confirmation = String(confirmPassword || '');

    if (newPassword !== confirmation) {
      throw ApiError.badRequest('The two passwords do not match.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const applied = await consumeTokenAndSetPassword('patient', trimmedToken, passwordHash);

    if (!applied) {
      throw ApiError.badRequest('This reset link is invalid or has expired.');
    }

    await recordAudit(
      { id: null, fullName: 'Patient password reset', role: 'Patient' },
      'PATIENT_PASSWORD_RESET',
      'A patient reset their portal password.'
    );

    return res.json({ message: 'Your password has been updated. You can now sign in.' });
  })
);

module.exports = router;
