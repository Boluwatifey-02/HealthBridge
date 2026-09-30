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

    // The interface published when this API was deployed reads four flat counts
    // off the top level. They are included alongside the current figures so that
    // build keeps showing real numbers, and can be dropped once it is replaced.
    return res.json({
      ...summary,
      totalPatients: summary?.totals?.totalPatients ?? 0,
      appointments: summary?.totals?.appointments ?? 0,
      lowStockItems: summary?.totals?.lowStockItems ?? 0,
      pendingLabRequests: summary?.totals?.pendingLabRequests ?? 0,
    });
  })
);

module.exports = router;
