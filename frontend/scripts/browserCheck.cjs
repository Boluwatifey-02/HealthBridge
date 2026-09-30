const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.HB_WEB || 'http://localhost:5173';
const API = process.env.HB_API || 'http://localhost:5050/api';
const DEMO_PASSWORD = 'HealthBridge2026';

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

/**
 * Candidate passwords for an account, in the order they are tried.
 *
 * An account that predates the demonstration seed keeps whatever password it was
 * originally given, so a real deployment's credentials are never silently
 * replaced with the documented demonstration password. The first candidate that
 * authenticates is the one used for the rest of the run.
 */
const PASSWORD_CANDIDATES = [
  process.env.HB_ADMIN_PASSWORD,
  SECRETS.GENERATED_SEED_ADMIN_PASSWORD,
  DEMO_PASSWORD,
].filter(Boolean);

async function signInStaff(page, email) {
  for (const password of PASSWORD_CANDIDATES) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL('**/dashboard', { timeout: 8000 });
      return await page.evaluate(() => localStorage.getItem('healthbridge_auth_token'));
    } catch {
      await page.waitForTimeout(600);
    }
  }

  return null;
}

/**
 * Drives the real interface rather than the API, so it catches the problems only
 * a browser can show: a page that renders a blank shell, a control that does
 * nothing, or a table fed by a response shape the client does not expect.
 */
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    // -------------------------------------------------------- landing page
    console.log('\nLanding page');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    check('the landing page loads', (await page.title()).length > 0);

    const bodyText = await page.textContent('body');

    check(
      'no fabricated patient count is shown',
      !/\b100\b\s*Registered Patients/.test(bodyText),
      'found the old invented hero stat'
    );
    check(
      'no invented follow-up percentage is shown',
      !/94%/.test(bodyText),
      'found the old invented care follow-up figure'
    );
    check(
      'no invented chart growth figure is shown',
      !/\+18\.4%/.test(bodyText),
      'found the old invented growth figure'
    );
    check(
      'no fabricated testimonials remain',
      !/Healthcare Administrator/.test(bodyText) && !/Medical Officer/.test(bodyText),
      'found the old invented testimonial attributions'
    );
    check(
      'no invented contact phone number is shown',
      !/\+234 800 000 0000/.test(bodyText),
      'found the old placeholder phone number'
    );
    check(
      'the page describes real capabilities',
      /Role-based access|Audit logged|audit trail/i.test(bodyText)
    );
    check('a patient portal link is offered', /Patient portal/i.test(bodyText));

    // Every service card must lead somewhere real. A card that looks clickable
    // but does nothing is worse than no card.
    const serviceLinks = await page.$$eval('.service-card', (nodes) =>
      nodes.map((node) => node.getAttribute('href'))
    );
    check(
      'every service card links to a real page',
      serviceLinks.length === 4 && serviceLinks.every((href) => href && href.startsWith('/')),
      JSON.stringify(serviceLinks)
    );
    check(
      'service cards are real links, so they can be opened in a new tab',
      (await page.$$('.service-card[href]')).length === 4,
      'a service card is not an anchor'
    );

    const destination = serviceLinks[0];
    await page.goto(`${BASE}${destination}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const landingToStaff = await page.textContent('body');
    check(
      'a service card reached from the landing page opens its page or asks for sign-in',
      (await page.$('input[name="password"]')) !== null || /Patient Records/i.test(landingToStaff),
      `service card went to ${destination} and showed neither the page nor a sign-in`
    );
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // --------------------------------------------------------- contact form
    console.log('\nContact form');
    const subject = `Playwright check ${Date.now()}`;
    await page.fill('input[name="name"]', 'Playwright Tester');
    await page.fill('input[name="email"]', 'playwright@example.test');
    await page.fill('input[name="subject"]', subject);
    await page.fill('textarea[name="message"]', 'Submitted from an automated browser check.');
    await page.click('button[type="submit"]');

    const confirmed = await page
      .waitForSelector('.contact-form-success', { timeout: 10000 })
      .catch(() => null);

    if (confirmed) {
      const successText = await page.textContent('.contact-form-success');
      check(
        'the contact form confirms a real submission',
        /recorded/i.test(successText),
        successText?.trim()
      );
    } else {
      // A rate limit here means the limiter is doing its job, but the run still
      // needs a submission to verify, so the reason is reported plainly.
      const formError = await page.textContent('.contact-form-error').catch(() => null);
      check(
        'the contact form confirms a real submission',
        false,
        formError?.trim() || 'no confirmation or error message appeared'
      );
    }

    // ------------------------------------------------------------ staff sign-in
    console.log('\nStaff sign-in');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

    const staffToken = await signInStaff(page, 'admin@healthbridge.org');
    check('an administrator reaches the dashboard', Boolean(staffToken), page.url());

    if (!staffToken) {
      throw new Error('Cannot continue the interface check without an administrator session.');
    }

    // -------------------------------------------------------------- dashboard
    console.log('\nDashboard');
    await page.waitForSelector('.dashboard-stat-card', { timeout: 15000 });
    const dashText = await page.textContent('.dashboard-container');

    check('the dashboard shows a real patient count', /Active patients/.test(dashText));
    check('the dashboard shows today\'s appointments', /Appointments today/.test(dashText));
    check('the dashboard shows a real activity feed', /AUDIT TRAIL/.test(dashText));
    const expectedGreeting =
      new Date().getHours() < 12
        ? 'Good morning'
        : new Date().getHours() < 18
          ? 'Good afternoon'
          : 'Good evening';

    check(
      `the dashboard greets the signed-in user by name (${expectedGreeting})`,
      dashText.includes(`${expectedGreeting},`),
      'greeting did not include a name'
    );
    check(
      'the greeting is derived from the current time, not hard-coded',
      ['Good morning,', 'Good afternoon,', 'Good evening,'].filter((g) => dashText.includes(g)).length === 1,
      'zero or more than one time-of-day greeting found'
    );
    check(
      'the dashboard shows the role in use',
      /Signed in as Administrator/.test(dashText),
      'role is not shown'
    );

    // The dashboard must be showing numbers from the API, not placeholders. The
    // cards are rendered while loading with an em dash, so the run waits for real
    // values rather than accepting the placeholder.
    await page
      .waitForFunction(
        () => {
          const nodes = document.querySelectorAll('.dashboard-stat-card strong');
          return nodes.length > 0 && [...nodes].every((n) => /^[\d][\d,]*$/.test(n.textContent.trim()));
        },
        { timeout: 15000 }
      )
      .catch(() => null);

    const statValues = await page.$$eval('.dashboard-stat-card strong', (nodes) =>
      nodes.map((node) => node.textContent.trim())
    );
    check(
      'dashboard figures are numeric',
      statValues.every((value) => /^\d[\d,]*$/.test(value)),
      statValues.join(' | ')
    );
    check(
      'the patient count is not a placeholder zero',
      Number(String(statValues[0]).replace(/,/g, '')) > 0,
      `first figure was ${statValues[0]}`
    );

    // --------------------------------------------------------------- patients
    console.log('\nPatient records');
    await page.click('text=Patient Records');
    await page.waitForURL('**/patients', { timeout: 15000 });
    await page.waitForSelector('.patient-table-row', { timeout: 15000 });

    const patientRows = await page.$$('.patient-table-row');
    check('patient records are listed', patientRows.length > 0, `${patientRows.length} rows`);
    check(
      'patient rows show a real patient id',
      (await page.textContent('.patient-table-row')).includes('HB-PAT'),
      'no HealthBridge patient id in the first row'
    );

    // Search
    await page.fill('input[type="search"]', 'Demo');
    await page.waitForTimeout(400);
    const searched = await page.$$('.patient-table-row');
    check('search narrows the list', searched.length > 0 && searched.length <= patientRows.length);

    await page.fill('input[type="search"]', 'zzzzzz-no-such-patient');
    await page.waitForTimeout(400);
    const emptyText = await page.textContent('.patients-table');
    check('a search with no matches says so', /No patients found/i.test(emptyText));

    await page.fill('input[type="search"]', '');
    await page.waitForTimeout(400);

    // Patient detail and the consultation count that used to be hard-coded to 3.
    await page.click('.patient-table-row');
    await page.waitForSelector('.patient-history-card', { timeout: 15000 });
    await page.waitForTimeout(1200);

    const detailText = await page.textContent('.patients-container');
    check('the patient detail page opens', /PATIENT/.test(detailText));
    check(
      'the recorded activity card is present',
      /Recorded activity/.test(detailText),
      'no recorded activity card'
    );
    check(
      'the consultation count comes from the database',
      /Consultations/.test(detailText) && /\(\d+ with a\s*diagnosis\)/.test(detailText.replace(/\s+/g, ' ')),
      'consultation count not shown as a real figure'
    );

    // ------------------------------------------------------------ appointments
    console.log('\nAppointments');
    await page.goto(`${BASE}/appointments`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const apptText = await page.textContent('body');
    check('the appointments page renders', /Appointment/i.test(apptText));
    check(
      'no invented department is displayed',
      !/Clinical Care/.test(apptText),
      'found the old hard-coded department'
    );

    // --------------------------------------------------------------- pharmacy
    console.log('\nPharmacy');
    await page.goto(`${BASE}/pharmacy`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const pharmacyText = await page.textContent('body');
    check('the pharmacy page renders', /Pharmacy|Medicine|Inventory/i.test(pharmacyText));
    check(
      'the pharmacy lists real inventory',
      !/Unable to load pharmacy inventory/i.test(pharmacyText),
      'inventory failed to load'
    );

    // ------------------------------------------------------------ laboratory
    console.log('\nLaboratory');
    await page.goto(`${BASE}/laboratory`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const labText = await page.textContent('body');
    check('the laboratory page renders', /Laborator|Test|Request/i.test(labText));
    check(
      'the laboratory list is not empty',
      !/No lab requests|Unable to load/i.test(labText),
      'laboratory list did not load'
    );

    // --------------------------------------------------------------- insights
    console.log('\nRecord insights');
    await page.goto(`${BASE}/ai-insights`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const insightText = await page.textContent('body');
    check('the insights page renders', /Record Insights|needs attention/i.test(insightText));
    check(
      'the insights page states its method',
      /rule-based|Rule-based/i.test(insightText),
      'the method is not stated'
    );
    check(
      'the insights page is not labelled as AI',
      !/AI Health Insights/.test(insightText),
      'still branded as AI'
    );

    const expand = await page.$('.ai-insight-action');
    if (expand) {
      await expand.click();
      await page.waitForTimeout(500);
      const expandedText = await page.textContent('body');
      check(
        'an insight can be expanded to the records behind it',
        /Records behind this count/i.test(expandedText),
        'expanding showed no records'
      );
    } else {
      check('an insight can be expanded to the records behind it', false, 'no expandable insight found');
    }

    // --------------------------------------------------------------- security
    console.log('\nSecurity page');
    await page.goto(`${BASE}/security`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const securityText = await page.textContent('body');
    check('the security page renders', /Security|privacy/i.test(securityText));
    check(
      'no AES-256 claim is made',
      !/AES-256/.test(securityText),
      'found the old encryption claim'
    );
    check(
      'no multi-factor authentication claim is made',
      !/Multi-factor authentication is (enabled|supported|active)/i.test(securityText),
      'found the old MFA claim'
    );
    check(
      'no compliance certification is claimed',
      !/HIPAA compliant|GDPR compliant|NIST compliant/i.test(securityText),
      'found the old compliance claim'
    );
    check(
      'gaps are stated honestly',
      /Not currently implemented/i.test(securityText),
      'no limitations section'
    );

    // ----------------------------------------------------------- patient portal
    console.log('\nPatient portal');
    await page.goto(`${BASE}/patient-portal`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'demo.patient1@healthbridge.ng');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1200);
    const rejectedText = await page.textContent('body');
    check(
      'the patient portal rejects a wrong password',
      /Incorrect email or password/i.test(rejectedText),
      'no rejection message shown'
    );

    // demo.patient2 had its password changed by the API suite, so patient1 is
    // the account used here and the demo password still applies.
    await page.fill('input[name="email"]', 'demo.patient1@healthbridge.ng');
    await page.fill('input[name="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/patient-portal', { timeout: 15000 });
    check('a patient reaches their own record', page.url().includes('/patient-portal'));

    await page.waitForSelector('.dashboard-stat-card', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const portalText = await page.textContent('.dashboard-container');

    check('the portal greets the patient by name', /Hello,/.test(portalText));
    check('the portal shows their appointments', /Your appointments/.test(portalText));
    check('the portal shows their prescriptions', /Your prescriptions/.test(portalText));
    check('the portal shows lab results', /Test results/.test(portalText));
    check(
      'the portal shows details the clinic holds',
      /Details the clinic holds/.test(portalText)
    );
    check(
      'the portal shows its own sections rather than the staff workspace',
      /Your appointments/.test(portalText) && /Your prescriptions/.test(portalText),
      'expected the patient sections'
    );
    check(
      'the portal does not leak the staff audit trail',
      !/AUDIT TRAIL/.test(portalText),
      'staff activity feed appeared in the patient portal'
    );
    check(
      'the portal does not leak the staff quick-access panel',
      !/QUICK ACCESS/.test(portalText),
      'staff quick access appeared in the patient portal'
    );

    // A patient must not be able to open a staff page with their session.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const blockedText = await page.textContent('body');
    check(
      'a patient session cannot open the staff dashboard',
      !/AUDIT TRAIL/.test(blockedText) && (await page.$('input[name="password"]')) !== null,
      'the staff dashboard rendered for a patient'
    );

    // Signing in as a patient must also end any staff session in this browser,
    // so the staff workspace is not left reachable behind the portal.
    check(
      'signing in as a patient cleared the staff session',
      await page.evaluate(() => !localStorage.getItem('healthbridge_auth_token')),
      'a staff token survived the patient sign-in'
    );

    // ------------------------------------------------------------ sign out
    await page.goto(`${BASE}/patient-portal`, { waitUntil: 'networkidle' });
    const signOut = await page
      .waitForSelector('button:has-text("Sign out")', { timeout: 10000 })
      .catch(() => null);

    if (signOut) {
      await signOut.click();
      await page
        .waitForSelector('input[name="password"]', { timeout: 10000 })
        .catch(() => null);
      check(
        'signing out returns to the portal sign-in',
        (await page.$('input[name="password"]')) !== null,
        `still on ${page.url()}`
      );
      check(
        'signing out removes the patient session',
        await page.evaluate(() => !localStorage.getItem('healthbridge_patient_token')),
        'a patient token survived sign-out'
      );
    } else {
      check('signing out returns to the portal sign-in', false, 'no sign out button found');
    }

    // ------------------------------------------------- patient password reset
    // A temporary patient is used so the demonstration accounts keep the
    // passwords the rest of the suite relies on. There is no public patient
    // sign-up, so the record is created by staff through the real API.
    console.log('\nPatient password reset');

    const tempEmail = `reset.check.${Date.now()}@healthbridge.test`;

    const created = await page.evaluate(
      async ([api, email, token]) => {
        const response = await fetch(`${api}/patients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: 'Reset Check',
            email,
            phone: '+2348000000001',
            dateOfBirth: '1990-04-12',
            gender: 'female',
            address: '1 Test Close',
          }),
        });

        return { status: response.status, body: await response.json().catch(() => ({})) };
      },
      [API, tempEmail, staffToken]
    );

    check(
      'a temporary patient can be registered for the reset check',
      created.status === 201 || created.status === 200,
      `status ${created.status} ${JSON.stringify(created.body).slice(0, 160)}`
    );

    // The reset link is captured from the API response, because the deployment
    // has no mail provider configured to deliver it.
    await page.goto(`${BASE}/patient-forgot-password`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', tempEmail);
    await page.click('button[type="submit"]');
    await page.waitForSelector('p[role="status"], .forgot-password-note, p', { timeout: 10000 });
    await page.waitForTimeout(800);

    const forgotText = await page.textContent('body');
    check(
      'the forgot-password form confirms the request',
      /recorded|received|check your email|If an account/i.test(forgotText),
      forgotText.replace(/\s+/g, ' ').slice(0, 200)
    );

    const resetLink = await page.evaluate(
      async ([api, email]) => {
        const response = await fetch(`${api}/patient-auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const body = await response.json().catch(() => ({}));
        return body.resetUrl || body.resetLink || body.devLink || '';
      },
      [API, tempEmail]
    );

    check('a reset link is produced for a real account', Boolean(resetLink), String(resetLink).slice(0, 80));

    if (resetLink) {
      // The link points at the deployed front end, so only its token is used.
      const resetUrl = `${BASE}/patient-reset-password?token=${new URL(resetLink).searchParams.get('token')}`;

      await page.goto(resetUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const resetText = await page.textContent('body');
      check(
        'the reset page accepts a valid token',
        !/invalid or has expired|not valid/i.test(resetText),
        resetText.replace(/\s+/g, ' ').slice(0, 200)
      );

      const newPassword = 'ResetCheck2026abc';
      await page.fill('input[name="newPassword"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      const afterResetText = await page.textContent('body');
      check(
        'the password is changed through the interface',
        /updated|changed|sign in/i.test(afterResetText),
        afterResetText.replace(/\s+/g, ' ').slice(0, 200)
      );

      // The single-use token must not work a second time.
      await page.goto(resetUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const replayText = await page.textContent('body');
      check(
        'the reset link cannot be used a second time',
        /invalid or has expired|no longer valid|already been used/i.test(replayText),
        replayText.replace(/\s+/g, ' ').slice(0, 200)
      );

      // The new password must actually work.
      await page.goto(`${BASE}/patient-portal`, { waitUntil: 'networkidle' });
      await page.fill('input[name="email"]', tempEmail);
      await page.fill('input[name="password"]', newPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);

      const newPasswordText = await page.textContent('body');
      check(
        'the patient can sign in with the new password',
        /Hello, Reset/.test(newPasswordText),
        newPasswordText.replace(/\s+/g, ' ').slice(0, 200)
      );
    }

    // The temporary patient is removed straight from the database, because the
    // public API deliberately offers no way to delete a patient record.
    try {
      const { query, initializeDatabase } = require(
        path.resolve(__dirname, '..', '..', 'backend', 'config', 'db.js')
      );
      await initializeDatabase();
      await query('DELETE FROM patients WHERE email = ?', [tempEmail]);
      check('the temporary patient was removed', true);
    } catch (error) {
      check(
        'the temporary patient was removed',
        false,
        `could not clean up ${tempEmail}: ${error.message}`
      );
    }

    // -------------------------------------------------------------- summary
    const realErrors = consoleErrors.filter(
      (message) => !/401|403|Failed to load resource/.test(message)
    );
    check(
      'no unexpected console errors occurred',
      realErrors.length === 0,
      realErrors.slice(0, 3).join(' | ')
    );

    // A refused sign-in and a deliberately replayed reset token are both
    // expected rejections, so they are not counted as unexpected failures.
    const EXPECTED_REJECTIONS =
      /\/api\/auth\/login|patient-auth\/login|patient-auth\/reset-password\/(verify|reset)/;

    const realFailures = failedRequests.filter((entry) => !EXPECTED_REJECTIONS.test(entry));
    check(
      'no unexpected failed requests occurred',
      realFailures.length === 0,
      realFailures.slice(0, 3).join(' | ')
    );

    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Passed: ${passed}   Failed: ${failed}`);
    if (failures.length) {
      console.log('\nFailures:');
      failures.forEach((f) => console.log(`  - ${f}`));
    }
    console.log('-'.repeat(60));
  } finally {
    await browser.close();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nBrowser check failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
