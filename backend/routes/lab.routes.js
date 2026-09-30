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

const LAB_SELECT = `SELECT l.id, l.patient_id, l.doctor_id, l.test_name, l.request_date,
                           l.status, l.priority, l.notes, l.created_at,
                           p.full_name AS patient_name,
                           d.full_name AS doctor_name,
                           r.id AS result_id, r.result_text, r.result_date, r.notes AS result_notes
                    FROM lab_requests l
                    LEFT JOIN patients p ON p.id = l.patient_id
                    LEFT JOIN staff d ON d.id = l.doctor_id
                    LEFT JOIN lab_results r ON r.lab_request_id = l.id`;

function formatDate(value) {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mapLabRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    patient: row.patient_name || 'Unknown patient',
    patientId: row.patient_id || '',
    doctor: row.doctor_name || '',
    test: row.test_name || '',
    testName: row.test_name || '',
    status: row.status || 'Pending',
    priority: row.priority || 'Routine',
    date: formatDate(row.request_date),
    requestDate: row.request_date,
    notes: row.notes || '',
    result: row.result_text || '',
    resultId: row.result_id || '',
    resultDate: row.result_date ? formatDate(row.result_date) : '',
    resultNotes: row.result_notes || '',
    createdAt: row.created_at,
  };
}

router.get(
  '/',
  authorize('viewLabRequests'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    // This route used to insert two invented laboratory requests on an empty
    // database. Nothing about a read should create clinical work, so an empty
    // database now reports no requests.
    const status = req.query.status
      ? v.oneOf(req.query.status, 'Status', ['Pending', 'Completed', 'Cancelled'])
      : null;
    const patientId = v.text(req.query.patientId, 'Patient id', { max: 50 });
    const search = v.text(req.query.search, 'Search term', { max: 120 });
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 200, fallback: 100 });

    const where = [];
    const params = [];

    if (status) {
      where.push('l.status = ?');
      params.push(status);
    }
    if (patientId) {
      where.push('l.patient_id = ?');
      params.push(patientId);
    }
    if (search) {
      where.push('(l.test_name LIKE ? OR p.full_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await query(
      `${LAB_SELECT} ${clause} ORDER BY l.request_date DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM lab_requests l
         LEFT JOIN patients p ON p.id = l.patient_id ${clause}`,
      params
    );

return sendList(req, res, 'requests', {
      requests: rows.map(mapLabRequest),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    });
  })
);

router.get(
  '/:id',
  authorize('viewLabRequests'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${LAB_SELECT} WHERE l.id = ? LIMIT 1`, [req.params.id]);

    if (!rows.length) {
      throw ApiError.notFound('That laboratory request was not found.');
    }

    return res.json(mapLabRequest(rows[0]));
  })
);

router.post(
  '/',
  authorize('requestLabTest'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const patientId = v.text(body.patientId || body.patient_id, 'Patient', { required: true, max: 50 });
    const testName = v.text(body.testName || body.test, 'Test name', { required: true, max: 150 });
    const priority = v.oneOf(body.priority, 'Priority', ['Routine', 'Urgent', 'Stat'], {
      fallback: 'Routine',
    });
    const notes = v.longText(body.notes, 'Notes');
    const requestDate = v.dateTime(body.date || body.requestDate, 'Request date', {
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

    const id = idGenerators.labRequest();

    await query(
      `INSERT INTO lab_requests (id, patient_id, doctor_id, test_name, request_date, status, priority, notes, branch_id)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [id, patientId, doctorId, testName, requestDate, priority, notes, req.user.branch || 1]
    );

    await recordAudit(req.user, 'REQUEST_LAB_TEST', `Requested the ${testName} test.`, {
      entity: 'labRequest',
      entityId: id,
    });

    const [rows] = await query(`${LAB_SELECT} WHERE l.id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapLabRequest(rows[0]));
  })
);

/**
 * Report a result against a request.
 *
 * The lab_results table existed and was never written to: a request could be
 * created but no result could ever be filed, so every laboratory request stayed
 * "Pending" forever. This closes that gap. Recording a result also completes
 * the request, so the laboratory queue and the patient record stay in step.
 */
router.post(
  '/:id/result',
  authorize('uploadLabResult'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM lab_requests WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);

    if (!existing.length) {
      throw ApiError.notFound('That laboratory request was not found.');
    }

    if (existing[0].status === 'Cancelled') {
      throw ApiError.conflict('A cancelled request cannot receive a result.');
    }

    const body = req.body || {};
    const resultText = v.longText(body.result || body.resultText, 'Result', { required: true });
    const notes = v.longText(body.notes, 'Notes');
    const resultDate = v.dateTime(body.resultDate, 'Result date', {
      fallback: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    const [existingResults] = await query(
      'SELECT id FROM lab_results WHERE lab_request_id = ? LIMIT 1',
      [req.params.id]
    );

    // A result is a clinical record. Filing a second one silently would lose the
    // first, so an amendment replaces it and is recorded in the audit trail.
    if (existingResults.length) {
      await query('UPDATE lab_results SET result_text = ?, result_date = ?, lab_staff_id = ?, notes = ? WHERE id = ?', [
        resultText,
        resultDate,
        req.user.id,
        notes,
        existingResults[0].id,
      ]);

      await recordAudit(req.user, 'AMEND_LAB_RESULT', 'Amended a recorded laboratory result.', {
        entity: 'labRequest',
        entityId: req.params.id,
      });

      const [rows] = await query(`${LAB_SELECT} WHERE l.id = ? LIMIT 1`, [req.params.id]);

      return res.json(mapLabRequest(rows[0]));
    }

    const resultId = idGenerators.labResult();

    await query(
      `INSERT INTO lab_results (id, lab_request_id, result_text, lab_staff_id, result_date, status, notes)
       VALUES (?, ?, ?, ?, ?, 'Completed', ?)`,
      [resultId, req.params.id, resultText, req.user.id, resultDate, notes]
    );

    await query("UPDATE lab_requests SET status = 'Completed' WHERE id = ?", [req.params.id]);

    await recordAudit(req.user, 'UPLOAD_LAB_RESULT', 'Recorded a laboratory result.', {
      entity: 'labRequest',
      entityId: req.params.id,
    });

    const [rows] = await query(`${LAB_SELECT} WHERE l.id = ? LIMIT 1`, [req.params.id]);

    return res.status(201).json(mapLabRequest(rows[0]));
  })
);

router.post(
  '/:id/cancel',
  authorize('requestLabTest'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT id, status FROM lab_requests WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);

    if (!existing.length) {
      throw ApiError.notFound('That laboratory request was not found.');
    }

    if (existing[0].status === 'Completed') {
      throw ApiError.conflict('A completed request cannot be cancelled.');
    }

    await query("UPDATE lab_requests SET status = 'Cancelled' WHERE id = ?", [req.params.id]);
    await recordAudit(req.user, 'CANCEL_LAB_REQUEST', 'Cancelled a laboratory request.', {
      entity: 'labRequest',
      entityId: req.params.id,
    });

    const [rows] = await query(`${LAB_SELECT} WHERE l.id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapLabRequest(rows[0]));
  })
);

module.exports = router;
module.exports.mapLabRequest = mapLabRequest;
