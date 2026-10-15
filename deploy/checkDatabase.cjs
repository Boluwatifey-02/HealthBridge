/**
 * Reports what the deployed backend actually has, without printing any secret
 * value. Used to confirm the production database is reachable and populated.
 */
const fs = require('fs');
const path = require('path');

const SECRETS_FILE = path.resolve(__dirname, '..', 'deploy', 'render-secrets.env');

function loadSecrets() {
  const secrets = {};

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
      secrets[trimmed.slice(0, index).trim()] = value;
    }
  }

  return secrets;
}

/** Masks a host so it can be reported without disclosing the account name. */
function maskHost(host) {
  if (!host) return '(unset)';
  const parts = String(host).split('.');
  return `${parts[0].slice(0, 6)}***.${parts.slice(1).join('.')}`;
}

async function main() {
  const secrets = loadSecrets();
  const host = process.env.DB_HOST || secrets.DB_HOST;

  console.log(`DB_HOST   ${maskHost(host)}`);
  console.log(`DB_PORT   ${process.env.DB_PORT || secrets.DB_PORT || '(unset)'}`);
  console.log(`DB_NAME   ${process.env.DB_NAME || secrets.DB_NAME || '(unset)'}`);

  const dns = require('dns').promises;

  try {
    const records = await dns.lookup(host);
    console.log(`DNS       resolves to ${records.address}`);
  } catch (error) {
    console.log(`DNS       FAILED (${error.code}) - the database host does not exist`);
    return;
  }

  const mysql = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'mysql2', 'promise'));

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT || secrets.DB_PORT || 3306),
      user: process.env.DB_USER || secrets.DB_USER,
      password: process.env.DB_PASSWORD || secrets.DB_PASSWORD,
      database: process.env.DB_NAME || secrets.DB_NAME,
      connectTimeout: 15000,
    });

    console.log('CONNECT   ok');

    const tables = ['staff', 'patients', 'appointments', 'consultations', 'prescriptions', 'medicines', 'lab_requests', 'lab_results', 'audit_logs'];

    for (const table of tables) {
      try {
        const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM ${table}`);
        console.log(`${table.padEnd(14)} ${String(rows[0].total).padStart(6)} rows`);
      } catch (error) {
        console.log(`${table.padEnd(14)} ERROR ${error.code || error.message}`);
      }
    }
  } catch (error) {
    console.log(`CONNECT   FAILED (${error.code || error.message})`);
  } finally {
    if (connection) await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
