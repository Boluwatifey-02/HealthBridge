const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Sets the status of a local development staff account.
 *
 * An interrupted acceptance run can leave a real account deactivated, which
 * blocks the next run from signing in. This restores one without needing the
 * password.
 *
 * Like the password helper it only ever touches localhost, and the target host
 * must be passed explicitly.
 *
 *   node backend/scripts/setLocalStaffStatus.js lab@healthbridge.org Active localhost
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

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

async function main() {
  const [email, status, requestedHost] = process.argv.slice(2);

  if (!email || !status || !requestedHost) {
    console.error('Usage: node backend/scripts/setLocalStaffStatus.js <email> <Active|Inactive> <host>');
    process.exit(1);
  }

  if (!LOCAL_HOSTS.has(requestedHost)) {
    console.error(`Refusing to change an account on host "${requestedHost}".`);
    process.exit(1);
  }

  if (!['Active', 'Inactive'].includes(status)) {
    console.error('Status must be Active or Inactive.');
    process.exit(1);
  }

  const settings = localSettings();
  settings.DB_HOST = requestedHost;

  const connection = await mysql.createConnection({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT || 3306),
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    database: settings.DB_NAME,
  });

  const [result] = await connection.query('UPDATE staff SET status = ? WHERE email = ?', [
    status,
    email.toLowerCase(),
  ]);

  console.log(`${result.affectedRows} account(s) set to ${status} on ${requestedHost}.`);
  await connection.end();
}

main().catch((error) => {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});
