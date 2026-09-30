const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { buildSslOptions } = require('../config/settings');

/**
 * Reports which database an administrative script would act on, and compares
 * the row counts of the local development database with the deployed one, so a
 * seed or migration can never be pointed at the wrong host by accident.
 *
 * The gitignored deploy/render-secrets.env wins over a local .env here on
 * purpose: these scripts exist to manage the deployed database, and a stray
 * DB_HOST=localhost in .env must not silently redirect them.
 */
function readSecretsFile() {
  const file = path.resolve(__dirname, '..', '..', 'deploy', 'render-secrets.env');
  const settings = {};

  if (!fs.existsSync(file)) return settings;

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
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
    if (key.startsWith('DB_')) settings[key] = value;
  }

  return settings;
}

const TABLES = ['staff', 'patients', 'appointments', 'consultations', 'prescriptions', 'lab_requests', 'lab_results', 'medicines'];

async function countRows(settings, label) {
  try {
    const connection = await mysql.createConnection({
      host: settings.DB_HOST,
      port: Number(settings.DB_PORT || 3306),
      user: settings.DB_USER,
      password: settings.DB_PASSWORD || '',
      database: settings.DB_NAME,
      connectTimeout: 8000,
      ...buildSslOptions(settings),
    });

    const counts = {};
    for (const table of TABLES) {
      try {
        const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
        counts[table] = rows[0].total;
      } catch (error) {
        counts[table] = `error ${error.code || ''}`.trim();
      }
    }
    await connection.end();

    console.log(`\n${label}: ${settings.DB_NAME} at ${settings.DB_HOST}:${settings.DB_PORT || 3306}`);
    console.table(counts);
    return counts;
  } catch (error) {
    console.log(`\n${label}: unreachable (${error.code || error.message})`);
    return null;
  }
}

async function main() {
  const deployed = readSecretsFile();

  if (!deployed.DB_HOST) {
    console.log('deploy/render-secrets.env holds no DB_HOST settings; nothing to compare.');
    return;
  }

  const localEnv = {};
  for (const file of ['.env', 'backend/.env']) {
    const path_ = path.resolve(__dirname, '..', '..', file);
    if (!fs.existsSync(path_)) continue;
    for (const line of fs.readFileSync(path_, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      localEnv[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    }
  }

  await countRows(deployed, 'Deployed database');
  if (localEnv.DB_HOST) {
    await countRows(localEnv, 'Local development database');
  }
}

main().catch((error) => {
  console.error(`Comparison failed: ${error.message}`);
  process.exit(1);
});
