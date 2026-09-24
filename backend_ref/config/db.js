const mysql = require("mysql2/promise");
require("dotenv").config();

// Connection pool — reused across all queries rather than opening
// a new connection per request.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("✓ Database connected successfully");
    conn.release();
  } catch (err) {
    console.error("✗ Database connection failed:", err.message);
    console.error("  Check your .env file matches your MySQL setup, and that schema.sql has been run.");
  }
}

module.exports = { pool, testConnection };
