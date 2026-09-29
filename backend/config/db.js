const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let databaseAvailable = false;
let databaseError = null;

async function initializeDatabase() {
  const hasDbConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (!hasDbConfig) {
    databaseAvailable = false;
    databaseError = 'MySQL environment variables are incomplete.';
    console.error(
      'MySQL environment variables are incomplete. Configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME.'
    );
    return false;
  }

  try {
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
    });

    try {
      await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    } catch (createError) {
      console.warn(`Skipped automatic database creation: ${createError.message}`);
    }

    await rootConnection.end();

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    await pool.query('SELECT 1');

    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const statements = schemaSql
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }

    databaseAvailable = true;
    databaseError = null;
    console.log('MySQL database connection successful and HealthBridge schema verified.');
    return true;
  } catch (error) {
    databaseAvailable = false;
    databaseError = error.message;
    console.error('MySQL initialization failed.');
    console.error(error.message);
    return false;
  }
}

function isFallbackMode() {
  return !databaseAvailable;
}

function getDatabaseError() {
  return databaseError;
}

async function testConnection() {
  return initializeDatabase();
}

async function query(sql, params = []) {
  if (isFallbackMode() || !pool) {
    return [[], []];
  }

  return pool.query(sql, params);
}

async function getDashboardMetrics() {
  const [patientRows] = await query('SELECT COUNT(*) AS total FROM patients');
  const [appointmentRows] = await query('SELECT COUNT(*) AS total FROM appointments');
  const [lowStockRows] = await query(
    'SELECT COUNT(*) AS total FROM medicines WHERE stock_quantity <= reorder_level'
  );
  const [labRows] = await query("SELECT COUNT(*) AS total FROM lab_requests WHERE status = 'Pending'");

  return {
    totalPatients: Number(patientRows[0]?.total || 0),
    appointments: Number(appointmentRows[0]?.total || 0),
    lowStockItems: Number(lowStockRows[0]?.total || 0),
    pendingLabRequests: Number(labRows[0]?.total || 0),
  };
}

async function findUserByEmail(email) {
  if (!email || isFallbackMode()) {
    return null;
  }

  const [rows] = await query('SELECT * FROM staff WHERE email = ?', [email.toLowerCase()]);
  return rows[0] || null;
}

module.exports = {
  initializeDatabase,
  isFallbackMode,
  getDatabaseError,
  testConnection,
  query,
  getDashboardMetrics,
  findUserByEmail,
};