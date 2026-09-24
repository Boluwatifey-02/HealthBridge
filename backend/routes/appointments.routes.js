const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function formatAppointmentTime(value) {
  if (!value) {
    return 'Time unavailable';
  }

  const timeString = String(value).trim();

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeString)) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const formatted = new Date();
    formatted.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(formatted);
  }

  return timeString;
}

function normalizeAppointmentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patient: row.patient_name || row.full_name || 'Unknown patient',
    patientId: row.patient_id || 'N/A',
    doctor: row.doctor_name || row.provider || 'Dr. HealthBridge',
    provider: row.doctor_name || row.provider || 'Dr. HealthBridge',
    department: 'Clinical Care',
    type: row.reason || 'Consultation',
    reason: row.reason || 'Consultation',
    status: row.status || 'Scheduled',
    date: row.appointment_date || row.date || '',
    time: formatAppointmentTime(row.appointment_time || row.time),
    notes: row.notes || '',
  };
}

router.get('/', async (req, res) => {
  try {
    if (isFallbackMode()) {
      const { getStore } = require('../config/db');
      return res.json(getStore().appointments.map((appointment) => normalizeAppointmentRow({
        id: appointment.id,
        patient_name: appointment.patient,
        patient_id: appointment.patientId || appointment.patient_id || 'N/A',
        doctor_name: appointment.provider || 'Dr. HealthBridge',
        reason: appointment.type || appointment.reason || 'Consultation',
        status: appointment.status || 'Scheduled',
        appointment_date: appointment.date,
        appointment_time: appointment.time,
        notes: appointment.notes || '',
      })));
    }

    const [rows] = await query(
      `SELECT a.id, a.patient_id, a.appointment_date, a.appointment_time, a.reason, a.status, a.notes,
              p.full_name AS patient_name,
              s.full_name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN staff s ON s.id = a.doctor_id
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`
    );

    return res.json(rows.map(normalizeAppointmentRow));
  } catch (error) {
    console.error('Get appointments failed:', error);
    return res.status(500).json({ message: 'Failed to load appointments.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      patient_id,
      date,
      appointmentDate,
      time,
      appointmentTime,
      provider,
      doctorId,
      doctor_id,
      status,
      type,
      reason,
      notes,
    } = req.body || {};

    const selectedPatientId = patientId || patient_id;
    const normalizedDate = date || appointmentDate;
    const appointmentDateValue = normalizedDate
      ? new Date(normalizedDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const appointmentTimeValue = time || appointmentTime || '09:00:00';
    const appointmentReason = type || reason || 'Consultation';
    const appointmentStatus = status || 'Scheduled';
    const doctorIdentifier = doctorId || doctor_id || req.user?.id || 'STAFF-001';

    if (!selectedPatientId) {
      return res.status(400).json({ message: 'Patient is required for an appointment.' });
    }

    if (!appointmentDateValue || !appointmentTimeValue) {
      return res.status(400).json({ message: 'Appointment date and time are required.' });
    }

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [selectedPatientId]);

    if (!patientRows.length) {
      return res.status(404).json({ message: 'Selected patient was not found in the database.' });
    }

    const [doctorRows] = await query('SELECT id FROM staff WHERE id = ? LIMIT 1', [doctorIdentifier]);
    const resolvedDoctorId = doctorRows[0]?.id || 'STAFF-001';
    const appointmentId = `APT-${Date.now().toString().slice(-8)}`;

    await query(
      `INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, appointment_time, reason, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointmentId,
        selectedPatientId,
        resolvedDoctorId,
        appointmentDateValue,
        appointmentTimeValue,
        appointmentReason,
        appointmentStatus,
        notes || '',
      ]
    );

    const [rows] = await query(
      `SELECT a.id, a.patient_id, a.appointment_date, a.appointment_time, a.reason, a.status, a.notes,
              p.full_name AS patient_name,
              s.full_name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN staff s ON s.id = a.doctor_id
       WHERE a.id = ?`,
      [appointmentId]
    );

    return res.status(201).json(normalizeAppointmentRow(rows[0]));
  } catch (error) {
    console.error('Create appointment failed:', error);
    return res.status(500).json({ message: 'Failed to create appointment.' });
  }
});

module.exports = router;
