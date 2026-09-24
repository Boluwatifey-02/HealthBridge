const express = require('express');

const { getStore, createId } = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {
  const { prescriptions } = getStore();
  res.json(prescriptions);
});

router.post('/', (req, res) => {
  const { patientId, doctorId, medicineName, dosage, frequency, duration } = req.body || {};

  if (!patientId || !doctorId || !medicineName) {
    return res.status(400).json({ message: 'Patient, doctor, and medicine are required.' });
  }

  const prescription = {
    id: createId('RX'),
    patientId,
    doctorId,
    medicineName,
    dosage: dosage || 'As prescribed',
    frequency: frequency || 'Daily',
    duration: duration || '7 days',
    status: 'Pending',
  };

  const store = getStore();
  store.prescriptions.unshift(prescription);
  return res.status(201).json(prescription);
});

module.exports = router;
