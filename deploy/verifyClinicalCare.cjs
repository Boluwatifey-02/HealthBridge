/**
 * Walks the clinical care journey the way a clinician does: open Patient
 * Records, open a patient, then open Clinical Care, and confirms the existing
 * record is on screen and that saving a consultation updates it.
 */
const { chromium } = require('playwright');

const WEB = process.env.HB_WEB || 'http://localhost:5173';
const API = process.env.HB_API || 'http://localhost:5050/api';

let failures = 0;

function report(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });

  const token = await page.evaluate(
    async ([api]) => {
      const res = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@healthbridge.org', password: 'HealthBridge2026' }),
      });
      return res.ok ? (await res.json()).token : '';
    },
    [API]
  );

  if (!token) throw new Error('could not sign in');
  await page.evaluate((t) => localStorage.setItem('healthbridge_auth_token', t), token);

  // Open a patient from the list, the way a clinician would.
  await page.goto(`${WEB}/patients`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.patient-table-row', { timeout: 15000 });

  const firstRowText = (await page.textContent('.patient-table-row')).replace(/\s+/g, ' ');
  report('a patient row is listed', firstRowText.includes('HB-PAT'), firstRowText.slice(0, 70));

  await page.click('.patient-table-row');
  await page.waitForTimeout(1500);

  const detail = (await page.textContent('.patients-container')).replace(/\s+/g, ' ');
  report('the patient detail opens', /HB-PAT/.test(detail));
  report('the record shows recorded activity', /Recorded activity/.test(detail));

  const clinicalLink = await page.$('button:has-text("Clinical Care"), a:has-text("Clinical Care")');
  report('a Clinical Care control is offered', clinicalLink !== null);

  if (clinicalLink) {
    await clinicalLink.click();
    await page.waitForTimeout(2500);
  }

  const clinical = (await page.textContent('body')).replace(/\s+/g, ' ');

  report('the clinical page opens', /CLINICAL CARE/i.test(clinical));
  report('the existing record is shown', /Recorded encounters/i.test(clinical));
  report('a consultation count is shown', /consultation(s)? on file/i.test(clinical), (clinical.match(/\d+ consultations? on file/) || [''])[0]);

  const before = Number((clinical.match(/(\d+) consultations? on file/) || [0, 0])[1]);
  report('the patient already has recorded encounters', before > 0, `${before} on file`);

  report('the clinical detail is shown', /Presenting complaint:|Treatment:|Diagnosis/i.test(clinical));

  // Save a new consultation and confirm the list grows without a page reload.
  await page.fill('#complaint', 'Automated verification of the consultation record.');
  await page.fill('#diagnosis', 'Verification encounter recorded by the interface check');
  await page.fill('#treatment', 'No treatment required; record created to verify persistence.');
  await page.fill('#followUp', 'No follow-up required.');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);

  const after = Number(
    ((await page.textContent('body')).replace(/\s+/g, ' ').match(/(\d+) consultations? on file/) || [0, 0])[1]
  );

  report('saving adds the encounter to the visible record', after === before + 1, `${before} then ${after}`);
  report('the save is confirmed', /Consultation saved/i.test(await page.textContent('body')));

  // Persistence across a reload.
  await page.goto(`${WEB}/patients`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.patient-table-row', { timeout: 15000 });
  await page.click('.patient-table-row');
  await page.waitForTimeout(1500);

  const reloadLink = await page.$('button:has-text("Clinical Care"), a:has-text("Clinical Care")');
  if (reloadLink) {
    await reloadLink.click();
    await page.waitForTimeout(2500);
  }

  const reloaded = (await page.textContent('body')).replace(/\s+/g, ' ');
  report(
    'the saved consultation survives a reload',
    /Verification encounter recorded by the interface check/.test(reloaded)
  );

  await browser.close();
  console.log(`\n${failures === 0 ? 'Clinical care journey verified.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
