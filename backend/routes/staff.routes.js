const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { query, isFallbackMode } = require('../config/db');

const router = express.Router();

router.use(authenticate);

router.get('/doctors', authorize('viewAppointments'), async (req, res, next) => {
  try {
    if (isFallbackMode()) {
      return res.status(503).json({ message: 'The HealthBridge database is unavailable.' });
    }

    const [rows] = await query(
      `SELECT id, full_name, role, branch_id FROM staff
       WHERE role IN ('Doctor', 'Administrator') AND status = 'Active'
       ORDER BY full_name`
    );

    return res.json(
      rows.map((member) => ({
        id: member.id,
        name: member.full_name,
        role: member.role,
        branch: member.branch_id,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;