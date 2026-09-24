const express = require("express");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// POST /api/admin/staff — create a staff account (FR-10)
router.post("/staff", authorize("manageStaff"), async (req, res) => {
  const { fullName, role, phoneNumber, branchId, password } = req.body;
  const staffId = `S-${uuidv4().slice(0, 6).toUpperCase()}`;
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO staff (staff_id, full_name, role, phone_number, branch_id, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [staffId, fullName, role, phoneNumber, branchId, passwordHash]
  );
  res.status(201).json({ staffId, message: "Staff account created." });
});

// GET /api/admin/staff — list all staff
router.get("/staff", authorize("manageStaff"), async (req, res) => {
  const [rows] = await pool.query(
    "SELECT staff_id, full_name, role, phone_number, branch_id, created_at FROM staff"
  );
  res.json(rows);
});

// GET /api/admin/analytics — FR-10: cross-branch statistics dashboard
router.get("/analytics", authorize("viewAnalytics"), async (req, res) => {
  const [[{ totalPatients }]] = await pool.query("SELECT COUNT(*) AS totalPatients FROM patients");
  const [[{ totalAppointments }]] = await pool.query("SELECT COUNT(*) AS totalAppointments FROM appointments");
  const [[{ completedAppointments }]] = await pool.query(
    "SELECT COUNT(*) AS completedAppointments FROM appointments WHERE status = 'Completed'"
  );
  const [[{ pendingPrescriptions }]] = await pool.query(
    "SELECT COUNT(*) AS pendingPrescriptions FROM prescriptions WHERE status = 'Pending'"
  );
  const [lowStockDrugs] = await pool.query("SELECT * FROM drugs WHERE stock_quantity <= reorder_level");

  res.json({
    totalPatients,
    totalAppointments,
    completedAppointments,
    appointmentCompletionRate: totalAppointments ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
    pendingPrescriptions,
    lowStockDrugCount: lowStockDrugs.length,
    lowStockDrugs,
  });
});

// GET /api/admin/audit-log
router.get("/audit-log", authorize("viewAuditLog"), async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
  res.json(rows);
});

module.exports = router;
