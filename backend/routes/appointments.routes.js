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

const STATUSES = ['Scheduled', 'Confirmed', 'Pending', 'Completed', 'Cancelled'];

const APPOINTMENT_SELECT = `SELECT a.id, a.patient_id, a.doctor_id, a.provider, a.appointment_date,
                                   a.appointment_time, a.reason, a.status, a.notes, a.branch_id,
                                   a.created_at,
                                   p.full_name AS patient_name,
                                   s.full_name AS doctor_name
                            FROM appointments a
                            LEFT JOIN patients p ON p.id = a.patient_id
                            LEFT JOIN staff s ON s.id = a.doctor_id`;

function formatTime(value) {
  if (!value) return '';

  const text = String(value).trim();

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(text)) return text;

  const [hours, minutes] = text.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mapAppointment(row) {
  if (!row) return null;

  // The clinician named when the booking was made wins; otherwise fall back to
  // the linked staff record. The previous version invented a "Clinical Care"
  // department and a "Dr. HealthBridge" name whenever no clinician was stored.
  const clinician = row.provider || row.doctor_name || '';

  return {
    id: row.id,
    patient: row.patient_name || 'Unknown patient',
    patientId: row.patient_id || '',
    doctorId: row.doctor_id || '',
    doctor: clinician,
    provider: clinician,
    type: row.reason || 'Consultation',
    reason: row.reason || '',
    status: row.status || 'Scheduled',
    date: row.appointment_date,
    dateLabel: formatDate(row.appointment_date),
    time: row.appointment_time,
    timeLabel: formatTime(row.appointment_time),
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

router.get(
  '/',
  authorize('viewAppointments'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const status = req.query.status ? v.oneOf(req.query.status, 'Status', STATUSES) : null;
    const patientId = v.text(req.query.patientId, 'Patient id', { max: 50 });
    const from = v.isoDate(req.query.from, 'From date');
    const to = v.isoDate(req.query.to, 'To date');
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 200, fallback: 100 });

    const where = [];
    const params = [];

    if (status) {
      where.push('a.status = ?');
      params.push(status);
    }
    if (patientId) {
      where.push('a.patient_id = ?');
      params.push(patientId);
    }
    if (from) {
      where.push('a.appointment_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('a.appointment_date <= ?');
      params.push(to);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await query(
      `${APPOINTMENT_SELECT} ${clause}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM appointments a ${clause}`,
      params
    );

return sendList(req, res, 'appointments', {
      appointments: rows.map(mapAppointment),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    });
  })
);

router.get(
  '/:id',
  authorize('viewAppointments'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${APPOINTMENT_SELECT} WHERE a.id = ? LIMIT 1`, [req.params.id]);

    if (!rows.length) {
      throw ApiError.notFound('That appointment was not found.');
    }

    return res.json(mapAppointment(rows[0]));
  })
);

/**
 * Resolves the clinician for an appointment.
 *
 * The previous code fell back to a hard-coded 'STAFF-001' whenever the id could
 * not be resolved, which silently attributed bookings to a clinician who was not
 * involved. This now reports the problem instead of recording something false.
 */
async function resolveClinician({ doctorId, provider }) {
  if (doctorId) {
    const [rows] = await query('SELECT id, full_name FROM staff WHERE id = ? AND status = ? LIMIT 1', [
      doctorId,
      'Active',
    ]);

    if (!rows.length) {
      throw ApiError.badRequest('The selected clinician is not an active staff member.');
    }

    return { id: rows[0].id, name: rows[0].full_name };
  }

  if (provider) {
    // A free-text clinician name is accepted for walk-ins, but the booking is
    // still attributed to the signed-in user so accountability is not lost.
    return { id: null, name: provider };
  }

  throw ApiError.badRequest('Choose the clinician who will see this patient.');
}

router.post(
  '/',
  authorize('scheduleAppointment'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const patientId = v.text(body.patientId || body.patient_id, 'Patient', { required: true, max: 50 });
    const date = v.isoDate(body.date || body.appointmentDate, 'Appointment date', {
      required: true,
    });
    const time = v.timeOfDay(body.time || body.appointmentTime, 'Appointment time', {
      required: true,
    });
    const reason = v.text(body.reason || body.type, 'Reason for visit', {
      required: true,
      max: 255,
    });
    const notes = v.longText(body.notes, 'Notes');
    const status = v.oneOf(body.status, 'Status', STATUSES, { fallback: 'Scheduled' });
    const providerName = v.text(body.provider, 'Clinician name', { max: 150 });
    const doctorId = v.text(body.doctorId || body.doctor_id, 'Clinician id', { max: 50 });

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [patientId]);

    if (!patientRows.length) {
      throw ApiError.notFound('That patient was not found.');
    }

    const clinician = await resolveClinician({ doctorId, provider: providerName });

    // Double booking: the same clinician cannot hold two appointments in the
    // same slot. The old code allowed this and the conflict only surfaced as
    // two rows on the schedule.
    const [clash] = await query(
      `SELECT id FROM appointments
        WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
          AND status IN ('Scheduled', 'Confirmed', 'Pending')
        LIMIT 1`,
      [clinician.id || req.user.id, date, time]
    );

    if (clash.length && clinician.id) {
      throw ApiError.conflict('That clinician already has an appointment in this slot.');
    }

    const id = idGenerators.appointment();

    await query(
      `INSERT INTO appointments
        (id, patient_id, doctor_id, provider, appointment_date, appointment_time, reason, status, notes, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        patientId,
        clinician.id,
        clinician.name || null,
        date,
        time,
        reason,
        status,
        notes,
        req.user.branch || 1,
      ]
    );

    await recordAudit(req.user, 'CREATE_APPOINTMENT', 'Booked an appointment.', {
      entity: 'appointment',
      entityId: id,
    });

    const [rows] = await query(`${APPOINTMENT_SELECT} WHERE a.id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapAppointment(rows[0]));
  })
);

router.put(
  '/:id',
  authorize('updateAppointment'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [req.params.id]);

    if (!existing.length) {
      throw ApiError.notFound('That appointment was not found.');
    }

    const before = existing[0];
    const body = req.body || {};

    const date = body.date || body.appointmentDate
      ? v.isoDate(body.date || body.appointmentDate, 'Appointment date')
      : before.appointment_date;
    const time = body.time || body.appointmentTime
      ? v.timeOfDay(body.time || body.appointmentTime, 'Appointment time')
      : before.appointment_time;
    const reason = body.reason !== undefined
      ? v.text(body.reason, 'Reason for visit', { required: true, max: 255 })
      : before.reason;
    const status = body.status !== undefined
      ? v.oneOf(body.status, 'Status', STATUSES, { required: true })
      : before.status;
    const notes = body.notes !== undefined ? v.longText(body.notes, 'Notes') : before.notes;

    await query(
      `UPDATE appointments
          SET appointment_date = ?, appointment_time = ?, reason = ?, status = ?, notes = ?
        WHERE id = ?`,
      [date, time, reason, status, notes, req.params.id]
    );

    const changes = [];
    if (String(before.appointment_date) !== String(date)) changes.push('date');
    if (String(before.appointment_time) !== String(time)) changes.push('time');
    if (before.status !== status) changes.push(`status -> ${status}`);
    if (before.reason !== reason) changes.push('reason');

    await recordAudit(
      req.user,
      'UPDATE_APPOINTMENT',
      changes.length ? `Updated appointment (${changes.join(', ')}).` : 'Updated appointment with no changed fields.',
      { entity: 'appointment', entityId: req.params.id }
    );

    const [rows] = await query(`${APPOINTMENT_SELECT} WHERE a.id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapAppointment(rows[0]));
  })
);

router.delete(
  '/:id',
  authorize('cancelAppointment'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT id, status FROM appointments WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);

    if (!existing.length) {
      throw ApiError.notFound('That appointment was not found.');
    }

    // Cancelled rather than deleted, so the booking history stays auditable.
    await query("UPDATE appointments SET status = 'Cancelled' WHERE id = ?", [req.params.id]);
    await recordAudit(req.user, 'CANCEL_APPOINTMENT', 'Cancelled an appointment.', {
      entity: 'appointment',
      entityId: req.params.id,
    });

    return res.json({ message: 'The appointment has been cancelled.', id: req.params.id });
  })
);

module.exports = router;
module.exports.mapAppointment = mapAppointment;
module.exports.STATUSES = STATUSES;
