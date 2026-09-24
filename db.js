const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const demoPatients = [
  {
    id: 'HB-10248',
    name: 'Amina Yusuf',
    age: 34,
    gender: 'Female',
    phone: '+234 803 421 7782',
    condition: 'Hypertension',
    lastVisit: '08 Sep 2026',
    status: 'Active',
    address: 'Ikeja, Lagos',
    allergies: 'None',
  },
  {
    id: 'HB-10247',
    name: 'David Okafor',
    age: 42,
    gender: 'Male',
    phone: '+234 806 214 9031',
    condition: 'Type 2 Diabetes',
    lastVisit: '07 Sep 2026',
    status: 'Active',
    address: 'Surulere, Lagos',
    allergies: 'Penicillin',
  },
  {
    id: 'HB-10246',
    name: 'Chioma Eze',
    age: 28,
    gender: 'Female',
    phone: '+234 809 552 1840',
    condition: 'Asthma',
    lastVisit: '06 Sep 2026',
    status: 'Active',
    address: 'Yaba, Lagos',
    allergies: 'Dust',
  },
  {
    id: 'HB-10245',
    name: 'Ibrahim Musa',
    age: 51,
    gender: 'Male',
    phone: '+234 802 771 4562',
    condition: 'Malaria',
    lastVisit: '05 Sep 2026',
    status: 'Active',
    address: 'Agege, Lagos',
    allergies: 'None',
  },
  {
    id: 'HB-10244',
    name: 'Grace Adeyemi',
    age: 37,
    gender: 'Female',
    phone: '+234 805 334 9201',
    condition: 'Migraine',
    lastVisit: '03 Sep 2026',
    status: 'Active',
    address: 'Maryland, Lagos',
    allergies: 'Ibuprofen',
  },
];

const demoAppointments = [
  {
    id: 'APT-2041',
    patient: 'Amina Yusuf',
    date: '2026-09-23',
    time: '09:00',
    provider: 'Dr. Adebisi',
    status: 'Confirmed',
    type: 'Consultation',
  },
  {
    id: 'APT-2042',
    patient: 'David Okafor',
    date: '2026-09-23',
    time: '10:30',
    provider: 'Dr. Nwosu',
    status: 'Scheduled',
    type: 'Follow-up',
  },
  {
    id: 'APT-2043',
    patient: 'Chioma Eze',
    date: '2026-09-23',
    time: '12:00',
    provider: 'Dr. Ijeoma',
    status: 'Pending',
    type: 'Review',
  },
];

const demoMedicines = [
  {
    id: 'MED-1001',
    name: 'Paracetamol 500mg',
    category: 'Pain Relief',
    stock: 240,
    unit: 'tablets',
    reorderLevel: 50,
    status: 'In stock',
  },
  {
    id: 'MED-1002',
    name: 'Amoxicillin 500mg',
    category: 'Antibiotic',
    stock: 85,
    unit: 'capsules',
    reorderLevel: 30,
    status: 'In stock',
  },
  {
    id: 'MED-1003',
    name: 'Artemether/Lumefantrine',
    category: 'Antimalarial',
    stock: 42,
    unit: 'packs',
    reorderLevel: 50,
    status: 'Low stock',
  },
  {
    id: 'MED-1004',
    name: 'Metformin 500mg',
    category: 'Diabetes',
    stock: 120,
    unit: 'tablets',
    reorderLevel: 40,
    status: 'In stock',
  },
];

const demoLabRequests = [
  {
    id: 'LAB-001',
    patient: 'Amina Yusuf',
    test: 'Full Blood Count',
    status: 'Pending',
    date: '12 Sep 2026',
  },
  {
    id: 'LAB-002',
    patient: 'David Okafor',
    test: 'Blood Glucose',
    status: 'Completed',
    date: '11 Sep 2026',
  },
  {
    id: 'LAB-003',
    patient: 'Chioma Eze',
    test: 'Malaria Parasite Test',
    status: 'Pending',
    date: '11 Sep 2026',
  },
];

const demoAIInsights = [
  {
    title: 'Follow-Up Recommendations',
    count: '12 patients',
    description: 'Review patients whose history and recent clinical activity suggest a follow-up may be appropriate.',
    type: 'Follow-up',
  },
  {
    title: 'Duplicate Patient Detection',
    count: '4 records',
    description: 'Possible duplicate records matched by contact information and demographic details.',
    type: 'Duplicate',
  },
  {
    title: 'Automated Report Summaries',
    count: '8 summaries',
    description: 'Recent patient and laboratory information has been summarized for quick review.',
    type: 'Reports',
  },
  {
    title: 'Incomplete Records',
    count: '7 records',
    description: 'Several records are missing important clinical information and should be reviewed.',
    type: 'Incomplete',
  },
];

const dataStore = {
  patients: [...demoPatients],
  appointments: [...demoAppointments],
  medicines: [...demoMedicines],
  labRequests: [...demoLabRequests],
  aiInsights: [...demoAIInsights],
  consultations: [],
  prescriptions: [],
  staff: [
    {
      id: 'STAFF-001',
      fullName: 'HealthBridge Admin',
      email: 'admin@healthbridge.org',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'Administrator',
      branch: 'Main Centre',
      status: 'Active',
    },
  ],
};

let pool = null;
let databaseAvailable = false;

async function initializeDatabase() {
  const hasDbConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (!hasDbConfig) {
    const message = 'MySQL environment variables are incomplete. DB_HOST, DB_USER, and DB_NAME are required.';
    databaseAvailable = false;
    throw new Error(message);
  }

  try {
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
    });

    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
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
    console.log('✓ MySQL database connection successful and HealthBridge schema initialized.');
    return true;
  } catch (error) {
    databaseAvailable = false;
    console.error('MySQL initialization failed.');
    console.error(error.message);
    throw error;
  }
}

function isFallbackMode() {
  return !databaseAvailable;
}

function getStore() {
  return dataStore;
}

function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
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
  if (isFallbackMode()) {
    return {
      totalPatients: dataStore.patients.length,
      appointments: dataStore.appointments.length,
      lowStockItems: dataStore.medicines.filter((item) => Number(item.quantity ?? item.stock ?? 0) <= 20).length,
      pendingLabRequests: dataStore.labRequests.filter((item) => item.status === 'Pending').length,
    };
  }

  const [patientRows] = await query('SELECT COUNT(*) AS total FROM patients');
  const [appointmentRows] = await query('SELECT COUNT(*) AS total FROM appointments');
  const [lowStockRows] = await query('SELECT COUNT(*) AS total FROM medicines WHERE stock_quantity <= reorder_level');
  const [labRows] = await query("SELECT COUNT(*) AS total FROM lab_requests WHERE status = 'Pending'");

  return {
    totalPatients: Number(patientRows[0]?.total || 0),
    appointments: Number(appointmentRows[0]?.total || 0),
    lowStockItems: Number(lowStockRows[0]?.total || 0),
    pendingLabRequests: Number(labRows[0]?.total || 0),
  };
}

async function findUserByEmail(email) {
  if (!email) {
    return null;
  }

  if (isFallbackMode()) {
    return dataStore.staff.find((member) => member.email.toLowerCase() === email.toLowerCase()) || null;
  }

  const [rows] = await query('SELECT * FROM staff WHERE email = ?', [email.toLowerCase()]);
  return rows[0] || null;
}

module.exports = {
  initializeDatabase,
  isFallbackMode,
  getStore,
  createId,
  testConnection,
  query,
  getDashboardMetrics,
  findUserByEmail,
};
