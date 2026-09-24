const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { getStore, getDashboardMetrics } = require('../config/db');

const router = express.Router();

router.use(authenticate);

router.get('/analytics', authorize('viewAnalytics'), async (req, res) => {
  const metrics = await getDashboardMetrics();
  const store = getStore();

  res.json({
    metrics,
    staffCount: store.staff.length,
    activePatients: store.patients.filter((patient) => patient.status === 'Active').length,
  });
});

router.get('/staff', authorize('manageStaff'), (req, res) => {
  const store = getStore();
  res.json(store.staff.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    branch: user.branch,
    status: user.status,
  })));
});

module.exports = router;
