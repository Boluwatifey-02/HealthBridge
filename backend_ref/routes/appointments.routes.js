const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");
const { needsFollowUp } = require("../utils/aiHelpers");

const router = express.Router();
router.use(authenticate);

// POST /api/appointments — FR-3: conflict detection happens at the
// database level too (UNIQUE KEY uq_doctor_slot in schema.sql), but
// we check here first for a clean error message instead of a raw
// SQL constraint error reaching the client.
router.post("/", authorize("scheduleAppointment"), async (req, res) => {
  const { patientId, doctorId, appointmentDate } = req.body;
  try {
    const [[conflict]] = await pool.query(
      "SELECT appointment_id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'Booked'",
      [doctorId, appointmentDate]
    );
    if (conflict) {
      return res.status(409).json({ error: "This doctor already has a booking at that time. Please choose a different slot." });
    }
    const appointmentId = `A-${uuidv4().slice(0, 6).toUpperCase()}`;
    await pool.query(
      "INSERT INTO appointments (appointment_id, patient_id, doctor_id, appointment_date) VALUES (?, ?, ?, ?)",
      [appointmentId, patientId, doctorId, appointmentDate]
    );
    res.status(201).json({ appointmentId, message: "Appointment booked successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to book appointment." });
  }
});

// GET /api/appointments — list, filterable by branch/doctor
router.get("/", authorize("viewAppointments"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, p.full_name AS patient_name, s.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     JOIN staff s ON a.doctor_id = s.staff_id
     ORDER BY a.appointment_date ASC`
  );
  res.json(rows);
});

// GET /api/appointments/followup-recommendations — FR-12 (AI-assisted)
// Scans patients with a chronic-condition diagnosis whose last visit
// exceeds the condition-specific threshold defined in aiHelpers.js.
router.get("/followup-recommendations", authorize("viewAppointments"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.patient_id, p.full_name, mr.diagnosis, MAX(mr.record_date) AS last_visit
     FROM patients p
     JOIN medical_records mr ON p.patient_id = mr.patient_id
     GROUP BY p.patient_id, mr.diagnosis`
  );
  const recommendations = rows.filter((r) => needsFollowUp(r.diagnosis, r.last_visit));
  res.json(recommendations);
});

module.exports = router;
