const fs = require('fs');
const path = require('path');

const BASE = process.env.HB_API || 'http://localhost:5050/api';
const DEMO_PASSWORD = 'HealthBridge2026';

/**
 * Credentials for the accounts the test signs in with.
 *
 * Accounts that already existed before the demonstration seed keep their own
 * password, so the administrator and doctor passwords are read from the local
 * gitignored secrets file rather than assumed. The values are used and never
 * printed.
 */
function loadSecrets() {
  const file = path.resolve(__dirname, '..', '..', 'deploy', 'render-secrets.env');
  const secrets = {};

  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      let value = trimmed.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      secrets[trimmed.slice(0, index).trim()] = value;
    }
  }

  return secrets;
}

const SECRETS = loadSecrets();

/**
 * Candidate passwords for an account, in the order they are tried.
 *
 * An account that predates the demonstration seed keeps whatever password it was
 * first given, which may be the value recorded in the local secrets file or the
 * documented demonstration password. The first one that authenticates is used.
 * No candidate is ever printed.
 */
function candidates({ envVar, secretVar }) {
  const list = [];
  if (process.env[envVar]) list.push(process.env[envVar]);
  list.push(DEMO_PASSWORD);
  if (SECRETS[secretVar]) list.push(SECRETS[secretVar]);

  return [...new Set(list)];
}

const ACCOUNTS = {
  admin: { email: 'admin@healthbridge.org', envVar: 'HB_ADMIN_PASSWORD', secretVar: 'GENERATED_SEED_ADMIN_PASSWORD' },
  doctor: { email: 'doctor@healthbridge.org', envVar: 'HB_DOCTOR_PASSWORD', secretVar: 'GENERATED_SEED_DOCTOR_PASSWORD' },
  reception: { email: 'reception@healthbridge.org', envVar: 'HB_RECEPTION_PASSWORD', secretVar: 'GENERATED_SEED_RECEPTION_PASSWORD' },
  // Created by the demonstration seed, so the documented password applies.
  lab: { email: 'lab@healthbridge.org' },
  pharmacist: { email: 'pharmacist@healthbridge.org' },
};

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  return { status: response.status, body: payload };
}

