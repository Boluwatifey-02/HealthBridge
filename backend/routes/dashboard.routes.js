const express = require('express');

const { getDashboardMetrics } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const summary = await getDashboardMetrics();
  res.json(summary);
});

module.exports = router;
