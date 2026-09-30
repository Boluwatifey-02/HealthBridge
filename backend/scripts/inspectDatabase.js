const mysql = require('mysql2/promise');
const {
  loadSettings,
  buildSslOptions,
  assertDatabaseConfigured,
} = require('../config/settings');

/**
 * Prints what is currently stored in the HealthBridge database so an
 * administrator can confirm the state of a deployment without opening a
 * database client. Counts only - no patient-identifying data is printed.
 */
const TABLES = [
  'branches', 'staff', 'patients', 'appointments', 'consultations',
  'prescriptions', 'lab_requests', 'lab_results', 'medicines',
  'patient_documents', 'audit_logs',
];

async function main() {
  const settings = assertDatabaseConfigured(loadSettings());
  const connection = await mysql.createConnection({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT || 3306),
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    database: settings.DB_NAME,
    ...buildSslOptions(settings),
  });

  console.log(`Database: ${settings.DB_NAME} at ${settings.DB_HOST}:${settings.DB_PORT || 3306}\n`);

  console.log('Row counts');
  for (const table of TABLES) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    console.log(`  ${table.padEnd(20)} ${rows[0].total}`);
  }

  const [staff] = await connection.query('SELECT id, email, role, status FROM staff ORDER BY role, email');
  console.log('\nStaff accounts');
  console.table(staff);

  const [statuses] = await connection.query(
    "SELECT status, COUNT(*) AS total FROM appointments GROUP BY status ORDER BY status"
  );
  console.log('Appointments by status');
  console.table(statuses);

  const [prescriptionStatuses] = await connection.query(
    'SELECT status, COUNT(*) AS total FROM prescriptions GROUP BY status ORDER BY status'
  );
  console.log('Prescriptions by status');
  console.table(prescriptionStatuses);

  const [labStatuses] = await connection.query(
    'SELECT status, COUNT(*) AS total FROM lab_requests GROUP BY status ORDER BY status'
  );
  console.log('Lab requests by status');
  console.table(labStatuses);

  const [lowStock] = await connection.query(
    'SELECT name, stock_quantity, reorder_level FROM medicines WHERE stock_quantity <= reorder_level ORDER BY name'
  );
  console.log(`Low or out of stock (${lowStock.length})`);
  if (lowStock.length) console.table(lowStock);

  await connection.end();
}

main().catch((error) => {
  console.error(`Inspection failed: ${error.message}`);
  process.exit(1);
});
