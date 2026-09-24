const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");
const { summarizeConsultation } = require("../utils/aiHelpers");

const router = express.Router();
router.use(authenticate);

// POST /api/consultations — FR-5, FR-13 (AI summary auto-attached)
router.post("/", authorize("createConsultation"), async (req, res) => {
  const { patientId, diagnosis, notes } = req.body;
  const doctorId = req.user.staffId;
  try {
    const aiSummary = await summarizeConsultation(notes, diagnosis);
    const recordId = `MR-${uuidv4().slice(0, 6).toUpperCase()}`;
    await pool.query(
      `INSERT INTO medical_records (record_id, patient_id, doctor_id, diagnosis, notes, ai_summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [recordId, patientId, doctorId, diagnosis, notes, aiSummary]
    );
    res.status(201).json({ recordId, aiSummary, message: "Consultation saved." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save consultation." });
  }
});

// GET /api/consultations/patient/:patientId — cross-branch history (FR-15)
router.get("/patient/:patientId", authorize("viewMedicalHistory"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT mr.*, s.full_name AS doctor_name
     FROM medical_records mr JOIN staff s ON mr.doctor_id = s.staff_id
     WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`,
    [req.params.patientId]
  );
  res.json(rows);
});

module.exports = router;
