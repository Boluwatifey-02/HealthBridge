const API = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

let failures = 0;
function assert(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
    failures += 1;
  }
}

async function main() {
  console.log('\n=== AUTHENTICATION ===');
  const accounts = [
    { email: 'admin@healthbridge.org', password: 'HealthBridge2026', role: 'Administrator' },
    { email: 'doctor@healthbridge.org', password: 'HealthBridge2026', role: 'Doctor' },
    { email: 'reception@healthbridge.org', password: 'HealthBridge2026', role: 'Receptionist' },
    { email: 'pharmacist@healthbridge.org', password: 'HealthBridge2026', role: 'Pharmacist' },
    { email: 'lab@healthbridge.org', password: 'HealthBridge2026', role: 'Laboratory Staff' },
  ];

  const tokens = [];
  for (const acc of accounts) {
    const r = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: acc.email, password: acc.password }),
    });
    assert(`${acc.role} login`, r.status === 200 && r.data.token, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
    tokens.push(r.data.token);
  }

  const adminToken = tokens[0];

  console.log('\n=== INVALID LOGIN ===');
  const bad = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@healthbridge.org', password: 'wrong' }),
  });
  assert('Wrong password rejected', bad.status === 401);

  const bad2 = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' }),
  });
  assert('Unknown email rejected', bad2.status === 401);

  console.log('\n=== DASHBOARD ===');
  const dash = await request('/dashboard-summary', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Dashboard returns 200', dash.status === 200);
  assert('Dashboard has totals', dash.data.totals?.totalPatients > 0, `patients: ${dash.data.totals?.totalPatients}`);
  assert('Dashboard has appointments', dash.data.totals?.appointments > 0, `appointments: ${dash.data.totals?.appointments}`);
  assert('Dashboard has low stock', dash.data.totals?.lowStockItems >= 0);
  assert('Dashboard has pending labs', dash.data.totals?.pendingLabRequests >= 0);
  assert('Dashboard has today count', dash.data.today?.appointmentsToday >= 0);
  assert('Dashboard has recent activity', Array.isArray(dash.data.recentActivity));
  assert('Dashboard has inventory attention', Array.isArray(dash.data.inventoryAttention));

  console.log('\n=== PATIENTS ===');
  const patients = await request('/patients?format=envelope&pageSize=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Patients list returns envelope', patients.status === 200 && Array.isArray(patients.data.patients));
  assert('Patients list has records', patients.data.patients.length > 0, `count: ${patients.data.patients.length}`);
  assert('Patients list has total', typeof patients.data.total === 'number' && patients.data.total > 0);

  const firstPatientId = patients.data.patients[0]?.id;
  if (firstPatientId) {
    const detail = await request(`/patients/${encodeURIComponent(firstPatientId)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('Patient detail loads', detail.status === 200 && detail.data.id === firstPatientId);

    const timeline = await request(`/patients/${encodeURIComponent(firstPatientId)}/timeline`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('Patient timeline loads', timeline.status === 200 && timeline.data.patient);
  }

  console.log('\n=== REGISTRATION ===');
  const newPatient = await request('/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      fullName: 'Demo Test Patient',
      age: 30,
      gender: 'Male',
      phone: '+234 801 000 0001',
      address: '1 Test Street, Lagos',
      condition: 'Routine check',
      status: 'Active',
    }),
  });
  assert('Patient registration works', newPatient.status === 201 && newPatient.data.id, newPatient.data.message || JSON.stringify(newPatient.data).slice(0, 100));

  console.log('\n=== APPOINTMENTS ===');
  const appts = await request('/appointments?format=envelope&pageSize=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Appointments list loads', appts.status === 200 && Array.isArray(appts.appointments || appts.data?.appointments));
  const apptList = appts.data?.appointments || appts.appointments || [];
  assert('Appointments have records', apptList.length > 0, `count: ${apptList.length}`);

  if (firstPatientId) {
    const createdAppt = await request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        patientId: firstPatientId,
        date: '2026-10-20',
        time: '10:00:00',
        reason: 'Follow-up review',
        status: 'Scheduled',
        provider: 'Dr. Ngozi Eze',
      }),
    });
    assert('Appointment creation works', createdAppt.status === 201 && createdAppt.data.id, createdAppt.data.message || JSON.stringify(createdAppt.data).slice(0, 100));
  }

  console.log('\n=== CONSULTATIONS ===');
  const consults = await request('/consultations?format=envelope&pageSize=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Consultations list loads', consults.status === 200);

  console.log('\n=== PHARMACY ===');
  const pharmacy = await request('/pharmacy?format=envelope', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Pharmacy loads', pharmacy.status === 200 && Array.isArray(pharmacy.data.medicines));
  assert('Pharmacy has medicines', pharmacy.data.medicines.length > 0, `count: ${pharmacy.data.medicines.length}`);

  console.log('\n=== LABORATORY ===');
  const labs = await request('/lab-requests?format=envelope&pageSize=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Lab requests load', labs.status === 200 && Array.isArray(labs.data.requests));
  assert('Lab has requests', labs.data.requests.length > 0, `count: ${labs.data.requests.length}`);

  console.log('\n=== AI INSIGHTS ===');
  const insights = await request('/ai-insights', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('AI insights loads', insights.status === 200 && Array.isArray(insights.data.signals));
  assert('AI insights has signals', insights.data.signals.length > 0);

  console.log('\n=== PATIENT PORTAL ===');
  const patientLogin = await request('/patient-auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'demo.patient1@healthbridge.ng', password: 'HealthBridge2026' }),
  });
  assert('Patient login works', patientLogin.status === 200 && patientLogin.data.token);
  const patientToken = patientLogin.data.token;

  const myRecord = await request('/patient-auth/me', {
    headers: { Authorization: `Bearer ${patientToken}` },
  });
  assert('Patient record loads', myRecord.status === 200 && myRecord.data.patient);

  console.log('\n=== PASSWORD RESET ===');
  const forgot = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@healthbridge.org' }),
  });
  assert('Forgot password returns response', forgot.status === 200 && forgot.data.message);

  console.log('\n=== AUDIT / STAFF ===');
  const staff = await request('/admin/staff', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Staff list loads', staff.status === 200);

  console.log('\n=== CONTACT ===');
  const contact = await request('/contact', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', email: 'test@test.com', subject: 'Test', message: 'Hello' }),
  });
  assert('Contact form works', contact.status === 201);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
