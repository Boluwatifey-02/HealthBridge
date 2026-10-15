/**
 * Screenshots the populated workspace so the rendered result can be inspected
 * rather than assumed from the API response.
 */
const path = require('path');
const { chromium } = require('playwright');

const WEB = process.env.HB_WEB || 'http://localhost:5173';
const API = process.env.HB_API || 'http://localhost:5050/api';
const OUT = path.resolve(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();

  for (const [label, width] of [['desktop', 1440], ['mobile', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();

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

    if (!token) {
      console.log(`${label}: could not sign in`);
      await context.close();
      continue;
    }

    await page.evaluate((t) => localStorage.setItem('healthbridge_auth_token', t), token);

    for (const [name, route] of [
      ['dashboard', '/dashboard'],
      ['patients', '/patients'],
      ['appointments', '/appointments'],
      ['pharmacy', '/pharmacy'],
      ['laboratory', '/laboratory'],
      ['clinical', '/clinical-care'],
    ]) {
      await page.goto(`${WEB}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3500);

      // Overflow is what broke the mobile header before, so it is measured
      // rather than eyeballed.
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      const file = path.join(OUT, `${label}-${name}.png`);
      await page.screenshot({ path: file, fullPage: false });

      const horizontal = overflow.scrollWidth > overflow.clientWidth + 1;
      console.log(
        `${label.padEnd(8)} ${name.padEnd(13)} ${horizontal ? 'HORIZONTAL OVERFLOW' : 'no overflow'} (${overflow.scrollWidth} vs ${overflow.clientWidth})`
      );
    }

    await context.close();
  }

  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
