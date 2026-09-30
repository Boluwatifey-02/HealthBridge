const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const v = require('../lib/validation');

const router = express.Router();
router.use(authenticate, staffOnly);

/**
 * Clinical and administrative signals derived from the record.
 *
 * This is a rule-based analysis, not a machine learning model. Each signal below
 * is a count or a list produced by a SQL query or plain arithmetic over the
 * tables - no external AI service is called, no data leaves the deployment, and
 * no result is a clinical judgement.
 *
 * The previous version was presented as "AI Insights" with no indication of how
 * it worked, which overstated it. The response now states plainly what produced
 * the output so the interface can label it accurately.
 */

const SIGNAL_DEFINITIONS = [
  {
    key: 'followUpDue',
    title: 'Reviews due',
    type: 'Follow-up',
    description: 'Active patients whose last recorded visit was more than 90 days ago.',
  },
  {
    key: 'duplicateRecords',
    title: 'Possible duplicate records',
    type: 'Data quality',
    description: 'Patient records that share a phone number, which may be one person registered twice.',
  },
  {
    key: 'incompleteRecords',
    title: 'Incomplete records',
    type: 'Data quality',
    description: 'Active patients missing a phone number, address, allergy status or recorded condition.',
  },
  {
    key: 'abnormalResults',
    title: 'Results needing review',
    type: 'Laboratory',
    description: 'Completed laboratory results whose text flags an abnormal, critical or out-of-range finding.',
  },
  {
    key: 'unattendedFollowUp',
    title: 'Missed follow-up after consultation',
    type: 'Follow-up',
    description: 'Consultations that asked the patient to return, with no later appointment booked.',
  },
  {
    key: 'pendingWorkload',
    title: 'Outstanding work',
    type: 'Workload',
    description: 'Laboratory requests and prescriptions still waiting to be actioned.',
  },
];

// Phrases a laboratory report uses when a value needs a clinician's attention.
const ABNORMAL_MARKERS = [
  'positive',
  'critical',
  'elevated',
  'abnormal',
  'high',
  'low',
  'trace protein',
  'protein +',
  'nitrite +',
  'seen',
  'out of range',
  'hiv',
  'hbsag',
];

function normalisePhone(value) {
  return String(value || '').replace(/\D+/g, '').slice(-8);
}

function isAbnormal(text) {
  const lowered = String(text || '').toLowerCase();
  return ABNORMAL_MARKERS.some((marker) => lowered.includes(marker));
}

async function followUpDue({ patientId }) {
  const [rows] = await query(
    `SELECT p.id, p.full_name, p.last_visit
       FROM patients p
      WHERE p.status = 'Active'
        AND p.last_visit IS NOT NULL
        AND p.last_visit < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        ${patientId ? 'AND p.id = ?' : ''}
      ORDER BY p.last_visit ASC
      LIMIT 20`,
    patientId ? [patientId] : []
  );

  return {
    count: rows.length,
    items: rows.map((row) => ({
      id: row.id,
      label: row.full_name,
      detail: `Last seen ${new Date(row.last_visit).toLocaleDateString('en-GB')}`,
    })),
  };
}

async function duplicateRecords({ patientId }) {
  const [rows] = await query(
    `SELECT phone, COUNT(*) AS total, GROUP_CONCAT(id ORDER BY id) AS ids
       FROM patients
      WHERE phone IS NOT NULL AND TRIM(phone) <> ''
        ${patientId ? 'AND id = ?' : ''}
      GROUP BY phone
     HAVING total > 1
      ORDER BY total DESC, phone ASC
      LIMIT 20`,
    patientId ? [patientId] : []
  );

  let count = 0;
  const items = [];

  for (const row of rows) {
    const ids = String(row.ids || '').split(',');
    count += ids.length - 1;
    items.push({
      id: ids.join(','),
      label: normalisePhone(row.phone) || 'Shared number',
      detail: `${ids.length} records share this number: ${ids.join(', ')}`,
    });
  }

  return { count, items };
}

async function incompleteRecords({ patientId }) {
  const [rows] = await query(
    `SELECT id, full_name,
            IF(phone IS NULL OR TRIM(phone) = '', 1, 0) AS missing_phone,
            IF(address IS NULL OR TRIM(address) = '', 1, 0) AS missing_address,
            IF(allergies IS NULL OR TRIM(allergies) = '', 1, 0) AS missing_allergies,
            IF(\`condition\` IS NULL OR TRIM(\`condition\`) = '', 1, 0) AS missing_condition
       FROM patients
      WHERE status = 'Active'
        ${patientId ? 'AND id = ?' : ''}
        AND (phone IS NULL OR TRIM(phone) = ''
          OR address IS NULL OR TRIM(address) = ''
          OR allergies IS NULL OR TRIM(allergies) = ''
          OR \`condition\` IS NULL OR TRIM(\`condition\`) = '')
      ORDER BY full_name ASC
      LIMIT 20`,
    patientId ? [patientId] : []
  );

  return {
    count: rows.length,
    items: rows.map((row) => {
      const missing = [];
      if (row.missing_phone) missing.push('phone');
      if (row.missing_address) missing.push('address');
      if (row.missing_allergies) missing.push('allergies');
      if (row.missing_condition) missing.push('condition');

      return { id: row.id, label: row.full_name, detail: `Missing ${missing.join(', ')}` };
    }),
  };
}

