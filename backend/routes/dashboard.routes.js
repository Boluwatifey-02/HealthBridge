const express = require('express');

const { getDashboardMetrics } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const summary = await getDashboardMetrics();
  res.json(summary);
});

module.exports = router;
