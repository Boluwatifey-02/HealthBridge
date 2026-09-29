const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { query, getDashboardMetrics, isFallbackMode } = require('../config/db');

const router = express.Router();

router.use(authenticate);

router.get('/analytics', authorize('viewAnalytics'), async (req, res, next) => {
  try {
    const metrics = await getDashboardMetrics();
    const [staffRows] = await query("SELECT COUNT(*) AS total FROM staff WHERE status = 'Active'");
    const [patientRows] = await query("SELECT COUNT(*) AS total FROM patients WHERE status = 'Active'");

    return res.json({
      metrics,
      staffCount: Number(staffRows[0]?.total || 0),
      activePatients: Number(patientRows[0]?.total || 0),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/staff', authorize('manageStaff'), async (req, res, next) => {
  try {
    if (isFallbackMode()) {
      return res.status(503).json({ message: 'The HealthBridge database is unavailable.' });
    }

    const [rows] = await query(
      `SELECT id, full_name, email, role, branch_id, status FROM staff ORDER BY full_name`
    );

    return res.json(
      rows.map((member) => ({
        id: member.id,
        fullName: member.full_name,
        email: member.email,
        role: member.role,
        branch: member.branch_id,
        status: member.status,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;