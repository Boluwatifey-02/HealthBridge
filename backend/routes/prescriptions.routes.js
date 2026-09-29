const express = require('express');

const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function mapPrescriptionRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    medicineName: row.medicine_name,
    dosage: row.dosage || 'As prescribed',
    frequency: row.frequency || 'Daily',
    duration: row.duration || '7 days',
    quantity: Number(row.quantity || 0),
    instructions: row.instructions || '',
    status: row.status || 'Pending',
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT id, patient_id, doctor_id, medicine_name, dosage, frequency, duration,
              quantity, instructions, status, created_at
       FROM prescriptions
       ORDER BY created_at DESC`
    );

    return res.json(rows.map(mapPrescriptionRow));
  } catch (error) {
    console.error('Get prescriptions failed:', error);
    return res.status(500).json({ message: 'Failed to load prescriptions.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      medicineName,
      dosage,
      frequency,
      duration,
      quantity,
      instructions,
    } = req.body || {};

    if (!patientId || !doctorId || !medicineName) {
      return res.status(400).json({ message: 'Patient, doctor, and medicine are required.' });
    }

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [patientId]);

    if (!patientRows.length) {
      return res.status(404).json({ message: 'Patient was not found in the database.' });
    }

    const [doctorRows] = await query('SELECT id FROM staff WHERE id = ? LIMIT 1', [doctorId]);
    const resolvedDoctorId = doctorRows[0]?.id || doctorId;
    const prescriptionId = `RX-${Date.now().toString().slice(-8)}`;

    await query(
      `INSERT INTO prescriptions (
        id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, quantity, instructions, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        prescriptionId,
        patientId,
        resolvedDoctorId,
        medicineName,
        dosage || 'As prescribed',
        frequency || 'Daily',
        duration || '7 days',
        Number(quantity || 0),
        instructions || '',
      ]
    );

    const [rows] = await query(
      `SELECT id, patient_id, doctor_id, medicine_name, dosage, frequency, duration,
              quantity, instructions, status, created_at
       FROM prescriptions WHERE id = ?`,
      [prescriptionId]
    );

    return res.status(201).json(mapPrescriptionRow(rows[0]));
  } catch (error) {
    console.error('Create prescription failed:', error);
    return res.status(500).json({ message: 'Failed to create prescription.' });
  }
});

module.exports = router;