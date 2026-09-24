require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { testConnection } = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const patientRoutes = require("./routes/patients.routes");
const appointmentRoutes = require("./routes/appointments.routes");
const consultationRoutes = require("./routes/consultations.routes");
const prescriptionRoutes = require("./routes/prescriptions.routes");
const labTestRoutes = require("./routes/labtests.routes");
const drugRoutes = require("./routes/drugs.routes");
const adminRoutes = require("./routes/admin.routes");
const staffRoutes = require("./routes/staff.routes");

const app = express();

// --- Security middleware (matches Chapter 3, Section 3.4.3 non-functional
// requirements, and the security safeguards described in Section 3.5.2) ---
app.use(helmet());                         // sensible security headers
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));   // input size limit

// Basic rate limiting — protects login especially against brute-force.
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(generalLimiter);
app.use("/api/auth/login", loginLimiter);

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/drugs", drugRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "HealthBridge API" }));

// --- Central error handler (catches anything a route didn't handle itself) ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// 404 fallback
app.use((req, res) => res.status(404).json({ error: "Route not found." }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`HealthBridge API running on port ${PORT}`);
  await testConnection();
});
