const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { findUserByEmail } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const storedHash = user.passwordHash || user.password_hash;
  const isValid = await bcrypt.compare(password, storedHash);

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    {
      id: user.id || user.staff_id,
      fullName: user.fullName || user.full_name,
      email: user.email,
      role: user.role,
      branch: user.branch || user.branch_id,
    },
    process.env.JWT_SECRET || 'healthbridge-local-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({
    token,
    user: {
      id: user.id || user.staff_id,
      fullName: user.fullName || user.full_name,
      email: user.email,
      role: user.role,
      branch: user.branch || user.branch_id,
    },
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
