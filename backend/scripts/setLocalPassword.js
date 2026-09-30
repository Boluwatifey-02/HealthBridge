/**
 * Sets the password of a local development account.
 *
 * Local MySQL databases accumulate accounts whose passwords nobody recorded,
 * which makes it impossible to run an acceptance suite against them. This
 * script resets one to a known value so the suite can sign in.
 *
 * It refuses to act on any host other than localhost, and it refuses to run at
 * all unless a target host is passed explicitly. The deployed database is never
 * reachable from here, which is deliberate: silently changing a production
 * password would be far worse than a test that cannot run.
 *
 *   node backend/scripts/setLocalPassword.js admin@healthbridge.org NewPass1234
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { buildSslOptions } = require('../config/settings');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Reads the local development credentials. The shared settings helper prefers
 * the deployed secrets file, which holds the production database user, so the
 * .env files are read directly here.
 */
function localSettings() {
  const settings = {};

  for (const relative of ['.env', 'backend/.env']) {
    const file = path.resolve(__dirname, '..', '..', relative);
    if (!fs.existsSync(file)) continue;

    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      settings[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    }
  }

  return settings;
}

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node backend/scripts/setLocalPassword.js <email> <new-password>');
    process.exit(1);
  }

  // The host is required as an argument rather than read from configuration, so
  // running this by accident always stops and asks.
  const requestedHost = process.argv[4];

  if (!requestedHost) {
    console.error('Refusing to run without an explicit target host.');
    console.error('Usage: node backend/scripts/setLocalPassword.js <email> <new-password> <host>');
    process.exit(1);
  }

  if (!LOCAL_HOSTS.has(requestedHost)) {
    console.error(`Refusing to change a password on host "${requestedHost}".`);
    console.error('This script only operates on a local development database.');
    process.exit(1);
  }

  const settings = localSettings();
  settings.DB_HOST = requestedHost;
  settings.DB_PORT = process.env.DB_PORT || settings.DB_PORT || '3306';

  if (!settings.DB_USER || !settings.DB_NAME) {
    console.error('Local database credentials were not found in .env or backend/.env.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT),
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    database: settings.DB_NAME,
    ...buildSslOptions(settings),
  });

  const [rows] = await connection.query('SELECT id, role, status FROM staff WHERE email = ? LIMIT 1', [
    email.toLowerCase(),
  ]);

  if (!rows.length) {
    console.error(`No staff account uses ${email} on the local database.`);
    await connection.end();
    process.exit(1);
  }

  await connection.query('UPDATE staff SET password_hash = ? WHERE id = ?', [
    await bcrypt.hash(password, 10),
    rows[0].id,
  ]);

  console.log(`Password updated for ${email} (${rows[0].role}, ${rows[0].status}) on ${requestedHost}.`);
  await connection.end();
}

main().catch((error) => {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});
