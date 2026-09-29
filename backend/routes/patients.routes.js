const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function databaseUnavailable(res) {
  return res.status(503).json({
    message: 'The HealthBridge database is unavailable. Please try again shortly.',
  });
}

function mapPatientRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.full_name || row.name || 'Unknown patient',
    fullName: row.full_name || row.name || 'Unknown patient',
    age: Number(row.age || 0),
    gender: row.gender || 'Not specified',
    phone: row.phone || '',
    address: row.address || 'Not provided',
    bloodGroup: row.blood_group || '',
    allergies: row.allergies || 'None',
    condition: row.condition || 'No condition recorded',
    status: row.status || 'Active',
    lastVisit: row.last_visit
      ? new Date(row.last_visit).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Not recorded',
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res) => {
  try {
    if (isFallbackMode()) {
      return databaseUnavailable(res);
    }

    const [rows] = await query(
      `SELECT id, full_name, age, gender, phone, address, blood_group, allergies, \`condition\`, status, last_visit, created_at
       FROM patients
       ORDER BY created_at DESC`
    );

    return res.json(rows.map(mapPatientRow));
  } catch (error) {
    console.error('Get patients failed:', error);
    return res.status(500).json({ message: 'Failed to load patients.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      fullName,
      condition,
      age,
      gender,
      phone,
      address,
      allergies,
      bloodGroup,
      status,
    } = req.body || {};

    const patientName = (fullName || name || '').trim();

    if (!patientName) {
      return res.status(400).json({ message: 'Patient name is required.' });
    }

    if (isFallbackMode()) {
      return databaseUnavailable(res);
    }

    const patientAge = Number(age) || 0;
    const patientCondition = (condition || 'No condition recorded').trim();
    const patientAddress = (address || 'Not provided').trim();
    const patientAllergies = (allergies || 'None').trim();
    const patientPhone = (phone || '').trim();
    const patientGender = (gender || 'Not specified').trim();
    const patientStatus = (status || 'Active').trim();
    const patientBloodGroup = (bloodGroup || '').trim();
    const patientId = `HB-${Date.now().toString().slice(-8)}`;
    const lastVisit = new Date();

    await query(
      `INSERT INTO patients (
        id,
        full_name,
        age,
        gender,
        phone,
        address,
        blood_group,
        allergies,
        \`condition\`,
        status,
        last_visit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        patientName,
        patientAge,
        patientGender,
        patientPhone,
        patientAddress,
        patientBloodGroup,
        patientAllergies,
        patientCondition,
        patientStatus,
        lastVisit,
      ]
    );

    const [rows] = await query(
      `SELECT id, full_name, age, gender, phone, address, blood_group, allergies, \`condition\`, status, last_visit, created_at
       FROM patients WHERE id = ?`,
      [patientId]
    );

    return res.status(201).json(mapPatientRow(rows[0]));
  } catch (error) {
    console.error('Create patient failed:', error);
    return res.status(500).json({ message: 'Failed to create patient record.' });
  }
});

module.exports = router;
