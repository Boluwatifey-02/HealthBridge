/**
 * Sets the password for a HealthBridge staff account.
 *
 * Usage (Windows PowerShell):
 *   node deploy/set-staff-password.js admin@healthbridge.org "MyNewPassword123"
 *
 * The password is supplied as an argument so it is never written into this
 * file, into a commit, or into a command that gets logged. It is hashed with
 * bcrypt before it reaches MySQL, exactly as the login route expects.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('../backend/node_modules/bcrypt');
const mysql = require('../backend/node_modules/mysql2/promise');

const ROOT = path.resolve(__dirname, '..');

// Prefer Render's deployed secrets so this works against production Aiven.
function loadSettings() {
  const secretsPath = path.join(ROOT, 'deploy', 'render-secrets.env');

  if (fs.existsSync(secretsPath)) {
    const settings = {};
    for (const line of fs.readFileSync(secretsPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      settings[trimmed.slice(0, index).trim()] = value;
    }
    if (settings.DB_HOST) return settings;
  }

  return process.env;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) process.stdin.removeListener('data', onData);
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  let password = process.argv[3] || '';

  if (!email) {
    console.error('Usage: node deploy/set-staff-password.js <email> [new password]');
    console.error('Example: node deploy/set-staff-password.js admin@healthbridge.org');
    process.exit(1);
  }

  if (!password) {
    password = await askHidden('New password (input hidden): ');
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const settings = loadSettings();
  const caPath = path.join(ROOT, 'backend', 'aiven-ca.pem');

  const connection = await mysql.createConnection({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT || 3306),
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    database: settings.DB_NAME,
    ...(fs.existsSync(caPath)
      ? { ssl: { ca: fs.readFileSync(caPath, 'utf8').trim(), rejectUnauthorized: true } }
      : {}),
  });

  const [rows] = await connection.query('SELECT id, email, role FROM staff WHERE email = ? LIMIT 1', [email]);

  if (!rows.length) {
    console.error(`No staff account found for ${email}.`);
    await connection.end();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  await connection.query('UPDATE staff SET password_hash = ? WHERE id = ?', [hash, rows[0].id]);
  // Any reset link issued before this change is no longer valid.
  await connection.query('DELETE FROM password_reset_tokens WHERE staff_id = ?', [rows[0].id]).catch(() => {});

  console.log(`Password updated for ${rows[0].email} (${rows[0].role}).`);
  console.log('You can now sign in at the HealthBridge login page.');

  await connection.end();
}

main().catch((error) => {
  console.error(`Could not update the password: ${error.message}`);
  process.exit(1);
});
