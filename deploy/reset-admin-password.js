/*
 * Reset the HealthBridge administrator password directly in Aiven MySQL.
 *
 * Use this only to recover access when the password is genuinely lost. It
 * writes a new bcrypt hash straight to the staff table, so it works even if
 * email delivery is not configured yet.
 *
 * The new password is never printed or logged. It is written to
 * deploy/admin-credentials.txt, which is gitignored.
 *
 *   node deploy/reset-admin-password.js
 *
 * Pass --generate to create a strong random password. Pass --password <value>
 * to set a specific one; prefer --generate so it does not appear in shell
 * history.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SECRETS_FILE = path.join(__dirname, 'render-secrets.env');
const CA_FILE = path.join(ROOT, 'backend', 'aiven-ca.pem');
const OUTPUT_FILE = path.join(__dirname, 'admin-credentials.txt');
const BCRYPT_ROUNDS = 10;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@healthbridge.org';

function readSecrets() {
  if (!fs.existsSync(SECRETS_FILE)) {
    console.error('Missing deploy/render-secrets.env - cannot read the Aiven credentials.');
    process.exit(1);
  }

  const values = {};
  for (const rawLine of fs.readFileSync(SECRETS_FILE, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[line.slice(0, separator).trim()] = value;
  }
  return values;
}

function buildPassword() {
  // 20 characters drawn from an unambiguous alphabet, always containing a digit.
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  while (out.length < 20) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const explicitIndex = args.indexOf('--password');
  const explicit = explicitIndex !== -1 ? args[explicitIndex + 1] : null;

  if (explicit && explicit.length < 12) {
    console.error('Refusing to set a password shorter than 12 characters.');
    process.exit(1);
  }

  const password = explicit || buildPassword();

  const values = readSecrets();

  if (!fs.existsSync(CA_FILE)) {
    console.error('Missing backend/aiven-ca.pem - the Aiven CA certificate is required.');
    process.exit(1);
  }

  const bcrypt = require(path.join(ROOT, 'backend', 'node_modules', 'bcrypt'));
  const mysql = require(path.join(ROOT, 'backend', 'node_modules', 'mysql2', 'promise'));

  const ca = fs.readFileSync(CA_FILE, 'utf8').trim();
  const connection = await mysql.createConnection({
    host: values.DB_HOST,
    port: Number(values.DB_PORT),
    user: values.DB_USER,
    password: values.DB_PASSWORD,
    database: values.DB_NAME,
    ssl: { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  });

  const [existing] = await connection.query('SELECT id FROM staff WHERE email = ? LIMIT 1', [ADMIN_EMAIL]);

  if (!existing.length) {
    console.error(`No staff account found for ${ADMIN_EMAIL}.`);
    await connection.end();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await connection.query('UPDATE staff SET password_hash = ? WHERE email = ?', [passwordHash, ADMIN_EMAIL]);
  // Any outstanding reset links are discarded by the password change.
  await connection.query('DELETE FROM password_reset_tokens WHERE staff_id = ?', [existing[0].id]);

  await connection.end();

  // The password is written to a gitignored file rather than printed.
  fs.writeFileSync(
    OUTPUT_FILE,
    [
      'HealthBridge administrator credentials',
      '',
      `email    : ${ADMIN_EMAIL}`,
      `password : ${password}`,
      '',
      'Sign in at the public frontend URL and change this password from',
      'Forgotten password if needed. This file is gitignored; delete it once',
      'you have stored the password securely.',
      '',
    ].join('\n'),
    { mode: 0o600 }
  );

  console.log(`Administrator password updated for ${ADMIN_EMAIL}.`);
  console.log('Any outstanding password reset links were invalidated.');
  console.log(`The new password was written to: ${OUTPUT_FILE}`);
  console.log('It was not printed here. Delete that file once you have noted it.');
}

main().catch((error) => {
  console.error(`Failed to reset the administrator password: ${error.message}`);
  process.exit(1);
});
