/**
 * Builds the frontend and deploys it to Vercel as a production deployment.
 *
 * The project is linked to a GitHub repository whose Vercel "production branch"
 * is `main` while this project ships from `master`, so a plain `git push`
 * only produces a preview build. This script deploys explicitly and, crucially,
 * verifies the built bundle before it moves the stable alias onto it.
 *
 * A bundle that is missing VITE_API_URL falls back to the relative path "/api",
 * which Vercel cannot serve. Promoting such a build takes the whole site down,
 * so the alias is only reassigned after the checks below pass.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const DIST = path.join(FRONTEND, 'dist');
const PROJECT = process.env.VERCEL_PROJECT_ID || 'prj_uX76lUY5UYv2tA0V5JTuXvGUBy9l';
const NAME = 'healthbridge';

const ALIASES = [
  process.env.VERCEL_STABLE_ALIAS || 'healthbridge-boluwatife-ayomides-projects.vercel.app',
  process.env.VERCEL_SECONDARY_ALIAS || 'healthbridge-seven-eosin.vercel.app',
];

const EXPECTED_API = process.env.VITE_API_URL || 'https://healthbridge-backend-5c3b.onrender.com/api';

const GITHUB_ORG = process.env.VERCEL_GITHUB_ORG || 'Boluwatifey-02';
const GITHUB_REPO = process.env.VERCEL_GITHUB_REPO || 'HealthBridge';
const GITHUB_REPO_ID = Number(process.env.VERCEL_GITHUB_REPO_ID || 1384621805);
const GITHUB_REF = process.env.VERCEL_GIT_REF || 'master';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readVercelToken() {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'com.vercel.cli', 'Data', 'auth.json'),
    path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed.token) return parsed.token;
    } catch { /* ignore malformed auth files */ }
  }
  throw new Error('No Vercel token found. Run `vercel login` first.');
}

async function main() {
  const token = readVercelToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('1/4  building frontend locally as a compile check');
  // npm.cmd is a Windows batch shim, so it has to go through a shell.
  execFileSync('npm.cmd', ['run', 'build'], { cwd: FRONTEND, stdio: 'inherit', shell: true });

  if (!fs.existsSync(DIST)) {
    throw new Error('Build produced no dist directory.');
  }

  console.log('2/4  requesting a production build from git');
  const created = await fetch(
    `https://api.vercel.com/v13/deployments?projectId=${PROJECT}&name=${NAME}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: NAME,
        target: 'production',
        gitSource: {
          type: 'github',
          org: GITHUB_ORG,
          repo: GITHUB_REPO,
          repoId: GITHUB_REPO_ID,
          ref: GITHUB_REF,
        },
      }),
    }
  );
  const deploy = await created.json();
  if (created.status >= 300 || !deploy.uid) {
    throw new Error(`Vercel rejected the deployment (HTTP ${created.status}): ${JSON.stringify(deploy).slice(0, 300)}`);
  }
  console.log(`     deployment ${deploy.uid}`);

  console.log('3/4  waiting for build');
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(5000);
    const res = await fetch(`https://api.vercel.com/v13/deployments/${deploy.uid}`, { headers });
    const info = await res.json();
    const state = info.state || info.readyState;
    if (state === 'READY') { ready = true; break; }
    if (state === 'ERROR' || state === 'CANCELED') {
      throw new Error(`Build finished in state ${state}.`);
    }
  }
  if (!ready) throw new Error('Build did not finish in time. Alias left unchanged.');

  console.log('4/4  verifying the built bundle');
  const html = await (await fetch(`https://${deploy.url}`)).text();
  const jsRef = [...html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.js/g)][0];
  const cssRef = [...html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.css/g)][0];
  if (!jsRef) throw new Error('Built page references no JavaScript bundle. Alias left unchanged.');

  const js = await (await fetch(`https://${deploy.url}${jsRef[0]}`)).text();
  const css = cssRef ? await (await fetch(`https://${deploy.url}${cssRef[0]}`)).text() : '';

  const checks = [
    ['bundle targets the live backend', js.includes(EXPECTED_API)],
    ['bundle has no localhost API base', !/`https?:\/\/localhost/.test(js)],
    ['responsive header rules are bundled', /flex-wrap:wrap/.test(css)],
  ];
  for (const [label, ok] of checks) {
    console.log(`     ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  }
  if (checks.some(([, ok]) => !ok)) {
    throw new Error('Verification failed, so the stable alias was left on the previous deployment.');
  }

  for (const alias of ALIASES) {
    const res = await fetch(
      `https://api.vercel.com/v4/deployments/${deploy.uid}/aliases?projectId=${PROJECT}`,
      { method: 'POST', headers, body: JSON.stringify({ alias, redirect: null }) }
    );
    console.log(`     alias ${alias} -> HTTP ${res.status}`);
  }

  const liveHtml = await (await fetch(`https://${ALIASES[0]}`)).text();
  const liveJs = await (await fetch(`https://${ALIASES[0]}${[...liveHtml.matchAll(/\/assets\/[A-Za-z0-9._-]+\.js/g)][0][0]}`)).text();
  if (!liveJs.includes(EXPECTED_API)) {
    throw new Error('Live alias is not serving the expected bundle.');
  }
  console.log(`\nLive and verified: https://${ALIASES[0]}`);
}

main().catch((error) => {
  console.error(`\nDeployment failed: ${error.message}`);
  process.exit(1);
});
