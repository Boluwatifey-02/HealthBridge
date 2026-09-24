const express = require('express');

const { query, isFallbackMode } = require('../config/db');

const router = express.Router();

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '').slice(-8);
}

router.get('/', async (req, res) => {
  try {
    if (isFallbackMode()) {
      return res.json([]);
    }

    const [patientRows] = await query(
      `SELECT id, full_name, phone, address, allergies, \`condition\`, last_visit
       FROM patients`
    );
    const [consultationRows] = await query(
      `SELECT patient_id, consultation_date FROM consultations`
    );
    const [labRows] = await query(
      `SELECT patient_id, status, request_date FROM lab_requests`
    );

    const today = new Date();
    const followUpCount = patientRows.filter((patient) => {
      if (!patient.last_visit) return false;
      const diffDays = (today.getTime() - new Date(patient.last_visit).getTime()) / 86400000;
      return diffDays > 30;
    }).length;

    const phoneMap = new Map();
    patientRows.forEach((patient) => {
      const key = normalizePhone(patient.phone);
      if (!key) return;
      if (!phoneMap.has(key)) {
        phoneMap.set(key, []);
      }
      phoneMap.get(key).push(patient.id);
    });
    const duplicateCount = [...phoneMap.values()].filter((entries) => entries.length > 1).length;

    const incompleteCount = patientRows.filter((patient) => {
      return !patient.phone || !patient.address || !patient.allergies || !patient.condition;
    }).length;

    const reportSummaryCount = (consultationRows.length || 0) + (labRows.length || 0);

    return res.json([
      {
        title: 'Follow-Up Recommendations',
        count: `${followUpCount} patients`,
        description: 'Patients with older last-visit dates and recent activity patterns that may need a follow-up review.',
        type: 'Follow-up',
      },
      {
        title: 'Duplicate Patient Detection',
        count: `${duplicateCount} records`,
        description: 'Possible duplicate records identified from matching patient contact information.',
        type: 'Duplicate',
      },
      {
        title: 'Automated Report Summaries',
        count: `${reportSummaryCount} summaries`,
        description: 'Recent consultation and laboratory activity available for quick clinical review.',
        type: 'Reports',
      },
      {
        title: 'Incomplete Records',
        count: `${incompleteCount} records`,
        description: 'Profiles missing key identifying or clinical details that should be reviewed before the next consultation.',
        type: 'Incomplete',
      },
    ]);
  } catch (error) {
    console.error('AI insights generation failed:', error);
    return res.status(500).json({ message: 'Failed to generate AI insights.' });
  }
});

module.exports = router;
