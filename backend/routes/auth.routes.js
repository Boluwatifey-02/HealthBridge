const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { findUserByEmail } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../lib/http');
const { recordAudit } = require('../lib/audit');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required.');
    }

    const user = await findUserByEmail(email);

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const storedHash = user.password_hash;

    if (!storedHash) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // A suspended account must not be able to sign in. This check was missing,
    // so deactivating a staff member had no effect until the database was
    // edited by hand.
    if (user.status !== 'Active') {
      throw ApiError.forbidden(
        'This account has been deactivated. Contact an administrator to restore access.'
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new ApiError(500, 'Authentication is not configured on the server.');
    }

    const token = jwt.sign(
      {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        branch: user.branch_id,
        // Distinguishes a staff token from a patient portal token, so neither can
        // be used where the other is expected.
        audience: 'staff',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await recordAudit(
      { id: user.id, fullName: user.full_name, role: user.role },
      'LOGIN',
      'Signed in to the HealthBridge workspace.'
    );

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        branch: user.branch_id,
      },
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    return res.json({ user: req.user });
  })
);

module.exports = router;
