require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await connection.query(`USE \`${process.env.DB_NAME}\``);

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = schemaSql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await connection.query(statement);
  }

  console.log(`Schema applied successfully to database: ${process.env.DB_NAME}`);
  await connection.end();
}

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