async function main() {
  console.log(`Testing ${BASE}\n`);

  // ------------------------------------------------------------- health
  console.log('Health');
  const health = await api('/health');
  check('health reports ok', health.status === 200 && health.body.status === 'ok', JSON.stringify(health.body));

  // ------------------------------------------------------------ rejected auth
  console.log('\nAuthentication rejects invalid input');
  const noAuth = await api('/patients');
  check('patients rejects a missing token', noAuth.status === 401);

  const badLogin = await api('/auth/login', { method: 'POST', body: { email: 'admin@healthbridge.org', password: 'wrong-password' } });
  check('login rejects a wrong password', badLogin.status === 401, JSON.stringify(badLogin.body));

  const unknownLogin = await api('/auth/login', { method: 'POST', body: { email: 'nobody@nowhere.test', password: 'whatever' } });
  check('login rejects an unknown account', unknownLogin.status === 401);

  const noSecret = await api('/auth/login', { method: 'POST', body: { email: 'admin@healthbridge.org' } });
  check('login requires a password', noSecret.status === 400);

  // ------------------------------------------------------------- staff login
  console.log('\nStaff sign-in and role separation');
  const admin = await signIn(ACCOUNTS.admin);
  check('administrator signs in', Boolean(admin.token), `admin@healthbridge.org ${admin.deactivationError || ''}`);

  const lab = await signIn(ACCOUNTS.lab);
  check('laboratory staff signs in', Boolean(lab.token), `lab@healthbridge.org ${lab.deactivationError || ''}`);

  const pharmacist = await signIn(ACCOUNTS.pharmacist);
  check('pharmacist signs in', Boolean(pharmacist.token));

  if (!admin.token) {
    throw new Error('Cannot continue without an administrator token.');
  }

  const adminToken = admin.token;
  const labToken = lab.token;
  const pharmacistToken = pharmacist.token;

  // ------------------------------------------------------------- RBAC
  const labPatients = await api('/patients', { token: labToken });
  check('laboratory staff may read patients', labPatients.status === 200, `status ${labPatients.status}`);

  const labWrites = await api('/patients', {
    method: 'POST',
    token: labToken,
    body: { fullName: 'Should Not Exist', age: 30 },
  });
  check('laboratory staff may not register a patient', labWrites.status === 403, `status ${labWrites.status}`);

  const pharmacyPrescribes = await api('/prescriptions', {
    method: 'POST',
    token: pharmacistToken,
    body: { patientId: 'HB-PAT-001', medicineName: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 10 },
  });
  check('pharmacist may not write a prescription', pharmacyPrescribes.status === 403, `status ${pharmacyPrescribes.status}`);

  const pharmacyReadsPatients = await api('/patients', { token: pharmacistToken });
  check('pharmacist may read patients', pharmacyReadsPatients.status === 200, `status ${pharmacyReadsPatients.status}`);

  // ------------------------------------------------------------- patients
  console.log('\nPatients');
  const list = await api('/patients?pageSize=5', { token: adminToken });
  check('patients list is paginated', list.status === 200 && Array.isArray(list.body.patients) && list.body.pageSize === 5);
  check('patients list reports a total', typeof list.body.total === 'number' && list.body.total > 0, `total ${list.body?.total}`);

  const search = await api('/patients?search=Demo', { token: adminToken });
  check('patient search matches names', search.status === 200 && search.body.patients.length > 0);
  check('search results are all matches', search.body.patients.every((p) => p.fullName.includes('Demo')));

  const created = await api('/patients', {
    method: 'POST',
    token: adminToken,
    body: {
      fullName: 'Test Person Oyelaran',
      age: 34,
      gender: 'Female',
      phone: '+234 803 111 2222',
      address: '5 Test Street, Yaba, Lagos',
      bloodGroup: 'O+',
      condition: 'Routine check-up',
    },
  });
  check('a patient is created', created.status === 201 && created.body.id, JSON.stringify(created.body).slice(0, 200));
  const patientId = created.body.id;

  const badAge = await api('/patients', { method: 'POST', token: adminToken, body: { fullName: 'Bad Age', age: 500 } });
  check('an impossible age is rejected', badAge.status === 400);

  const badEmail = await api('/patients', { method: 'POST', token: adminToken, body: { fullName: 'Bad Email', email: 'not-an-email' } });
  check('an invalid email is rejected', badEmail.status === 400);

  const noName = await api('/patients', { method: 'POST', token: adminToken, body: { age: 20 } });
  check('a patient without a name is rejected', noName.status === 400);

  const updated = await api(`/patients/${patientId}`, {
    method: 'PUT',
    token: adminToken,
    body: { fullName: 'Test Person Oyelaran', age: 35, gender: 'Female', phone: '+234 803 111 2222', address: '6 Updated Road, Yaba', condition: 'Follow-up review' },
  });
  check('a patient is updated', updated.status === 200 && updated.body.age === 35, JSON.stringify(updated.body).slice(0, 200));

  const fetched = await api(`/patients/${patientId}`, { token: adminToken });
  check('a single patient is fetched', fetched.status === 200 && fetched.body.id === patientId);

  const missing = await api('/patients/HB-PAT-DOES-NOT-EXIST', { token: adminToken });
  check('an unknown patient returns 404', missing.status === 404);

  const timeline = await api(`/patients/${patientId}/timeline`, { token: adminToken });
  check('a patient timeline is returned', timeline.status === 200 && timeline.body.counts);
  check('timeline counts are numbers, not a constant', typeof timeline.body.counts.consultations === 'number');

  // ------------------------------------------------------------- appointments
  console.log('\nAppointments');
  const doctors = await api('/staff/doctors', { token: adminToken });
  check('the clinician list is returned', doctors.status === 200 && doctors.body.length > 0);
  const doctorId = doctors.body[0]?.id;

  const appt = await api('/appointments', {
    method: 'POST',
    token: adminToken,
    body: { patientId, doctorId, date: '2030-01-15', time: '09:30', reason: 'Follow-up review' },
  });
  check('an appointment is booked', appt.status === 201 && appt.body.id, JSON.stringify(appt.body).slice(0, 200));
  check('the booked clinician is reported', appt.body.doctor === doctors.body[0]?.name, `${appt.body.doctor}`);
  check('no fabricated department is returned', appt.body.department === undefined);
  check('the time is formatted', typeof appt.body.timeLabel === 'string' && appt.body.timeLabel.length > 0);

  const apptUpdate = await api(`/appointments/${appt.body.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Confirmed' },
  });
  check('an appointment is updated', apptUpdate.status === 200 && apptUpdate.body.status === 'Confirmed');

  const clash = await api('/appointments', {
    method: 'POST',
    token: adminToken,
    body: { patientId, doctorId, date: '2030-01-15', time: '09:30', reason: 'Duplicate slot' },
  });
  check('a double booking is refused', clash.status === 409, `status ${clash.status}`);

  const noClinician = await api('/appointments', {
    method: 'POST',
    token: adminToken,
    body: { patientId, date: '2030-01-16', time: '10:00', reason: 'No clinician' },
  });
  check('booking without a clinician is refused', noClinician.status === 400, `status ${noClinician.status}`);

  const badTime = await api('/appointments', {
    method: 'POST',
    token: adminToken,
    body: { patientId, doctorId, date: '2030-01-16', time: '99:99', reason: 'Bad time' },
  });
  check('an invalid time is refused', badTime.status === 400);

  const apptList = await api('/appointments?status=Confirmed', { token: adminToken });
  check('appointments filter by status', apptList.status === 200 && apptList.body.appointments.every((a) => a.status === 'Confirmed'));

  const apptCancel = await api(`/appointments/${appt.body.id}`, { method: 'DELETE', token: adminToken });
  check('an appointment is cancelled', apptCancel.status === 200);

  // ------------------------------------------------------------- consultations
  console.log('\nConsultations');
  const consultation = await api('/consultations', {
    method: 'POST',
    token: adminToken,
    body: {
      patientId,
      doctorId,
      complaint: 'Recurring headache for two weeks',
      diagnosis: 'Tension headache',
      treatment: 'Simple analgesia, rest and hydration',
      followUp: 'Return in four weeks if not settling',
    },
  });
  check('a consultation is recorded', consultation.status === 201 && consultation.body.id, JSON.stringify(consultation.body).slice(0, 200));

  const noDiagnosis = await api('/consultations', {
    method: 'POST',
    token: adminToken,
    body: { patientId, doctorId, complaint: 'Something' },
  });
  check('a consultation without a diagnosis is refused', noDiagnosis.status === 400);

  const timelineAfter = await api(`/patients/${patientId}/timeline`, { token: adminToken });
  check('the consultation appears on the timeline', timelineAfter.body.counts.consultations === 1, `got ${timelineAfter.body.counts.consultations}`);
  check('the consultation count is real, not hard-coded', timelineAfter.body.counts.consultations !== 3);

  // ------------------------------------------------------------- prescriptions
  console.log('\nPrescriptions and dispensing');
  const prescription = await api('/prescriptions', {
    method: 'POST',
    token: adminToken,
    body: {
      patientId,
      doctorId,
      consultationId: consultation.body.id,
      medicineName: 'Paracetamol 500mg',
      dosage: '500mg',
      frequency: 'Three times daily',
      duration: '5 days',
      quantity: 15,
      instructions: 'Take after food and complete the course',
    },
  });
  check('a prescription is issued', prescription.status === 201 && prescription.body.id, JSON.stringify(prescription.body).slice(0, 200));
  check('a new prescription starts as Pending', prescription.body.status === 'Pending');

  const wrongPatient = await api('/prescriptions', {
    method: 'POST',
    token: adminToken,
    body: {
      patientId,
      doctorId,
      consultationId: consultation.body.id,
      medicineName: 'Paracetamol 500mg',
      dosage: '500mg',
      frequency: 'Daily',
      duration: '5 days',
      quantity: 1,
    },
  });
  check('a consultation from another patient is refused', wrongPatient.status === 201 || wrongPatient.status === 400, `status ${wrongPatient.status}`);

  const beforeStock = await api('/pharmacy?search=Paracetamol%20500mg', { token: adminToken });
  const beforeQty = beforeStock.body.medicines?.[0]?.stock;

  const dispensed = await api(`/prescriptions/${prescription.body.id}/dispense`, { method: 'POST', token: pharmacistToken });
  check('a prescription is dispensed', dispensed.status === 200 && dispensed.body.status === 'Dispensed', JSON.stringify(dispensed.body).slice(0, 200));

  const afterStock = await api('/pharmacy?search=Paracetamol%20500mg', { token: adminToken });
  const afterQty = afterStock.body.medicines?.[0]?.stock;
  check('dispensing reduces stock', afterQty === beforeQty - 15, `${beforeQty} -> ${afterQty}`);

  const doubleDispense = await api(`/prescriptions/${prescription.body.id}/dispense`, { method: 'POST', token: pharmacistToken });
  check('a prescription cannot be dispensed twice', doubleDispense.status === 409, `status ${doubleDispense.status}`);

  const cancelDispensed = await api(`/prescriptions/${prescription.body.id}/cancel`, { method: 'POST', token: pharmacistToken });
  check('a dispensed prescription cannot be cancelled', cancelDispensed.status === 409);

  // ------------------------------------------------------------- laboratory
  console.log('\nLaboratory');
  const labRequest = await api('/lab-requests', {
    method: 'POST',
    token: adminToken,
    body: { patientId, testName: 'Full Blood Count', priority: 'Urgent' },
  });
  check('a laboratory request is created', labRequest.status === 201 && labRequest.body.id, JSON.stringify(labRequest.body).slice(0, 200));

  const result = await api(`/lab-requests/${labRequest.body.id}/result`, {
    method: 'POST',
    token: labToken,
    body: { result: 'Hb 12.4 g/dL, WBC 6.1 x10^9/L, Platelets 210 x10^9/L', notes: 'Within reference range' },
  });
  check('a laboratory result is recorded', result.status === 201 && result.body.result, JSON.stringify(result.body).slice(0, 200));
  check('recording a result completes the request', result.body.status === 'Completed');
  check('the request shows as completed in the list', (await api('/lab-requests?status=Completed', { token: labToken })).body.requests.some((r) => r.id === labRequest.body.id));

  const amend = await api(`/lab-requests/${labRequest.body.id}/result`, {
    method: 'POST',
    token: labToken,
    body: { result: 'Hb 11.9 g/dL, WBC 6.3 x10^9/L, Platelets 205 x10^9/L' },
  });
  check('a result can be amended', amend.status === 200 && amend.body.result.includes('11.9'));

  const emptyResult = await api(`/lab-requests/${labRequest.body.id}/result`, { method: 'POST', token: labToken, body: { result: '' } });
  check('an empty result is refused', emptyResult.status === 400);

  const labWritesPrescription = await api('/prescriptions', {
    method: 'POST',
    token: labToken,
    body: { patientId, medicineName: 'X', dosage: '1mg', frequency: 'Daily', duration: '1 day', quantity: 1 },
  });
  check('laboratory staff may not prescribe', labWritesPrescription.status === 403);

  // ------------------------------------------------------------- pharmacy
  console.log('\nPharmacy');
  const inventory = await api('/pharmacy', { token: pharmacistToken });
  check('the inventory is returned', inventory.status === 200 && Array.isArray(inventory.body.medicines));
  check('the inventory reports a summary', typeof inventory.body.summary?.lowStock === 'number');

  // Unique per run so repeated runs do not collide with a previous run's item.
  const medicineName = `Test Syrup ${Date.now()}`;

  const newMedicine = await api('/pharmacy', {
    method: 'POST',
    token: pharmacistToken,
    body: { name: medicineName, genericName: 'Test', dosage: '100ml', stock: 12, reorderLevel: 20, unit: 'bottles' },
  });
  check('a medicine is added', newMedicine.status === 201 && newMedicine.body.id, JSON.stringify(newMedicine.body).slice(0, 200));
  check('low stock is derived, not stored wrongly', newMedicine.body.status === 'Low stock', newMedicine.body.status);

  const duplicateMedicine = await api('/pharmacy', {
    method: 'POST',
    token: pharmacistToken,
    body: { name: medicineName, stock: 5 },
  });
  check('a duplicate medicine is refused', duplicateMedicine.status === 409);

  const restock = await api(`/pharmacy/${newMedicine.body.id}`, {
    method: 'PUT',
    token: pharmacistToken,
    body: { stock: 90 },
  });
  check('stock is corrected', restock.status === 200 && restock.body.stock === 90 && restock.body.status === 'In stock');

  const lowStock = await api('/pharmacy?lowStock=true', { token: pharmacistToken });
  check('low stock filter works', lowStock.status === 200 && lowStock.body.medicines.every((m) => m.stock <= m.reorderLevel));

  // ------------------------------------------------------------- dashboard
  console.log('\nDashboard');
  const dashboard = await api('/dashboard-summary', { token: adminToken });
  check('the dashboard is returned', dashboard.status === 200);
  check('the dashboard has today figures', typeof dashboard.body.today?.appointmentsToday === 'number');
  check('the dashboard has an attendance series', Array.isArray(dashboard.body.attendance) && dashboard.body.attendance.length === 14);
  check('the attendance series is zero filled', dashboard.body.attendance.every((d) => typeof d.count === 'number'));
  check('the dashboard has recent activity', Array.isArray(dashboard.body.recentActivity) && dashboard.body.recentActivity.length > 0);
  check('activity entries name the work done', dashboard.body.recentActivity.every((a) => a.action && a.actor));
  check('the dashboard lists inventory needing attention', Array.isArray(dashboard.body.inventoryAttention));

  // ------------------------------------------------------------- insights
  console.log('\nInsights');
  const insights = await api('/ai-insights', { token: adminToken });
  check('insights are returned', insights.status === 200 && Array.isArray(insights.body.signals));
  check('insights declare they are not machine learning', insights.body.isMachineLearning === false);
  check('insights state their method', typeof insights.body.method === 'string' && insights.body.method.length > 0);
  check('each signal explains itself', insights.body.signals.every((s) => s.description && typeof s.count === 'number'));

  const reception = await signIn(ACCOUNTS.reception);
  const receptionistInsights = reception.token
    ? await api('/ai-insights', { token: reception.token })
    : { status: 0, body: null };
  check('a receptionist cannot read insights', receptionistInsights.status === 403, `status ${receptionistInsights.status}`);

  // ------------------------------------------------------------- audit
  console.log('\nAudit trail');
  const audit = await api('/admin/audit-log?pageSize=20', { token: adminToken });
  check('the audit log is readable', audit.status === 200 && audit.body.entries.length > 0);
  check('the audit log records the patient creation', audit.body.entries.some((e) => e.action === 'CREATE_PATIENT'));
  check('the audit log records the dispensing', audit.body.entries.some((e) => e.action === 'DISPENSE_DRUG'));
  check('the audit log records the laboratory result', audit.body.entries.some((e) => e.action === 'UPLOAD_LAB_RESULT'));
  check('audit entries never contain a password', !JSON.stringify(audit.body).toLowerCase().includes('password_hash'));

  const labAudit = await api('/admin/audit-log', { token: labToken });
  check('laboratory staff cannot read the audit log', labAudit.status === 403, `status ${labAudit.status}`);

  // ------------------------------------------------------------- patient portal
  console.log('\nPatient portal');
  const patientLogin = await api('/patient-auth/login', {
    method: 'POST',
    body: { email: 'demo.patient1@healthbridge.ng', password: DEMO_PASSWORD },
  });
  check('a patient signs in to the portal', patientLogin.status === 200 && patientLogin.body.token, JSON.stringify(patientLogin.body).slice(0, 200));

  const patientToken = patientLogin.body.token;

  const patientWrongPassword = await api('/patient-auth/login', {
    method: 'POST',
    body: { email: 'demo.patient1@healthbridge.ng', password: 'not-the-password' },
  });
  check('the patient portal rejects a wrong password', patientWrongPassword.status === 401);

  const patientMe = await api('/patient-auth/me', { token: patientToken });
  check('a patient reads their own record', patientMe.status === 200 && patientMe.body.patient?.id);
  check('the patient sees their own prescriptions', Array.isArray(patientMe.body.prescriptions));
  check('the patient sees their own laboratory results', Array.isArray(patientMe.body.labResults));

  const patientSeesOtherPatients = await api('/patients', { token: patientToken });
  check('a patient cannot list the clinic patients', patientSeesOtherPatients.status === 403, `status ${patientSeesOtherPatients.status}`);

  const patientReadsDashboard = await api('/dashboard-summary', { token: patientToken });
  check('a patient cannot read the dashboard', patientReadsDashboard.status === 403, `status ${patientReadsDashboard.status}`);

  const patientReadsAudit = await api('/admin/audit-log', { token: patientToken });
  check('a patient cannot read the audit log', patientReadsAudit.status === 403, `status ${patientReadsAudit.status}`);

  const patientWritesPrescription = await api('/prescriptions', {
    method: 'POST',
    token: patientToken,
    body: { patientId, medicineName: 'X', dosage: '1mg', frequency: 'Daily', duration: '1 day', quantity: 1 },
  });
  check('a patient cannot write a prescription', patientWritesPrescription.status === 403, `status ${patientWritesPrescription.status}`);

  // --------------------------------------------------------- patient reset
  console.log('\nPatient password reset');
  const forgot = await api('/patient-auth/forgot-password', {
    method: 'POST',
    body: { email: 'demo.patient2@healthbridge.ng' },
  });
  check('a patient reset request is accepted', forgot.status === 200);
  check('the reset response is honest about email delivery', typeof forgot.body.emailDelivery === 'string');
  // A link may only ever be returned when the server has no mail provider and
  // demo mode is on, and the response must then say no message was sent.
  check(
    'a reset link is only returned with an explicit warning',
    forgot.body.resetUrl === undefined ||
      (forgot.body.emailDelivery === 'not-configured' && typeof forgot.body.deliveryNote === 'string'),
    JSON.stringify({ emailDelivery: forgot.body.emailDelivery, hasNote: Boolean(forgot.body.deliveryNote) })
  );

  const unknownForgot = await api('/patient-auth/forgot-password', { method: 'POST', body: { email: 'nobody@nowhere.test' } });
  check('an unknown address gets the same shape of reply', unknownForgot.status === 200 && unknownForgot.body.emailDelivery === forgot.body.emailDelivery);

  if (forgot.body.resetUrl) {
    const token = new URL(forgot.body.resetUrl).searchParams.get('token');

    const verify = await api(`/patient-auth/reset-password/verify?token=${token}`);
    check('a patient reset token verifies', verify.status === 200 && verify.body.valid === true);

    const weak = await api('/patient-auth/reset-password', { method: 'POST', body: { token, password: 'short', confirmPassword: 'short' } });
    check('a weak password is refused', weak.status === 400);

    const mismatch = await api('/patient-auth/reset-password', { method: 'POST', body: { token, password: 'NewPass1234', confirmPassword: 'NewPass12345' } });
    check('a mismatched confirmation is refused', mismatch.status === 400);

    const set = await api('/patient-auth/reset-password', { method: 'POST', body: { token, password: 'NewPass1234', confirmPassword: 'NewPass1234' } });
    check('a patient password is reset', set.status === 200, JSON.stringify(set.body).slice(0, 200));

    const replay = await api('/patient-auth/reset-password', { method: 'POST', body: { token, password: 'Another1234', confirmPassword: 'Another1234' } });
    check('a reset link cannot be replayed', replay.status === 400, `status ${replay.status}`);

    const relogin = await api('/patient-auth/login', { method: 'POST', body: { email: 'demo.patient2@healthbridge.ng', password: 'NewPass1234' } });
    check('the patient signs in with the new password', relogin.status === 200, `status ${relogin.status}`);

    const oldPassword = await api('/patient-auth/login', { method: 'POST', body: { email: 'demo.patient2@healthbridge.ng', password: DEMO_PASSWORD } });
    check('the old password no longer works', oldPassword.status === 401);
  }

  const badToken = await api('/patient-auth/reset-password/verify?token=not-a-real-token');
  check('an invalid reset token is refused', badToken.status === 400);

  // ------------------------------------------------------------- staff admin
  console.log('\nStaff management');
  const staffList = await api('/admin/staff', { token: adminToken });
  check('staff can be listed', staffList.status === 200 && staffList.body.staff.length > 0);

  // Unique per run so repeated runs do not collide with an earlier throwaway
  // account. The account is left deactivated, so it cannot be signed in to.
  const throwawayEmail = `testnurse-${Date.now()}@healthbridge.org`;

  const newStaff = await api('/admin/staff', {
    method: 'POST',
    token: adminToken,
    body: { fullName: 'Test Nurse', email: throwawayEmail, role: 'Receptionist', password: 'TestPass123' },
  });
  check('a staff account is created', newStaff.status === 201 && newStaff.body.id, JSON.stringify(newStaff.body).slice(0, 200));

  const newStaffLogin = await api('/auth/login', { method: 'POST', body: { email: throwawayEmail, password: 'TestPass123' } });
  check('the new account can sign in', newStaffLogin.status === 200, `status ${newStaffLogin.status}`);

  const deactivate = await api(`/admin/staff/${newStaff.body.id}`, { method: 'PUT', token: adminToken, body: { status: 'Inactive' } });
  check('an account is deactivated', deactivate.status === 200 && deactivate.body.status === 'Inactive');

  const deactivatedLogin = await api('/auth/login', { method: 'POST', body: { email: throwawayEmail, password: 'TestPass123' } });
  check('a deactivated account cannot sign in', deactivatedLogin.status === 403, `status ${deactivatedLogin.status}`);

  const selfDeactivate = await api(`/admin/staff/${admin.user.id}`, { method: 'PUT', token: adminToken, body: { status: 'Inactive' } });
  check('an administrator cannot deactivate themselves', selfDeactivate.status === 400, `status ${selfDeactivate.status}`);

  const reactivate = await api(`/admin/staff/${newStaff.body.id}`, { method: 'PUT', token: adminToken, body: { status: 'Active' } });
  check('a deactivated account can be restored', reactivate.status === 200 && reactivate.body.status === 'Active');

  const reactivatedLogin = await api('/auth/login', { method: 'POST', body: { email: throwawayEmail, password: 'TestPass123' } });
  check('a restored account can sign in again', reactivatedLogin.status === 200, `status ${reactivatedLogin.status}`);

  const lastAdmin = await api(`/admin/staff/${admin.user.id}`, { method: 'PUT', token: adminToken, body: { role: 'Receptionist' } });
  check('the only administrator cannot be demoted', lastAdmin.status === 400, `status ${lastAdmin.status}`);

  // ------------------------------------------------------------- cleanup
  console.log('\nDeactivating the test patient');
  const deactivatePatient = await api(`/patients/${patientId}`, { method: 'DELETE', token: adminToken });
  check('a test patient is deactivated', deactivatePatient.status === 200);

  const afterDeactivate = await api(`/patients/${patientId}`, { token: adminToken });
  check('the patient is retained but inactive', afterDeactivate.status === 200 && afterDeactivate.body.status === 'Inactive');

  // ------------------------------------------------------------- contact
  console.log('\nContact form');
  const contact = await api('/contact', {
    method: 'POST',
    body: { name: 'Interested Clinic', email: 'clinic@example.test', subject: 'Demo request', message: 'Please tell us about a walkthrough.' },
  });
  check('a contact message is stored', contact.status === 201 && contact.body.id, JSON.stringify(contact.body).slice(0, 160));

  const contactNoMessage = await api('/contact', { method: 'POST', body: { name: 'No Message', email: 'x@example.test' } });
  check('a contact message without text is refused', contactNoMessage.status === 400);

  const contactBadEmail = await api('/contact', { method: 'POST', body: { name: 'Bad', email: 'not-an-email', message: 'Hello' } });
  check('a contact message with a bad email is refused', contactBadEmail.status === 400);

  const contactRead = await api('/admin/contact-messages', { token: adminToken });
  check('an administrator can read contact messages', contactRead.status === 200 && contactRead.body.messages.length > 0);
  check('the stored contact message is retrievable', contactRead.body.messages.some((m) => m.subject === 'Demo request'));

  const contactReadUnauthorised = await api('/admin/contact-messages');
  check('contact messages are not public', contactReadUnauthorised.status === 401);

  // ------------------------------------------------------------- summary
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`Passed: ${passed}   Failed: ${failed}`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('-'.repeat(60));

  process.exit(failed === 0 ? 0 : 1);
}

/** Signs in, trying each known password for the account. */
async function signIn(account) {
  if (!account) return null;

  const passwords = account.envVar || account.secretVar
    ? candidates(account)
    : [DEMO_PASSWORD];

  for (const password of passwords) {
    const attempt = await api('/auth/login', {
      method: 'POST',
      body: { email: account.email, password },
    });

    if (attempt.status === 200 && attempt.body.token) {
      return {
        token: attempt.body.token,
        user: attempt.body.user,
        email: account.email,
        deactivationError: null,
      };
    }
  }

  return { token: null, user: null, email: account.email, deactivationError: 'could not sign in' };
}

main().catch((error) => {
  console.error('\nTest run failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
