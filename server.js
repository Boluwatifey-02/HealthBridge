require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase, isFallbackMode } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
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
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
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

app.use(generalLimiter);
app.use('/api/auth/login', loginLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HealthBridge backend',
    mode: 'mysql',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
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

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`HealthBridge backend running on port ${PORT}`);
      console.log('Live MySQL database mode enabled.');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
