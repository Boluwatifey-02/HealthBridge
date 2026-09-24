const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");
const { findDuplicateMatches, checkIncompleteInfo } = require("../utils/aiHelpers");

const router = express.Router();
router.use(authenticate);

// POST /api/patients/check-duplicate — FR-2 / FR-11 (Section 3.4.2)
// Run this before actually saving a new registration.
router.post("/check-duplicate", authorize("registerPatient"), async (req, res) => {
  const candidate = req.body;
  const [existing] = await pool.query("SELECT * FROM patients");
  const matches = findDuplicateMatches(candidate, existing);
  res.json({
    hasPossibleDuplicates: matches.length > 0,
    matches: matches.slice(0, 5).map((m) => ({
      patientId: m.patient.patient_id,
      fullName: m.patient.full_name,
      confidence: Math.round(m.score * 100),
    })),
  });
});

// POST /api/patients — register a new patient (FR-1)
router.post("/", authorize("registerPatient"), async (req, res) => {
  const patient = req.body;
  const incomplete = checkIncompleteInfo(patient);
  if (incomplete.length) {
    return res.status(400).json({ error: `Missing required fields: ${incomplete.join(", ")}` });
  }
  const patientId = `HB-${uuidv4().slice(0, 6).toUpperCase()}`;
  try {
    await pool.query(
      `INSERT INTO patients (patient_id, full_name, date_of_birth, gender, phone_number, address, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patientId, patient.full_name, patient.date_of_birth, patient.gender, patient.phone_number, patient.address, req.user.branchId]
    );
    await pool.query(
      "INSERT INTO audit_logs (log_id, actor, action) VALUES (?, ?, ?)",
      [uuidv4(), req.user.staffId, `Registered patient ${patientId}`]
    );
    res.status(201).json({ patientId, message: "Patient registered successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register patient." });
  }
});

// GET /api/patients/search?q=... — FR-2, cross-branch by design (FR-15)
router.get("/search", authorize("searchPatient"), async (req, res) => {
  const q = `%${req.query.q || ""}%`;
  const [rows] = await pool.query(
    `SELECT patient_id, full_name, date_of_birth, gender, phone_number, branch_id
     FROM patients WHERE full_name LIKE ? OR patient_id LIKE ? OR phone_number LIKE ?`,
    [q, q, q]
  );
  res.json(rows);
});

// GET /api/patients/:id — full record, cross-branch (FR-15)
router.get("/:id", authorize("viewPatient"), async (req, res) => {
  const [[patient]] = await pool.query("SELECT * FROM patients WHERE patient_id = ?", [req.params.id]);
  if (!patient) return res.status(404).json({ error: "Patient not found." });

  const [history] = await pool.query(
    "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY record_date DESC",
    [req.params.id]
  );
  res.json({ ...patient, medicalHistory: history });
});

module.exports = router;
