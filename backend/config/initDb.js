require('dotenv').config();
const mysql = require('mysql2/promise');
const { ensureSchema } = require('./ensureSchema');

// TLS is opt-in: it activates only when DB_SSL_CA is present, so local MySQL
// development over localhost continues to work without certificates.
function buildSslOptions() {
  const ca = (process.env.DB_SSL_CA || '').trim();

  if (!ca) {
    return {};
  }

  return {
    ssl: {
      ca,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      minVersion: 'TLSv1.2',
    },
  };
}

async function initializeDatabase() {
  const requiredConfig = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = requiredConfig.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing MySQL environment variables:', missing.join(', '));
    console.error('Copy .env.example to .env and configure your database first.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...buildSslOptions(),
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await connection.query(`USE \`${process.env.DB_NAME}\``);

  await ensureSchema(connection, process.env.DB_NAME, (message) => console.log(message));

  console.log(`Schema applied successfully to database: ${process.env.DB_NAME}`);
  await connection.end();
}

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
