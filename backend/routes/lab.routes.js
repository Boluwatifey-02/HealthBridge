const express = require('express');

const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function formatDbDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function formatLabDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mapLabRequestRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patient: row.patient_name || 'Unknown patient',
    patientId: row.patient_id || '',
    test: row.test_name || row.test || 'General Laboratory Test',
    status: row.status || 'Pending',
    date: formatLabDate(row.request_date),
  };
}

async function ensureLabSeedData() {
  const [countRows] = await query('SELECT COUNT(*) AS total FROM lab_requests');

  if (Number(countRows[0]?.total || 0) > 0) {
    return;
  }

  const [patients] = await query('SELECT id FROM patients ORDER BY created_at DESC LIMIT 10');
  const [doctorRows] = await query('SELECT id FROM staff WHERE email = ? LIMIT 1', ['admin@healthbridge.org']);
  const patientId = patients[0]?.id || 'HB-19709253';
  const doctorId = doctorRows[0]?.id || 'STAFF-001';

  const seedRequests = [
    {
      id: 'LAB-001',
      patient_id: patientId,
      doctor_id: doctorId,
      test_name: 'Full Blood Count',
      status: 'Pending',
      request_date: formatDbDateTime(new Date()),
      priority: 'Routine',
      notes: 'Initial review',
    },
    {
      id: 'LAB-002',
      patient_id: patientId,
      doctor_id: doctorId,
      test_name: 'Blood Glucose',
      status: 'Completed',
      request_date: formatDbDateTime(new Date(Date.now() - 86400000)),
      priority: 'Routine',
      notes: 'Follow-up check',
    },
  ];

  for (const request of seedRequests) {
    await query(
      `INSERT INTO lab_requests (id, patient_id, doctor_id, test_name, request_date, status, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        request.patient_id,
        request.doctor_id,
        request.test_name,
        request.request_date,
        request.status,
        request.priority,
        request.notes,
      ]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureLabSeedData();

    const [rows] = await query(
      `SELECT l.id, l.patient_id, l.test_name, l.status, l.request_date, p.full_name AS patient_name
       FROM lab_requests l
       LEFT JOIN patients p ON p.id = l.patient_id
       ORDER BY l.created_at DESC`
    );

    return res.json(rows.map(mapLabRequestRow));
  } catch (error) {
    console.error('Get lab requests failed:', error);
    return res.status(500).json({ message: 'Failed to load laboratory requests.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { patientId, patient_id, patient, test, testName, status, date, priority, notes, doctorId, doctor_id } = req.body || {};

    let selectedPatientId = patientId || patient_id || (typeof patient === 'string' ? patient : '');
    const selectedTestName = testName || test || 'General Laboratory Test';
    const selectedStatus = status || 'Pending';
    const requestDate = date ? formatDbDateTime(date) : formatDbDateTime(new Date());

    if (!selectedPatientId) {
      return res.status(400).json({ message: 'A patient is required to create a laboratory request.' });
    }

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [selectedPatientId]);
    if (!patientRows.length) {
      return res.status(404).json({ message: 'Selected patient was not found in the database.' });
    }

    const doctorIdentifier = doctorId || doctor_id || req.user?.id;
    const [doctorRows] = await query('SELECT id FROM staff WHERE id = ? LIMIT 1', [doctorIdentifier]);
    const resolvedDoctorId = doctorRows[0]?.id || 'STAFF-001';
    const labRequestId = `LAB-${Date.now().toString().slice(-8)}`;

    await query(
      `INSERT INTO lab_requests (id, patient_id, doctor_id, test_name, request_date, status, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        labRequestId,
        selectedPatientId,
        resolvedDoctorId,
        selectedTestName,
        requestDate,
        selectedStatus,
        priority || 'Routine',
        notes || '',
      ]
    );

    const [rows] = await query(
      `SELECT l.id, l.patient_id, l.test_name, l.status, l.request_date, p.full_name AS patient_name
       FROM lab_requests l
       LEFT JOIN patients p ON p.id = l.patient_id
       WHERE l.id = ?`,
      [labRequestId]
    );

    return res.status(201).json(mapLabRequestRow(rows[0]));
  } catch (error) {
    console.error('Create lab request failed:', error);
    return res.status(500).json({ message: 'Failed to create laboratory request.' });
  }
});

module.exports = router;
