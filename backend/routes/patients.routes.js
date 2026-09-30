const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const { idGenerators } = require('../lib/ids');
const v = require('../lib/validation');

const router = express.Router();

// A patient portal token may reach this route only to read its own record.
router.use(authenticate, staffOnly);

const PATIENT_SELECT = `SELECT id, full_name, age, gender, phone, email, address, occupation,
                               emergency_contact, blood_group, genotype, allergies,
                               \`condition\`, medical_history, notes, status, last_visit,
                               branch_id, created_at, updated_at
                        FROM patients`;

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

function mapPatient(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.full_name,
    fullName: row.full_name,
    age: row.age === null ? null : Number(row.age),
    gender: row.gender || 'Not specified',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    occupation: row.occupation || '',
    emergencyContact: row.emergency_contact || '',
    bloodGroup: row.blood_group || '',
    genotype: row.genotype || '',
    allergies: row.allergies || '',
    condition: row.condition || '',
    medicalHistory: row.medical_history || '',
    notes: row.notes || '',
    status: row.status || 'Active',
    branch: row.branch_id,
    lastVisit: row.last_visit ? formatDate(row.last_visit) : 'Not recorded',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Shared list behaviour: free-text search and filtering. Returns the SQL
 * fragment and its bound parameters, so the count query can reuse them.
 */
function buildListQuery({ search, status, gender }) {
  const where = [];
  const params = [];

  if (search) {
    // Parameterised, so a name containing an apostrophe or a % is searched
    // literally rather than being interpreted as SQL.
    where.push('(full_name LIKE ? OR phone LIKE ? OR id LIKE ? OR email LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (status) {
    where.push('status = ?');
    params.push(status);
  }

  if (gender) {
    where.push('gender = ?');
    params.push(gender);
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get(
  '/',
  authorize('viewPatient'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const search = v.text(req.query.search, 'Search term', { max: 120 });
    const status = req.query.status ? v.oneOf(req.query.status, 'Status', ['Active', 'Inactive', 'Deceased']) : null;
    const gender = req.query.gender ? v.text(req.query.gender, 'Gender', { max: 20 }) : null;
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 100, fallback: 50 });

    const { clause, params } = buildListQuery({ search, status, gender });

    const [rows] = await query(
      `${PATIENT_SELECT} ${clause} ORDER BY created_at DESC, full_name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM patients ${clause}`,
      params
    );

    return res.json({
      patients: rows.map(mapPatient),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    });
  })
);

router.get(
  '/:id',
  authorize('viewPatient'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${PATIENT_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);

    if (!rows.length) {
      throw ApiError.notFound('That patient record was not found.');
    }

    await recordAudit(req.user, 'VIEW_PATIENT_RECORD', 'Viewed a patient record.', {
      entity: 'patient',
      entityId: rows[0].id,
    });

    return res.json(mapPatient(rows[0]));
  })
);

/**
 * Everything known about one patient, in one call: the patient, their
 * appointments, consultations, prescriptions and laboratory work. The patient
 * detail page previously counted consultations with a hard-coded 3, so this is
 * the source of truth the interface now uses.
 */
