const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { ensureSchema } = require('./ensureSchema');
require('dotenv').config();

let pool = null;
let databaseAvailable = false;
let databaseError = null;

// TLS is opt-in: it activates only when DB_SSL_CA is present, so local MySQL
// development over localhost continues to work without certificates.
function buildSslOptions() {
  const raw = (process.env.DB_SSL_CA || '').trim();

  if (!raw) {
    return {};
  }

  // Deployment environments deliver the certificate as a single-line value with
  // escaped newlines. Node's TLS layer needs real newlines to parse the PEM, so
  // unescape when the literal sequence is present.
  const ca = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;

  return {
    ssl: {
      ca,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      minVersion: 'TLSv1.2',
    },
  };
}

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

  const sslOptions = buildSslOptions();

  try {
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      ...sslOptions,
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
      ...sslOptions,
    });

    await pool.query('SELECT 1');

    await ensureSchema(pool, process.env.DB_NAME, (message) => console.log(message));
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

/**
 * Checks out a single pooled connection for work that must run in a
 * transaction. Callers must call release() in a finally block.
 */
async function getConnection() {
  if (isFallbackMode() || !pool) {
    throw new Error('The HealthBridge database is unavailable.');
  }

  return pool.getConnection();
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
  getConnection,
  findUserByEmail,
};