async function abnormalResults({ patientId }) {
  const [rows] = await query(
    `SELECT l.id, l.test_name, r.result_text, p.full_name, r.result_date
       FROM lab_results r
       JOIN lab_requests l ON l.id = r.lab_request_id
       JOIN patients p ON p.id = l.patient_id
      ${patientId ? 'WHERE l.patient_id = ?' : ''}
      ORDER BY r.result_date DESC
      LIMIT 200`,
    patientId ? [patientId] : []
  );

  const flagged = rows.filter((row) => isAbnormal(row.result_text));

  return {
    count: flagged.length,
    items: flagged.slice(0, 20).map((row) => ({
      id: row.id,
      label: `${row.full_name} - ${row.test_name}`,
      detail: row.result_text,
    })),
  };
}

async function unattendedFollowUp({ patientId }) {
  const [rows] = await query(
    `SELECT c.id, c.follow_up, c.consultation_date, p.id AS patient_id, p.full_name
       FROM consultations c
       JOIN patients p ON p.id = c.patient_id
      WHERE c.follow_up IS NOT NULL AND TRIM(c.follow_up) <> ''
        ${patientId ? 'AND c.patient_id = ?' : ''}
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
           WHERE a.patient_id = c.patient_id
             AND a.appointment_date > c.consultation_date
             AND a.status <> 'Cancelled'
        )
      ORDER BY c.consultation_date ASC
      LIMIT 20`,
    patientId ? [patientId] : []
  );

  return {
    count: rows.length,
    items: rows.map((row) => ({
      id: row.id,
      label: row.full_name,
      detail: `Advised: ${row.follow_up}`,
    })),
  };
}

async function pendingWorkload({ patientId }) {
  // The filter is appended as SQL, never as a bound value, so the count query
  // stays a single prepared statement.
  const scope = patientId ? ' AND patient_id = ?' : '';
  const params = patientId ? [patientId] : [];

  const [[lab], [rx]] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM lab_requests WHERE status = 'Pending'${scope}`, params),
    query(`SELECT COUNT(*) AS total FROM prescriptions WHERE status = 'Pending'${scope}`, params),
  ]);

  const labCount = Number(lab[0]?.total || 0);
  const rxCount = Number(rx[0]?.total || 0);

  return {
    count: labCount + rxCount,
    items: [
      { id: 'lab', label: 'Laboratory requests awaiting a result', detail: `${labCount} pending` },
      { id: 'rx', label: 'Prescriptions awaiting dispensing', detail: `${rxCount} pending` },
    ],
  };
}

const COMPUTERS = {
  followUpDue,
  duplicateRecords,
  incompleteRecords,
  abnormalResults,
  unattendedFollowUp,
  pendingWorkload,
};

router.get(
  '/',
  authorize('viewInsights'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    // A patient id narrows the analysis to one person; the same rules run over
    // that patient's rows only.
    const patientId = v.text(req.query.patientId, 'Patient id', { max: 50 });

    if (patientId) {
      const [exists] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [patientId]);
      if (!exists.length) {
        throw ApiError.notFound('That patient was not found.');
      }
    }

    const signals = await Promise.all(
      SIGNAL_DEFINITIONS.map(async (definition) => {
        const { count, items } = await COMPUTERS[definition.key]({ patientId });

        return {
          key: definition.key,
          title: definition.title,
          type: definition.type,
          description: definition.description,
          count,
          items,
        };
      })
    );

    return res.json({
      // Stated plainly so the interface can label this correctly rather than
      // implying a machine learning model is running.
      method: 'rule-based analysis of the HealthBridge database',
      isMachineLearning: false,
      disclaimer:
        'These signals are counted from records in this system. They are prompts for a clinician to review, not diagnoses or automated decisions.',
      scope: patientId ? { patientId } : { allPatients: true },
      signals,
      generatedAt: new Date().toISOString(),
    });
  })
);

module.exports = router;
module.exports.isAbnormal = isAbnormal;
module.exports.SIGNAL_DEFINITIONS = SIGNAL_DEFINITIONS;