router.get(
  '/:id/timeline',
  authorize('viewMedicalHistory'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [patients] = await query(`${PATIENT_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);

    if (!patients.length) {
      throw ApiError.notFound('That patient record was not found.');
    }

    const patientId = patients[0].id;

    const [appointments] = await query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.reason, a.status, a.notes,
              a.provider, s.full_name AS doctor_name
         FROM appointments a
         LEFT JOIN staff s ON s.id = a.doctor_id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [patientId]
    );

    const [consultations] = await query(
      `SELECT c.id, c.consultation_date, c.complaint, c.diagnosis, c.treatment, c.notes,
              c.follow_up, s.full_name AS doctor_name
         FROM consultations c
         LEFT JOIN staff s ON s.id = c.doctor_id
        WHERE c.patient_id = ?
        ORDER BY c.consultation_date DESC`,
      [patientId]
    );

    const [prescriptions] = await query(
      `SELECT id, medicine_name, dosage, frequency, duration, quantity, instructions, status, created_at
         FROM prescriptions
        WHERE patient_id = ?
        ORDER BY created_at DESC`,
      [patientId]
    );

    const [labRequests] = await query(
      `SELECT l.id, l.test_name, l.request_date, l.status, l.priority, l.notes,
              r.result_text, r.result_date
         FROM lab_requests l
         LEFT JOIN lab_results r ON r.lab_request_id = l.id
        WHERE l.patient_id = ?
        ORDER BY l.request_date DESC`,
      [patientId]
    );

    const [documents] = await query(
      'SELECT id, document_type, file_name, uploaded_at FROM patient_documents WHERE patient_id = ? ORDER BY uploaded_at DESC',
      [patientId]
    );

    const completedConsultations = consultations.filter(
      (row) => row.diagnosis && row.diagnosis.trim() !== ''
    ).length;

    return res.json({
      patient: mapPatient(patients[0]),
      appointments: appointments.map((row) => ({
        id: row.id,
        date: row.appointment_date,
        time: row.appointment_time,
        reason: row.reason,
        status: row.status,
        notes: row.notes,
        provider: row.provider || row.doctor_name || '',
      })),
      consultations: consultations.map((row) => ({
        id: row.id,
        date: row.consultation_date,
        complaint: row.complaint,
        diagnosis: row.diagnosis,
        treatment: row.treatment,
        notes: row.notes,
        followUp: row.follow_up,
        doctor: row.doctor_name || '',
      })),
      prescriptions: prescriptions.map((row) => ({
        id: row.id,
        medicineName: row.medicine_name,
        dosage: row.dosage,
        frequency: row.frequency,
        duration: row.duration,
        quantity: Number(row.quantity || 0),
        instructions: row.instructions,
        status: row.status,
        createdAt: row.created_at,
      })),
      labRequests: labRequests.map((row) => ({
        id: row.id,
        testName: row.test_name,
        requestDate: row.request_date,
        status: row.status,
        priority: row.priority,
        notes: row.notes,
        resultText: row.result_text,
        resultDate: row.result_date,
      })),
      documents: documents.map((row) => ({
        id: row.id,
        type: row.document_type,
        fileName: row.file_name,
        uploadedAt: row.uploaded_at,
      })),
      counts: {
        appointments: appointments.length,
        consultations: consultations.length,
        completedConsultations,
        prescriptions: prescriptions.length,
        labRequests: labRequests.length,
        documents: documents.length,
      },
    });
  })
);

router.post(
  '/',
  authorize('registerPatient'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};

    const fullName = v.text(body.fullName || body.name, 'Patient name', { required: true, max: 120 });
    const age = v.integer(body.age, 'Age', { min: 0, max: 130 });
    const gender = v.text(body.gender, 'Gender', { max: 20 });
    const phoneNumber = v.phone(body.phone, 'Phone number');
    const emailAddress = v.email(body.email, 'Email address');
    const address = v.text(body.address, 'Address', { max: 255 });
    const occupation = v.text(body.occupation, 'Occupation', { max: 120 });
    const emergencyContact = v.text(body.emergencyContact, 'Emergency contact', { max: 80 });
    const bloodGroup = v.text(body.bloodGroup, 'Blood group', { max: 10 });
    const genotype = v.text(body.genotype, 'Genotype', { max: 10 });
    const allergies = v.text(body.allergies, 'Allergies', { max: 255 });
    const condition = v.text(body.condition, 'Condition', { max: 255 });
    const medicalHistory = v.longText(body.medicalHistory, 'Medical history');
    const notes = v.longText(body.notes, 'Notes');
    const status = v.oneOf(body.status, 'Status', ['Active', 'Inactive', 'Deceased'], {
      fallback: 'Active',
    });

    // A patient signing themselves up for the portal must not be able to set
    // their own clinical record; staff-issued accounts carry clinical detail.
    const branch = v.integer(req.user.branch, 'Branch', { min: 1, max: 10000, fallback: 1 });
    const id = idGenerators.patient();

    await query(
      `INSERT INTO patients
        (id, full_name, age, gender, phone, email, address, occupation, emergency_contact,
         blood_group, genotype, allergies, \`condition\`, medical_history, notes, status, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, fullName, age, gender, phoneNumber, emailAddress, address, occupation,
        emergencyContact, bloodGroup, genotype, allergies, condition, medicalHistory,
        notes, status, branch,
      ]
    );

    await recordAudit(req.user, 'CREATE_PATIENT', 'Registered a new patient.', {
      entity: 'patient',
      entityId: id,
    });

    const [rows] = await query(`${PATIENT_SELECT} WHERE id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapPatient(rows[0]));
  })
);

