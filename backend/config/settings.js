const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SECRETS_FILE = path.join(ROOT, 'deploy', 'render-secrets.env');

/**
 * Resolves database settings for administrative scripts.
 *
 * dotenv is deliberately NOT called here. The repository root .env sets
 * DB_HOST=localhost for local development, and loading it would silently point
 * seeding and migrations at a developer's own machine instead of the deployed
 * database. These scripts manage the deployment, so the gitignored
 * deploy/render-secrets.env is the source of truth; a variable already
 * exported in the shell still wins, and finally the .env files are consulted
 * as a last resort so a fresh clone can still reach a local database when that
 * is genuinely intended.
 *
 * Nothing here logs a value.
 */
function loadSettings() {
  const settings = {};

  if (fs.existsSync(SECRETS_FILE)) {
    for (const line of fs.readFileSync(SECRETS_FILE, 'utf8').split('\n')) {
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

      const key = trimmed.slice(0, index).trim();
      if (!settings[key]) settings[key] = value;
    }
  }

  // An explicitly exported variable outranks the secrets file.
  for (const [key, value] of Object.entries(process.env)) {
    if (value) settings[key] = value;
  }

  // Last resort: the local development files.
  for (const relative of ['.env', 'backend/.env']) {
    const file = path.join(ROOT, relative);
    if (!fs.existsSync(file)) continue;

    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const index = trimmed.indexOf('=');
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      if (!settings[key]) settings[key] = trimmed.slice(index + 1).trim();
    }
  }

  return settings;
}

/**
 * TLS is opt-in: it activates only when DB_SSL_CA is present, so local MySQL
 * over localhost keeps working without certificates.
 */
function buildSslOptions(settings = loadSettings()) {
  const raw = (settings.DB_SSL_CA || '').trim();
  if (!raw) return {};

  // Deployment environments deliver the certificate as a single line with
  // escaped newlines; the TLS layer needs real newlines to parse the PEM.
  const ca = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;

  return {
    ssl: {
      ca,
      rejectUnauthorized: settings.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      minVersion: 'TLSv1.2',
    },
  };
}

function assertDatabaseConfigured(settings = loadSettings()) {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
    .filter((key) => !settings[key]);

  if (missing.length > 0) {
    throw new Error(`Missing MySQL settings: ${missing.join(', ')}`);
  }

  return settings;
}

/**
 * Prints the database an administrative script is about to act on. Called
 * before any write so a mistargeted migration is obvious in the log rather than
 * discovered afterwards. Only the host and schema name are shown, never a
 * password.
 */
function describeTarget(settings = loadSettings()) {
  const host = settings.DB_HOST || '(unset)';
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/i.test(host);
  const label = isLocal ? 'LOCAL DEVELOPMENT' : 'DEPLOYED';

  console.log(`Target database [${label}]: ${settings.DB_NAME} at ${host}:${settings.DB_PORT || 3306}`);

  return { host, isLocal };
}

module.exports = {
  loadSettings,
  buildSslOptions,
  assertDatabaseConfigured,
  describeTarget,
  ROOT,
  SECRETS_FILE,
};
