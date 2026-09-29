const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function normalizeConsultationRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patientId: row.patient_id || row.patientId || 'N/A',
    patient: row.patient_name || 'Unknown patient',
    doctorId: row.doctor_id || 'STAFF-001',
    doctor: row.doctor_name || 'Dr. HealthBridge',
    complaint: row.complaint || '',
    diagnosis: row.diagnosis || '',
    treatment: row.treatment || 'Routine management plan',
    notes: row.notes || '',
    followUp: row.follow_up || '',
    date: row.consultation_date || row.created_at || new Date().toISOString(),
  };
}

router.get('/', async (req, res) => {
  try {
    if (isFallbackMode()) {
      return res.status(503).json({
        message: 'The HealthBridge database is unavailable. Please try again shortly.',
      });
    }

    const [rows] = await query(
      `SELECT c.id, c.patient_id, c.doctor_id, c.consultation_date, c.complaint, c.diagnosis, c.treatment, c.notes, c.follow_up,
              p.full_name AS patient_name,
              s.full_name AS doctor_name
       FROM consultations c
       LEFT JOIN patients p ON p.id = c.patient_id
       LEFT JOIN staff s ON s.id = c.doctor_id
       ORDER BY c.created_at DESC`
    );

    return res.json(rows.map(normalizeConsultationRow));
  } catch (error) {
    console.error('Get consultations failed:', error);
    return res.status(500).json({ message: 'Failed to load consultations.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      patient_id,
      complaint,
      diagnosis,
      treatment,
      notes,
      followUp,
      follow_up,
      doctorId,
      doctor_id,
      date,
    } = req.body || {};

    const selectedPatientId = patientId || patient_id;
    const consultationComplaint = String(complaint || '').trim();
    const consultationDiagnosis = String(diagnosis || '').trim();
    const consultationTreatment = String(treatment || '').trim() || 'Routine management plan';
    const consultationNotes = String(notes || '').trim();
    const consultationFollowUp = String(followUp || follow_up || '').trim();
    const doctorIdentifier = doctorId || doctor_id || req.user?.id || 'STAFF-001';

    if (!selectedPatientId) {
      return res.status(400).json({ message: 'Patient is required for a consultation.' });
    }

    if (!consultationComplaint || !consultationDiagnosis) {
      return res.status(400).json({ message: 'Complaint and diagnosis are required.' });
    }

    if (isFallbackMode()) {
      return res.status(503).json({
        message: 'The HealthBridge database is unavailable. Please try again shortly.',
      });
    }

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [selectedPatientId]);

    if (!patientRows.length) {
      return res.status(404).json({ message: 'Selected patient was not found in the database.' });
    }

    const [doctorRows] = await query('SELECT id FROM staff WHERE id = ? LIMIT 1', [doctorIdentifier]);
    const resolvedDoctorId = doctorRows[0]?.id || 'STAFF-001';
    const consultationId = `CONS-${Date.now().toString().slice(-8)}`;
    const consultationDate = date
      ? new Date(date).toISOString().slice(0, 19).replace('T', ' ')
      : new Date().toISOString().slice(0, 19).replace('T', ' ');

    await query(
      `INSERT INTO consultations (id, patient_id, doctor_id, consultation_date, complaint, diagnosis, treatment, notes, follow_up)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consultationId,
        selectedPatientId,
        resolvedDoctorId,
        consultationDate,
        consultationComplaint,
        consultationDiagnosis,
        consultationTreatment,
        consultationNotes,
        consultationFollowUp,
      ]
    );

    const [rows] = await query(
      `SELECT c.id, c.patient_id, c.doctor_id, c.consultation_date, c.complaint, c.diagnosis, c.treatment, c.notes, c.follow_up,
              p.full_name AS patient_name,
              s.full_name AS doctor_name
       FROM consultations c
       LEFT JOIN patients p ON p.id = c.patient_id
       LEFT JOIN staff s ON s.id = c.doctor_id
       WHERE c.id = ?`,
      [consultationId]
    );

    return res.status(201).json(normalizeConsultationRow(rows[0]));
  } catch (error) {
    console.error('Create consultation failed:', error);
    return res.status(500).json({ message: 'Failed to save consultation.' });
  }
});

module.exports = router;
