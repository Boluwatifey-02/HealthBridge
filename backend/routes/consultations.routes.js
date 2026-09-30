const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const { idGenerators } = require('../lib/ids');
const { sendList } = require('../lib/listResponse');
const v = require('../lib/validation');

const router = express.Router();
router.use(authenticate, staffOnly);

const CONSULTATION_SELECT = `SELECT c.id, c.patient_id, c.doctor_id, c.consultation_date,
                                     c.complaint, c.diagnosis, c.treatment, c.notes, c.follow_up,
                                     c.created_at,
                                     p.full_name AS patient_name,
                                     s.full_name AS doctor_name
                              FROM consultations c
                              LEFT JOIN patients p ON p.id = c.patient_id
                              LEFT JOIN staff s ON s.id = c.doctor_id`;

function mapConsultation(row) {
  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id || '',
    patient: row.patient_name || 'Unknown patient',
    doctorId: row.doctor_id || '',
    doctor: row.doctor_name || '',
    complaint: row.complaint || '',
    diagnosis: row.diagnosis || '',
    treatment: row.treatment || '',
    notes: row.notes || '',
    followUp: row.follow_up || '',
    date: row.consultation_date,
    createdAt: row.created_at,
  };
}

router.get(
  '/',
  authorize('viewConsultations'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const patientId = v.text(req.query.patientId, 'Patient id', { max: 50 });
    const search = v.text(req.query.search, 'Search term', { max: 120 });
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 200, fallback: 100 });

    const where = [];
    const params = [];

    if (patientId) {
      where.push('c.patient_id = ?');
      params.push(patientId);
    }

    if (search) {
      where.push('(c.diagnosis LIKE ? OR c.complaint LIKE ? OR p.full_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await query(
      `${CONSULTATION_SELECT} ${clause}
       ORDER BY c.consultation_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM consultations c
         LEFT JOIN patients p ON p.id = c.patient_id ${clause}`,
      params
    );

return sendList(req, res, 'consultations', {
      consultations: rows.map(mapConsultation),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    });
  })
);

router.get(
  '/:id',
  authorize('viewConsultations'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${CONSULTATION_SELECT} WHERE c.id = ? LIMIT 1`, [req.params.id]);

    if (!rows.length) {
      throw ApiError.notFound('That consultation was not found.');
    }

    return res.json(mapConsultation(rows[0]));
  })
);

router.post(
  '/',
  authorize('createConsultation'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const patientId = v.text(body.patientId || body.patient_id, 'Patient', { required: true, max: 50 });
    const complaint = v.longText(body.complaint, 'Presenting complaint', { required: true });
    const diagnosis = v.longText(body.diagnosis, 'Diagnosis', { required: true });
    const treatment = v.longText(body.treatment, 'Treatment plan', { required: true });
    const notes = v.longText(body.notes, 'Notes');
    const followUp = v.text(body.followUp || body.follow_up, 'Follow-up', { max: 255 });
    const date = v.dateTime(body.date, 'Consultation date', {
      fallback: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    const doctorId = v.text(body.doctorId || body.doctor_id, 'Doctor id', {
      max: 50,
      fallback: req.user.id,
    });

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [patientId]);

    if (!patientRows.length) {
      throw ApiError.notFound('That patient was not found.');
    }

    const [doctorRows] = await query('SELECT id FROM staff WHERE id = ? AND status = ? LIMIT 1', [
      doctorId,
      'Active',
    ]);

    if (!doctorRows.length) {
      throw ApiError.badRequest('The selected doctor is not an active staff member.');
    }

    const id = idGenerators.consultation();

    await query(
      `INSERT INTO consultations
        (id, patient_id, doctor_id, consultation_date, complaint, diagnosis, treatment, notes, follow_up)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, doctorId, date, complaint, diagnosis, treatment, notes, followUp]
    );

    // A consultation is the moment the patient was actually seen, so the
    // register's last-visit date follows from it rather than being maintained
    // separately and drifting out of step.
    await query(
      'UPDATE patients SET last_visit = ? WHERE id = ?',
      [date.slice(0, 10), patientId]
    );

    await recordAudit(req.user, 'CREATE_CONSULTATION', 'Recorded a consultation.', {
      entity: 'consultation',
      entityId: id,
    });

    const [rows] = await query(`${CONSULTATION_SELECT} WHERE c.id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapConsultation(rows[0]));
  })
);

router.put(
  '/:id',
  authorize('createConsultation'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM consultations WHERE id = ? LIMIT 1', [req.params.id]);

    if (!existing.length) {
      throw ApiError.notFound('That consultation was not found.');
    }

    const before = existing[0];
    const body = req.body || {};

    const complaint = body.complaint !== undefined
      ? v.longText(body.complaint, 'Presenting complaint', { required: true })
      : before.complaint;
    const diagnosis = body.diagnosis !== undefined
      ? v.longText(body.diagnosis, 'Diagnosis', { required: true })
      : before.diagnosis;
    const treatment = body.treatment !== undefined
      ? v.longText(body.treatment, 'Treatment plan', { required: true })
      : before.treatment;
    const notes = body.notes !== undefined ? v.longText(body.notes, 'Notes') : before.notes;
    const followUp = body.followUp !== undefined
      ? v.text(body.followUp, 'Follow-up', { max: 255 })
      : before.follow_up;

    await query(
      `UPDATE consultations
          SET complaint = ?, diagnosis = ?, treatment = ?, notes = ?, follow_up = ?
        WHERE id = ?`,
      [complaint, diagnosis, treatment, notes, followUp, req.params.id]
    );

    const changes = ['complaint', 'diagnosis', 'treatment', 'notes', 'follow_up'].filter(
      (field) => String(before[field] ?? '') !== String({ complaint, diagnosis, treatment, notes, followUp }[field] ?? '')
    );

    await recordAudit(
      req.user,
      'UPDATE_CONSULTATION',
      changes.length
        ? `Amended a consultation record (${changes.join(', ')}).`
        : 'Updated a consultation with no changed fields.',
      { entity: 'consultation', entityId: req.params.id }
    );

    const [rows] = await query(`${CONSULTATION_SELECT} WHERE c.id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapConsultation(rows[0]));
  })
);

module.exports = router;
module.exports.mapConsultation = mapConsultation;
