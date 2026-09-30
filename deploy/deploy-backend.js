/*
 * HealthBridge backend deployment to Render.
 *
 * Reads deploy/render-secrets.env (gitignored) for RENDER_API_KEY and DB_PASSWORD,
 * and backend/aiven-ca.pem for the production TLS certificate, then creates or
 * updates the Render web service through the Render API.
 *
 * Secrets are never printed. Run: node deploy/deploy-backend.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SECRETS_FILE = path.join(__dirname, 'render-secrets.env');
const CA_FILE = path.join(ROOT, 'backend', 'aiven-ca.pem');

const GITHUB_REPO_SHORT = 'Boluwatifey-02/HealthBridge';
const GITHUB_REPO_URL = 'https://github.com/Boluwatifey-02/HealthBridge';
const BRANCH = 'master';
const ROOT_DIR = 'backend';
const BUILD_COMMAND = 'npm install';
const START_COMMAND = 'npm start';
const REGION = 'frankfurt';
const PLAN = 'free';
const SERVICE_NAMES = ['healthbridge-api', 'healthbridge-backend'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readSecretsFile() {
  if (!fs.existsSync(SECRETS_FILE)) {
    console.error('Missing deploy/render-secrets.env');
    console.error('Create it from render-secrets.env.example and fill in RENDER_API_KEY and DB_PASSWORD.');
    process.exit(1);
  }

  const values = {};

  for (const rawLine of fs.readFileSync(SECRETS_FILE, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

// Render enforces a fairly tight rate limit; back off and retry instead of failing.
async function renderApi(apiKey, apiPath, options = {}, attempt = 1) {
  const maxAttempts = 6;

  const response = await fetch(`https://api.render.com/v1${apiPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 429 && attempt < maxAttempts) {
    const waitSeconds = Math.min(5 * 2 ** (attempt - 1), 120);
    console.log(`  rate limited; retrying in ${waitSeconds}s (attempt ${attempt}/${maxAttempts})`);
    await sleep(waitSeconds * 1000);
    return renderApi(apiKey, apiPath, options, attempt + 1);
  }

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = body && body.message ? body.message : text;
    throw new Error(
      `Render API ${options.method || 'GET'} ${apiPath} failed (${response.status}): ${detail}`
    );
  }

  return body;
}

// Keep generated values stable across re-runs by persisting them alongside the secrets.
function resolveSecret(values, key, generate) {
  if (values[key] && values[key].length >= 16) {
    return values[key];
  }

  const generated = generate();
  values[key] = generated;
  return generated;
}

function persistSecrets(values) {
  const lines = [
    '# HealthBridge Render deployment secrets (gitignored).',
    '# GENERATED_* values are written automatically on first run and reused afterwards.',
    '',
  ];

  for (const [key, value] of Object.entries(values)) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(SECRETS_FILE, `${lines.join('\n')}\n`, { mode: 0o600 });

  const generatedKeys = Object.keys(values).filter((k) => k.startsWith('GENERATED_'));
  if (generatedKeys.length) {
    console.log(`Persisted generated values to render-secrets.env: ${generatedKeys.join(', ')}`);
  }
}

async function main() {
  const values = readSecretsFile();

  const apiKey = values.RENDER_API_KEY;
  const dbPassword = values.DB_PASSWORD;

  const aiven = {
    host: values.DB_HOST || '',
    port: values.DB_PORT || '',
    user: values.DB_USER || '',
    database: values.DB_NAME || '',
  };

  if (!aiven.host || !aiven.port || !aiven.user || !aiven.database) {
    console.error('DB_HOST, DB_PORT, DB_USER and DB_NAME must be set in deploy/render-secrets.env');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('RENDER_API_KEY is empty in deploy/render-secrets.env');
    process.exit(1);
  }
  if (!dbPassword) {
    console.error('DB_PASSWORD is empty in deploy/render-secrets.env');
    process.exit(1);
  }
  if (!fs.existsSync(CA_FILE)) {
    console.error('Missing backend/aiven-ca.pem - the Aiven CA certificate is required.');
    process.exit(1);
  }

  console.log(`Database target: ${aiven.user}@${aiven.host}:${aiven.port}/${aiven.database}`);

  const jwtSecret = resolveSecret(values, 'GENERATED_JWT_SECRET', () =>
    crypto.randomBytes(48).toString('hex')
  );
  const adminPassword = resolveSecret(values, 'GENERATED_SEED_ADMIN_PASSWORD', () =>
    crypto.randomBytes(16).toString('base64url')
  );
  const doctorPassword = resolveSecret(values, 'GENERATED_SEED_DOCTOR_PASSWORD', () =>
    crypto.randomBytes(16).toString('base64url')
  );
  const receptionPassword = resolveSecret(values, 'GENERATED_SEED_RECEPTION_PASSWORD', () =>
    crypto.randomBytes(16).toString('base64url')
  );

  persistSecrets(values);

  const ca = fs.readFileSync(CA_FILE, 'utf8').trim();
  const caSingleLine = ca.replace(/\r?\n/g, '\\n');

  console.log('Locating Render workspace...');
  const ownersResponse = await renderApi(apiKey, '/owners');
  const owners = (Array.isArray(ownersResponse) ? ownersResponse : [])
    .map((entry) => (entry && entry.owner ? entry.owner : entry))
    .filter(Boolean);
  const workspace =
    owners.find((owner) => owner.type === 'team') ||
    owners.find((owner) => owner.type === 'user') ||
    owners[0];

  if (!workspace || !workspace.id) {
    console.error('Could not resolve a Render workspace from the API response.');
    process.exit(1);
  }
  console.log(`Using Render workspace: ${workspace.name} (${workspace.type})`);

  console.log('Checking for an existing HealthBridge service...');
  const existing = await renderApi(apiKey, '/services?limit=100');
  const normalized = existing.map((item) => item.service || item);

  // Prefer a known name, then fall back to any service already pointed at backend/.
  let service =
    SERVICE_NAMES.map((n) => normalized.find((s) => s.name === n)).find(Boolean) ||
    normalized.find((s) => s.rootDir === ROOT_DIR) ||
    null;

  if (!service) {
    console.log('Creating the web service...');
    const created = await renderApi(apiKey, '/services', {
      method: 'POST',
      body: JSON.stringify({
        type: 'web_service',
        name: SERVICE_NAMES[0],
        ownerId: workspace.id,
        repo: GITHUB_REPO_SHORT,
        branch: BRANCH,
        rootDir: ROOT_DIR,
        autoDeploy: 'yes',
        autoDeployTrigger: 'commit',
        serviceDetails: {
          webServiceDetails: {
            runtime: 'node',
            plan: PLAN,
            region: REGION,
            healthCheckPath: '/api/health',
            envSpecificDetails: {
              buildCommand: BUILD_COMMAND,
              startCommand: START_COMMAND,
            },
            numInstances: 1,
          },
        },
      }),
    });
    service = created.service || created;
    console.log(`Created service ${service.id}`);
  } else {
    console.log(`Adopting existing service ${service.id} (${service.name})`);
    await renderApi(apiKey, `/services/${service.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        branch: BRANCH,
        rootDir: ROOT_DIR,
        autoDeployTrigger: 'commit',
        serviceDetails: {
          webServiceDetails: {
            healthCheckPath: '/api/health',
            envSpecificDetails: {
              buildCommand: BUILD_COMMAND,
              startCommand: START_COMMAND,
            },
          },
        },
      }),
    });
    console.log(`Service updated to branch=${BRANCH}, rootDir=${ROOT_DIR}, healthCheck=/api/health`);
  }

  const serviceId = service.id;

  console.log('Setting environment variables...');
  const envVars = [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'JWT_SECRET', value: jwtSecret, type: 'secret' },
    { key: 'JWT_EXPIRES_IN', value: '8h' },
    { key: 'DB_HOST', value: aiven.host },
    { key: 'DB_PORT', value: aiven.port },
    { key: 'DB_USER', value: aiven.user },
    { key: 'DB_PASSWORD', value: dbPassword, type: 'secret' },
    { key: 'DB_NAME', value: aiven.database },
    { key: 'DB_SSL_CA', value: caSingleLine, type: 'secret' },
    { key: 'DB_SSL_REJECT_UNAUTHORIZED', value: 'true' },
    { key: 'SEED_STAFF', value: 'true' },
    { key: 'SEED_ADMIN_PASSWORD', value: adminPassword, type: 'secret' },
    { key: 'SEED_DOCTOR_PASSWORD', value: doctorPassword, type: 'secret' },
    { key: 'SEED_RECEPTION_PASSWORD', value: receptionPassword, type: 'secret' },
    {
      key: 'FRONTEND_ORIGIN',
      value:
        values.FRONTEND_ORIGIN ||
        'https://healthbridge-seven-eosin.vercel.app',
    },
  ];

  // Optional SMTP settings. Absent by default, which makes the backend write
  // reset links to the server log instead of emailing them. Populate these in
  // deploy/render-secrets.env to switch on real email delivery.
  const smtpVars = [
    ['SMTP_HOST', values.SMTP_HOST],
    ['SMTP_PORT', values.SMTP_PORT],
    ['SMTP_SECURE', values.SMTP_SECURE],
    ['SMTP_USER', values.SMTP_USER],
    ['SMTP_PASS', values.SMTP_PASS],
    ['SMTP_FROM', values.SMTP_FROM],
  ]
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      key,
      value,
      type: key === 'SMTP_PASS' ? 'secret' : 'plain',
    }));

  if (smtpVars.length) {
    envVars.push(...smtpVars);
    console.log(`SMTP configured (${smtpVars.map((v) => v.key).join(', ')}) - reset links will be emailed.`);
  } else {
    console.log('SMTP not configured - password reset links will be written to the server log.');
  }

  await renderApi(apiKey, `/services/${serviceId}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify(envVars),
  });
  console.log(`Environment variables applied to ${serviceId}.`);

  const finalState = await renderApi(apiKey, `/services/${serviceId}`);
  const s = finalState.service || finalState;
  const webDetails = s.serviceDetails && s.serviceDetails.webServiceDetails;
  const envDetails = (webDetails && webDetails.envSpecificDetails) || {};

  console.log('\n=== Service ===');
  console.log(`name        : ${s.name}`);
  console.log(`id          : ${s.id}`);
  console.log(`branch      : ${s.branch}`);
  console.log(`rootDir     : ${s.rootDir}`);
  console.log(`runtime     : ${webDetails ? webDetails.runtime : 'unknown'}`);
  console.log(`plan        : ${webDetails ? webDetails.plan : 'unknown'}`);
  console.log(`region      : ${webDetails ? (webDetails.region.id || webDetails.region) : 'unknown'}`);
  console.log(`build       : ${envDetails.buildCommand || 'unknown'}`);
  console.log(`start       : ${envDetails.startCommand || 'unknown'}`);
  console.log(`healthCheck : ${webDetails ? webDetails.healthCheckPath || '(none)' : 'unknown'}`);
  console.log(`public url  : ${webDetails ? webDetails.url : 'pending'}`);

  console.log('\nNo secret was printed.');
  console.log(`Seed credentials are in deploy/render-secrets.env (read it locally).`);
}

main().catch((error) => {
  console.error(`\nDEPLOY FAILED: ${error.message}`);
  process.exit(1);
});