router.put(
  '/:id',
  authorize('editPatientDemographics'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM patients WHERE id = ? LIMIT 1', [req.params.id]);

    if (!existing.length) {
      throw ApiError.notFound('That patient record was not found.');
    }

    const body = req.body || {};
    const before = existing[0];

    const fullName = v.text(body.fullName || body.name, 'Patient name', { required: true, max: 120 });
    const age = v.integer(body.age, 'Age', { min: 0, max: 130 });
    const gender = v.text(body.gender, 'Gender', { max: 20 });
    const phoneNumber = v.phone(body.phone, 'Phone number');
    const emailAddress = v.email(body.email, 'Email address');
    const address = v.text(body.address, 'Address', { max: 255 });
    const occupation = v.text(body.occupation, 'Occupation', { max: 120 });
    const emergencyContact = v.text(body.emergencyContact, 'Emergency contact', { max: 80 });
    const bloodGroup = v.text(body.bloodGroup, 'Blood group', { max: 10 });
    const genotype = v.text(body.genotype, 'Genotype', { max: 10 });
    const allergies = v.text(body.allergies, 'Allergies', { max: 255 });
    const condition = v.text(body.condition, 'Condition', { max: 255 });
    const medicalHistory = v.longText(body.medicalHistory, 'Medical history');
    const notes = v.longText(body.notes, 'Notes');
    const status = v.oneOf(body.status, 'Status', ['Active', 'Inactive', 'Deceased'], {
      fallback: before.status,
    });

    await query(
      `UPDATE patients
          SET full_name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?,
              occupation = ?, emergency_contact = ?, blood_group = ?, genotype = ?,
              allergies = ?, \`condition\` = ?, medical_history = ?, notes = ?, status = ?
        WHERE id = ?`,
      [
        fullName, age, gender, phoneNumber, emailAddress, address, occupation,
        emergencyContact, bloodGroup, genotype, allergies, condition, medicalHistory,
        notes, status, req.params.id,
      ]
    );

    const changed = [
      'full_name', 'phone', 'email', 'address', 'allergies', 'condition', 'status', 'blood_group',
    ].filter((field) => String(before[field] ?? '') !== String({
      full_name: fullName, phone: phoneNumber, email: emailAddress, address,
      allergies, condition, status, blood_group: bloodGroup,
    }[field] ?? ''));

    await recordAudit(
      req.user,
      'UPDATE_PATIENT',
      changed.length
        ? `Updated patient record (${changed.join(', ')}).`
        : 'Updated patient record with no changed fields.',
      { entity: 'patient', entityId: req.params.id }
    );

    const [rows] = await query(`${PATIENT_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapPatient(rows[0]));
  })
);

/**
 * Soft delete. Patient records are never physically removed: they are part of
 * the clinical history and the audit trail refers to them. Deactivating keeps
 * every past consultation and prescription intact and reversible.
 */
router.delete(
  '/:id',
  authorize('cancelAppointment'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT id, status FROM patients WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);

    if (!existing.length) {
      throw ApiError.notFound('That patient record was not found.');
    }

    await query("UPDATE patients SET status = 'Inactive' WHERE id = ?", [req.params.id]);
    await query("UPDATE appointments SET status = 'Cancelled' WHERE patient_id = ? AND status IN ('Scheduled', 'Confirmed', 'Pending')", [
      req.params.id,
    ]);

    await recordAudit(req.user, 'DEACTIVATE_PATIENT', 'Deactivated a patient record and cancelled their open appointments.', {
      entity: 'patient',
      entityId: req.params.id,
    });

    return res.json({ message: 'The patient record has been deactivated.', id: req.params.id });
  })
);

module.exports = router;
module.exports.mapPatient = mapPatient;
module.exports.PATIENT_SELECT = PATIENT_SELECT;
module.exports.buildListQuery = buildListQuery;
