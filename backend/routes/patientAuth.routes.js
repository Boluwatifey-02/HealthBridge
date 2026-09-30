const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { query, isFallbackMode } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const v = require('../lib/validation');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const PATIENT_TOKEN_TTL = '30m';

/**
 * Patient portal sign-in.
 *
 * Patients previously had no way to reach their own record. Sharing a staff
 * login with a patient was considered and rejected: it would expose every other
 * patient's data on the same account. A patient gets a token scoped to their own
 * patient id, and the staff routes refuse it outright.
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const email = v.email((req.body || {}).email, 'Email address', { required: true });
    const password = String((req.body || {}).password || '');

    if (!password) {
      throw ApiError.badRequest('Password is required.');
    }

    if (!process.env.JWT_SECRET) {
      throw new ApiError(500, 'Authentication is not configured on the server.');
    }

    const [rows] = await query(
      'SELECT id, full_name, email, password_hash, status FROM patients WHERE email = ? LIMIT 1',
      [email]
    );

    const patient = rows[0];

    // A patient with no password set can never sign in, and the response is the
    // same as a wrong password so the endpoint cannot enumerate accounts.
    const storedHash = patient && patient.password_hash;

    if (!storedHash) {
      // Still spend the time a real comparison would, so a missing account and a
      // wrong password are not distinguishable by response time.
      await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      throw ApiError.unauthorized('Incorrect email or password.');
    }

    const valid = await bcrypt.compare(password, storedHash);

    if (!valid) {
      throw ApiError.unauthorized('Incorrect email or password.');
    }

    if (patient.status !== 'Active') {
      throw ApiError.forbidden('This patient record is not active. Please contact the clinic.');
    }

    const token = jwt.sign(
      {
        id: patient.id,
        fullName: patient.full_name,
        email: patient.email,
        // The audience is what stops a patient token being accepted anywhere a
        // staff token is expected.
        audience: 'patient',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.PATIENT_TOKEN_EXPIRES_IN || PATIENT_TOKEN_TTL }
    );

    await recordAudit(
      { id: null, fullName: patient.full_name, role: 'Patient' },
      'PATIENT_LOGIN',
      'Signed in to the patient portal.'
    );

    return res.json({
      token,
      user: {
        id: patient.id,
        fullName: patient.full_name,
        email: patient.email,
        role: 'Patient',
      },
    });
  })
);

/** Sets a password for a patient record that has an email but no password yet. */
router.post(
  '/set-password',
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const email = v.email(body.email, 'Email address', { required: true });
    const password = v.password(body.password);
    const confirmation = String(body.confirmPassword || '');

    if (password !== confirmation) {
      throw ApiError.badRequest('The two passwords do not match.');
    }

    const [rows] = await query(
      'SELECT id, full_name, password_hash FROM patients WHERE email = ? LIMIT 1',
      [email]
    );

    const patient = rows[0];

    if (!patient) {
      throw ApiError.notFound('No patient record uses that email address.');
    }

    // Setting a password on an account that already has one without proving
    // ownership would let anyone who knows a patient's email take over that
    // account. Use the sign-in page instead.
    if (patient.password_hash) {
      throw ApiError.conflict(
        'This patient record already has portal access. Use the sign-in page, or the password reset journey.'
      );
    }

    await query('UPDATE patients SET password_hash = ? WHERE id = ?', [
      await bcrypt.hash(password, BCRYPT_ROUNDS),
      patient.id,
    ]);

    await recordAudit(
      { id: null, fullName: patient.full_name, role: 'Patient' },
      'PATIENT_SET_PASSWORD',
      'Activated patient portal access.'
    );

    return res.json({ message: 'Portal access is now active. You can sign in.' });
  })
);

/**
 * A patient's own record. Returns only what the patient should see about
 * themselves: never another patient, never staff notes, never the full clinic.
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.audience !== 'patient') {
      throw ApiError.forbidden('This endpoint is for patient portal accounts.');
    }

    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    // The id comes from the verified token, never from the query string, so a
    // patient cannot request another patient's record.
    const [patients] = await query(
      `SELECT id, full_name, age, gender, phone, email, blood_group, genotype,
              allergies, \`condition\`, medical_history, last_visit
         FROM patients WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!patients.length) {
      throw ApiError.notFound('That patient record was not found.');
    }

    const patient = patients[0];

    const [appointments] = await query(
      `SELECT id, appointment_date, appointment_time, reason, status, provider
         FROM appointments
        WHERE patient_id = ? AND status <> 'Cancelled'
        ORDER BY appointment_date DESC, appointment_time DESC`,
      [patient.id]
    );

    const [prescriptions] = await query(
      `SELECT id, medicine_name, dosage, frequency, duration, quantity, instructions, status, created_at
         FROM prescriptions
        WHERE patient_id = ? AND status <> 'Cancelled'
        ORDER BY created_at DESC`,
      [patient.id]
    );

    const [labResults] = await query(
      `SELECT l.id, l.test_name, l.status, l.request_date, r.result_text, r.result_date
         FROM lab_requests l
         LEFT JOIN lab_results r ON r.lab_request_id = l.id
        WHERE l.patient_id = ?
        ORDER BY l.request_date DESC`,
      [patient.id]
    );

    return res.json({
      patient: {
        id: patient.id,
        fullName: patient.full_name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        bloodGroup: patient.blood_group,
        genotype: patient.genotype,
        allergies: patient.allergies,
        condition: patient.condition,
        medicalHistory: patient.medical_history,
        lastVisit: patient.last_visit,
      },
      appointments: appointments.map((row) => ({
        id: row.id,
        date: row.appointment_date,
        time: row.appointment_time,
        reason: row.reason,
        status: row.status,
        provider: row.provider || '',
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
      labResults: labResults.map((row) => ({
        id: row.id,
        testName: row.test_name,
        status: row.status,
        requestDate: row.request_date,
        result: row.result_text || '',
        resultDate: row.result_date,
      })),
    });
  })
);

module.exports = router;
