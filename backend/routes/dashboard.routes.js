const express = require('express');

const { getDashboardMetrics } = require('../services/dashboard');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { asyncHandler } = require('../lib/http');

const router = express.Router();
router.use(authenticate, staffOnly);

router.get(
  '/',
  authorize('viewDashboard'),
  asyncHandler(async (req, res) => {
    const summary = await getDashboardMetrics();

    return res.json(summary);
  })
);

module.exports = router;
