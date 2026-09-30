require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { initializeDatabase, isFallbackMode, getDatabaseError, query } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const passwordResetRoutes = require('./routes/passwordReset.routes');
const patientRoutes = require('./routes/patients.routes');
const appointmentRoutes = require('./routes/appointments.routes');
const consultationRoutes = require('./routes/consultations.routes');
const prescriptionRoutes = require('./routes/prescriptions.routes');
const pharmacyRoutes = require('./routes/pharmacy.routes');
const labRoutes = require('./routes/lab.routes');
const aiRoutes = require('./routes/ai.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const adminRoutes = require('./routes/admin.routes');
const staffRoutes = require('./routes/staff.routes');

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not configured. Refusing to start with an insecure default secret.');
  process.exit(1);
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
};

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
});

// Reset endpoints are rate limited harder: a request mints a usable token.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);

app.get('/api/health', (req, res) => {
  const healthy = !isFallbackMode();
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'HealthBridge backend',
    database: healthy ? 'mysql' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/lab-requests', labRoutes);
app.use('/api/ai-insights', aiRoutes);
app.use('/api/dashboard-summary', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use(errorHandler);

const DEFAULT_STAFF_ACCOUNTS = [
  {
    id: 'STAFF-001',
    fullName: 'HealthBridge Administrator',
    email: 'admin@healthbridge.org',
    password: process.env.SEED_ADMIN_PASSWORD,
    role: 'Administrator',
  },
  {
    id: 'STAFF-002',
    fullName: 'Dr. Adebisi Okafor',
    email: 'doctor@healthbridge.org',
    password: process.env.SEED_DOCTOR_PASSWORD,
    role: 'Doctor',
  },
  {
    id: 'STAFF-003',
    fullName: 'Ngozi Reception',
    email: 'reception@healthbridge.org',
    password: process.env.SEED_RECEPTION_PASSWORD,
    role: 'Receptionist',
  },
];

async function seedStaffAccounts() {
  if (!process.env.SEED_STAFF) {
    console.log('Staff seeding disabled. Set SEED_STAFF=true to create default accounts.');
    return;
  }

  for (const account of DEFAULT_STAFF_ACCOUNTS) {
    if (!account.password) {
      console.warn(`Skipping seed for ${account.email}: no seed password configured.`);
      continue;
    }

    const [existingRows] = await query('SELECT id FROM staff WHERE email = ? LIMIT 1', [account.email]);

    if (existingRows.length) {
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password, 10);

    await query(
      `INSERT INTO staff (id, full_name, email, password_hash, role, branch_id, status)
       VALUES (?, ?, ?, ?, ?, 1, 'Active')
       ON DUPLICATE KEY UPDATE email = VALUES(email)`,
      [account.id, account.fullName, account.email, passwordHash, account.role]
    );

    console.log(`Seeded ${account.role} account: ${account.email}`);
  }
}

async function startServer() {
  const databaseReady = await initializeDatabase();

  if (!databaseReady) {
    console.error('HealthBridge could not connect to MySQL.');
    console.error(`Database error: ${getDatabaseError() || 'unknown'}`);
    process.exit(1);
  }

  await seedStaffAccounts();

  app.listen(PORT, () => {
    console.log(`HealthBridge backend listening on port ${PORT}`);
  });
}

startServer();