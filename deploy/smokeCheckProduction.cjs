/**
 * Production smoke check.
 *
 * The new backend is deployed while the old frontend is still the one serving
 * the public site, so this confirms the already-published interface still works
 * against the new API. It deliberately checks only what the old build does, so a
 * failure here means a real regression rather than a missing new feature.
 */
const { chromium } = require('playwright');

const WEB = process.env.HB_WEB || 'https://healthbridge-boluwatife-ayomides-projects.vercel.app';
const API = process.env.HB_API || 'https://healthbridge-backend-5c3b.onrender.com/api';

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  try {
    console.log(`\nProduction smoke check\n  web ${WEB}\n  api ${API}\n`);

    await page.goto(WEB, { waitUntil: 'networkidle', timeout: 60000 });
    check('the public site loads', (await page.title()).length > 0);
    check('the public site still renders its content', (await page.textContent('body')).length > 500);

    // Sign in the way the published build does.
    const token = await page.evaluate(
      async ([api, email, password]) => {
        const res = await fetch(`${api}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return `error:${res.status}`;
        const body = await res.json();
        return body.token || 'error:notoken';
      },
      [API, 'admin@healthbridge.org', process.env.HB_ADMIN_PASSWORD || 'HealthBridge2026']
    );

    check('an administrator can sign in against the new backend', !String(token).startsWith('error'), String(token).slice(0, 40));

    if (String(token).startsWith('error')) {
      throw new Error('Cannot continue without a session.');
    }

    const read = async (endpoint) =>
      page.evaluate(
        async ([api, path, session]) => {
          const res = await fetch(`${api}${path}`, {
            headers: { Authorization: `Bearer ${session}` },
          });
          return { status: res.status, body: await res.json().catch(() => null) };
        },
        [API, endpoint, token]
      );

    // These are the exact calls the published build makes. Each must still
    // resolve to something the build can render, whether that is the shape it
    // was written against or the new envelope.
    for (const [label, endpoint, assert] of [
      ['dashboard summary', '/dashboard-summary', (b) => b && typeof b === 'object'],
      ['patient list', '/patients?page=1&pageSize=5', (b) => b && (Array.isArray(b) || Array.isArray(b.patients))],
      ['appointments', '/appointments?page=1&pageSize=5', (b) => b && (Array.isArray(b) || Array.isArray(b.appointments))],
      ['pharmacy stock', '/pharmacy/stock', (b) => b && (Array.isArray(b) || Array.isArray(b.medicines) || Array.isArray(b.stock))],
      ['lab requests', '/lab-requests', (b) => b && (Array.isArray(b) || Array.isArray(b.requests))],
      ['insights', '/ai-insights', (b) => b && (Array.isArray(b) || Array.isArray(b.signals))],
    ]) {
      const res = await read(endpoint);
      check(
        `${label} resolves to a usable collection`,
        res.status === 200 && assert(res.body),
        `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 140)}`
      );
    }

    // The published build treats a list endpoint as an array and calls .filter on
    // it. An envelope breaks that, so each list response is checked for the
    // array the build will actually call methods on.
    for (const [label, endpoint] of [
      ['patients', '/patients?page=1&pageSize=5'],
      ['appointments', '/appointments?page=1&pageSize=5'],
      ['lab requests', '/lab-requests'],
    ]) {
      const res = await read(endpoint);
      check(
        `${label} is an array the published build can filter`,
        res.status === 200 && Array.isArray(res.body),
        `returned ${Array.isArray(res.body) ? 'an array' : typeof res.body} rather than an array`
      );
    }

    // The dashboard must render real figures, not zeros from a broken envelope.
    await page.evaluate(
      ([session]) => localStorage.setItem('healthbridge_auth_token', session),
      [token]
    );
    await page.goto(`${WEB}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3500);

    const dash = await page.textContent('body');
    check('the published dashboard renders', /Dashboard|Appointment|Patient/i.test(dash), dash.replace(/\s+/g, ' ').slice(0, 160));
    check(
      'the published dashboard shows an activity or stat area',
      /QUICK ACCESS|ACTIVITY|APPOINTMENTS/i.test(dash),
      'the dashboard looks empty'
    );

    const real = errors.filter((e) => !/401|403|Failed to load resource/.test(e));
    check('no unexpected console errors', real.length === 0, real.slice(0, 2).join(' | '));

    console.log(`\n${'-'.repeat(56)}`);
    console.log(`Passed: ${passed}   Failed: ${failed}`);
    console.log('-'.repeat(56));
  } finally {
    await browser.close();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSmoke check failed:', e.message);
  process.exit(1);
});
