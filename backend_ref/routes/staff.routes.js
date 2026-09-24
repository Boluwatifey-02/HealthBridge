const express = require("express");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/staff/doctors — a lightweight, low-sensitivity directory
// endpoint so Reception can populate a real doctor list when booking
// appointments (FR-3). Deliberately open to any authenticated staff
// member, unlike /api/admin/staff, since knowing which doctors exist
// isn't sensitive the way staff management/creation is.
router.get("/doctors", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT staff_id, full_name, branch_id FROM staff WHERE role = 'Doctor'"
  );
  res.json(rows);
});

module.exports = router;
