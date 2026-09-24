// Run once after creating an empty MySQL database:
//   node config/initDb.js
// This applies schema.sql and creates a starter admin account so
// you have a way to log in and create everyone else through the
// Admin dashboard's "Manage Staff" screen.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

async function init() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log("Applying schema.sql ...");
  const schema = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  await connection.query(schema);

  console.log("Seeding starter admin account ...");
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await connection.query(
    `INSERT IGNORE INTO staff (staff_id, full_name, role, phone_number, branch_id, password_hash)
     VALUES ('S-ADMIN01', 'System Administrator', 'Admin', '0800-000-0000', 'BR-001', ?)`,
    [passwordHash]
  );

  console.log("Done. Log in with staffId 'S-ADMIN01' and password 'ChangeMe123!', then change it immediately.");
  await connection.end();
}

init().catch((err) => {
  console.error("Database initialization failed:", err.message);
  process.exit(1);
});
