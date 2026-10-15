/**
 * Reads what each page actually renders and checks it against the database, so
 * "the page is populated" is verified from the text a person would see rather
 * than from the API response alone.
 */
const { chromium } = require('playwright');

const WEB = process.env.HB_WEB || 'http://localhost:5173';
const API = process.env.HB_API || 'http://localhost:5050/api';
const PASSWORD = 'HealthBridge2026';

const PAGES = [
  ['Dashboard', '/dashboard'],
  ['Patient Records', '/patients'],
  ['Appointments', '/appointments'],
  ['Pharmacy', '/pharmacy'],
  ['Laboratory', '/laboratory'],
  ['Clinical Care', '/clinical-care'],
  ['AI Insights', '/ai-insights'],
  ['Security & Privacy', '/security'],
];

async function apiGet(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let failures = 0;

function report(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });

  const token = await page.evaluate(
    async ([api, password]) => {
      const res = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@healthbridge.org', password }),
      });
      return res.ok ? (await res.json()).token : '';
    },
    [API, PASSWORD]
  );

  if (!token) throw new Error('could not sign in');
  await page.evaluate((t) => localStorage.setItem('healthbridge_auth_token', t), token);

  // The figures the interface shows must match what the database holds.
  const patients = await apiGet('/patients?format=envelope&pageSize=1', token);
  const summary = await apiGet('/dashboard-summary', token);
  const pharmacy = await apiGet('/pharmacy?format=envelope', token);
  const labs = await apiGet('/lab-requests?format=envelope&pageSize=1', token);

  const counts = {
    patients: patients.body.total,
    activePatients: summary.body.totals?.totalPatients,
    appointmentsToday: summary.body.today?.appointmentsToday,
    medicines: pharmacy.body.medicines?.length,
    labRequests: labs.body.total,
  };

  console.log('\nDatabase totals reported by the API:');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));

  console.log('\nRendered content:');

  for (const [name, route] of PAGES) {
    await page.goto(`${WEB}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3200);
    const text = (await page.textContent('body')).replace(/\s+/g, ' ');

    const emptyish =
      /No patients found|No medicines match|No laboratory requests match|No appointments found|Unable to load/i.test(text);

    // The pages present their records as table rows or as cards depending on the
    // screen, so both are counted rather than assuming a markup shape.
    const rowCount = await page.$$eval('table tbody tr', (rows) => rows.length).catch(() => 0);
    const itemCount = await page
      .$$eval(
        '.patient-table-row, .pharmacy-table-row, .lab-request-row, .appointment-card, .medicine-card, li.patient-row',
        (nodes) => nodes.length
      )
      .catch(() => 0);
    const shown = Math.max(rowCount, itemCount);

    console.log(`\n${name} (${route})`);
    report('  page renders content', text.length > 300, `${text.length} chars`);
    report('  not showing an empty state', !emptyish, emptyish ? 'empty-state message found' : '');
    report('  renders record rows', shown > 0, `${shown} rows/cards (tables ${rowCount}, cards ${itemCount})`);

    console.log(`  text: ${text.slice(0, 220)}`);
  }

  // The dashboard must show the real patient count, not zero.
  await page.goto(`${WEB}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  const dashText = (await page.textContent('body')).replace(/\s+/g, ' ');
  const shownPatients = dashText.match(/Active patients\s*([\d,]+)/);

  report(
    'dashboard shows the real active patient count',
    shownPatients && Number(shownPatients[1].replace(/,/g, '')) === counts.activePatients,
    `page shows "${shownPatients ? shownPatients[1] : 'not found'}", database has ${counts.activePatients}`
  );
  report('dashboard does not show zero patients', !/Active patients\s*0\b/.test(dashText));

  const shownAppointments = dashText.match(/Appointments today\s*([\d,]+)/);
  report(
    'dashboard shows the real appointment count',
    shownAppointments && Number(shownAppointments[1].replace(/,/g, '')) === counts.appointmentsToday,
    `page shows "${shownAppointments ? shownAppointments[1] : 'not found'}", database has ${counts.appointmentsToday}`
  );

  await browser.close();

  console.log(`\n${failures === 0 ? 'All rendered-content checks passed.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
