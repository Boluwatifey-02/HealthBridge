require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const names = [
    'Deployment Smoke Test',
    'Deployment Smoke Test 2',
    'UI Verified Patient',
    'Incomplete',
  ];

  const [rows] = await connection.query(
    `SELECT id, full_name FROM patients WHERE full_name IN (${names.map(() => '?').join(',')})`,
    names
  );

  for (const row of rows) {
    const dependencies = ['appointments', 'consultations', 'lab_requests', 'prescriptions'];

    for (const table of dependencies) {
      await connection.query(`DELETE FROM \`${table}\` WHERE patient_id = ?`, [row.id]);
    }

    await connection.query('DELETE FROM patients WHERE id = ?', [row.id]);
    console.log(`Removed test patient ${row.id} (${row.full_name})`);
  }

  await connection.query("DELETE FROM medicines WHERE name = 'Smoke Test Syrup'");
  console.log('Removed test medicine Smoke Test Syrup');

  await connection.end();
})().catch((error) => {
  console.error('Cleanup failed:', error.message);
  process.exit(1);
});