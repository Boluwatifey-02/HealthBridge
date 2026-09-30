const fs = require('fs');
const path = require('path');

// Columns added to schema.sql after a table was first created in an existing
// database. CREATE TABLE IF NOT EXISTS leaves an already-created table
// untouched, so these have to be applied separately. MySQL has no
// "ADD COLUMN IF NOT EXISTS", so each is checked against information_schema
// first. Every step here is idempotent.
const ADDITIVE_COLUMNS = [
  { table: 'appointments', column: 'provider', definition: 'VARCHAR(150)' },
  { table: 'patients', column: 'email', definition: 'VARCHAR(120)' },
  { table: 'patients', column: 'password_hash', definition: 'VARCHAR(255)' },
  { table: 'patients', column: 'occupation', definition: 'VARCHAR(120)' },
  { table: 'patients', column: 'national_id', definition: 'VARCHAR(40)' },
  { table: 'patients', column: 'emergency_contact', definition: 'VARCHAR(80)' },
  { table: 'patients', column: 'genotype', definition: 'VARCHAR(10)' },
  { table: 'patients', column: 'medical_history', definition: 'TEXT' },
  { table: 'patients', column: 'notes', definition: 'TEXT' },
];

// Patient lookups, activity feeds and reporting scan these columns on every
// request. MySQL has no CREATE INDEX IF NOT EXISTS, so an index that already
// exists is reported as error 1061, which is safe to ignore.
const SECONDARY_INDEXES = [
  'idx_patients_name ON patients (full_name)',
  'idx_patients_email ON patients (email)',
  'idx_patients_phone ON patients (phone)',
  'idx_appointments_date ON appointments (appointment_date)',
  'idx_appointments_patient ON appointments (patient_id)',
  'idx_consultations_patient ON consultations (patient_id)',
  'idx_prescriptions_patient ON prescriptions (patient_id)',
  'idx_prescriptions_status ON prescriptions (status)',
  'idx_lab_requests_patient ON lab_requests (patient_id)',
  'idx_lab_requests_status ON lab_requests (status)',
  'idx_lab_results_request ON lab_results (lab_request_id)',
  'idx_audit_logs_created ON audit_logs (created_at)',
  'idx_patient_reset_patient ON patient_password_reset_tokens (patient_id)',
  'idx_contact_messages_created ON contact_messages (created_at)',
];

/**
 * Creates every table, column and index HealthBridge needs on an already-open
 * connection. Safe to run repeatedly against an existing database.
 *
 * @param {import('mysql2/promise').Connection} connection
 * @param {string} databaseName schema the tables belong to
 * @param {(message: string) => void} [log] receives one line per applied change
 */
async function ensureSchema(connection, databaseName, log = () => {}) {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  for (const statement of schemaSql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await connection.query(statement);
  }

  for (const { table, column, definition } of ADDITIVE_COLUMNS) {
    const [existing] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [databaseName, table, column]
    );

    if (existing.length === 0) {
      // Table and column names are literals from the list above, never user input.
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      log(`Applied migration: ${table}.${column}`);
    }
  }

  for (const definition of SECONDARY_INDEXES) {
    const name = definition.slice(0, definition.indexOf(' ON '));
    try {
      // The definition is a literal from the list above, never user input.
      await connection.query(`CREATE INDEX ${definition}`);
      log(`Applied migration: index ${name}`);
    } catch (indexError) {
      const alreadyExists = indexError.code === 'ER_DUP_KEYNAME' || indexError.errno === 1061;
      if (!alreadyExists) throw indexError;
    }
  }
}

module.exports = { ensureSchema, ADDITIVE_COLUMNS, SECONDARY_INDEXES };
