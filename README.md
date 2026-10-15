# HealthBridge: Electronic Health Record & Management System for Primary Healthcare Centres

> **Final-Year Computer Science Project**  
> *"An AI-powered electronic health record and health management system for enhancing healthcare delivery in Nigerian primary healthcare centres."*

---

## 1. Project Purpose & Objectives

In many primary healthcare centres (PHCs) across Nigeria, patient records, consultations, prescriptions, and laboratory orders are managed using paper folders and manual registers. This results in missing histories, duplicate patient files, uncoordinated drug dispensing, and lost clinical follow-ups.

**HealthBridge** is an integrated, web-based Electronic Health Record (EHR) and healthcare operations management platform designed to address these challenges. Its core objectives are:
1. **Centralized Patient Management**: Digitally register, index, search, and manage longitudinal health records for patients across departments.
2. **Clinical Workflow Orchestration**: Streamline patient queuing, medical consultations, diagnostic orders, and follow-up scheduling.
3. **Pharmacy & Inventory Control**: Track pharmaceutical stock levels, automatically decrement inventory upon dispensing, and derive reorder alerts.
4. **Laboratory Workflow Integration**: Manage lab test requests, record structured test findings, and automatically transition request statuses.
5. **Role-Based Access Control (RBAC)**: Ensure strict data privacy by restricting access based on clinical and administrative responsibilities.
6. **Honest, Evidence-Based Clinical Insights**: Provide transparent, rule-based algorithmic intelligence over EHR data without fabricating diagnoses or relying on opaque external APIs.

---

## 2. System Architecture

HealthBridge is architected as a decoupled, multi-tier web application communicating over secure HTTPS/TLS:

```
[ Web Browser ]
      |
      | HTTPS (CORS-restricted)
      v
[ Frontend: React + Vite (Vercel) ]
      |
      | REST API requests with JWT Bearer Token
      v
[ Backend: Node.js + Express (Render) ]
      |  - Helmet security headers & rate limiting
      |  - BCrypt password hashing & JWT auth
      |  - Server-side RBAC & validation
      |
      | MySQL over TLS (minVersion TLSv1.2, CA validation)
      v
[ Managed Database: MySQL (Aiven) / Localhost ]
```

---

## 3. Technology Stack

- **Frontend**:
  - React 19, Vite 5.4.0
  - JavaScript (ES Modules)
  - Custom Responsive CSS (Burgundy `#800020`, Cream `#fdfbf7`, Gold `#d4af37`, Charcoal `#2b2b2b`)
  - `lucide-react` (icons)
  - `recharts` (analytical data visualization)
- **Backend**:
  - Node.js 22+, Express 4
  - RESTful API with JSON envelopes
  - `bcrypt` (password hashing with 10 salt rounds)
  - `jsonwebtoken` (JWT bearer authentication with role/audience claims)
  - `helmet` (security headers) & `express-rate-limit` (brute-force mitigation)
  - `mysql2/promise` (connection pooling with keep-alive and parameterization)
- **Database**:
  - MySQL 8.0 (InnoDB engine, strict foreign key constraints)
- **Hosting & Infrastructure**:
  - Frontend: Vercel Production Deployment
  - Backend: Render Web Service
  - Database: Aiven Managed MySQL (Production) / Local MySQL 8.0 (Development)

---

## 4. Frontend & Backend Directory Structure

```
HealthBridge/
├── backend/
│   ├── config/
│   │   ├── db.js             # MySQL pool initialization, keep-alive, retries
│   │   ├── ensureSchema.js   # Automated table creation and schema validation
│   │   └── settings.js       # Environment and TLS certificate resolution
│   ├── lib/
│   │   ├── audit.js          # Audit logging subsystem
│   │   ├── http.js           # Standard HTTP error classes and async handler
│   │   └── validation.js     # Server-side schema sanitization and validation
│   ├── middleware/
│   │   ├── auth.js           # JWT verification and staff/patient audience gating
│   │   ├── errorHandler.js   # Centralized error handler with safe client responses
│   │   └── rbac.js           # Role-based access control matrix enforcement
│   ├── routes/
│   │   ├── admin.routes.js   # Staff accounts and audit log inspection
│   │   ├── ai.routes.js      # Rule-based clinical and administrative signals
│   │   ├── appointments.routes.js # Appointment booking, updates, status filtering
│   │   ├── auth.routes.js    # Staff login and profile inspection
│   │   ├── consultations.routes.js # Clinical notes, vitals, diagnoses
│   │   ├── contact.routes.js # Public contact submissions
│   │   ├── dashboard.routes.js # Real-time aggregated clinic metrics
│   │   ├── lab.routes.js     # Laboratory test requests and results
│   │   ├── passwordReset.routes.js # Staff password reset token lifecycle
│   │   ├── patientAuth.routes.js # Patient portal authentication & self-registration
│   │   ├── patientPasswordReset.routes.js # Patient portal password recovery
│   │   ├── patients.routes.js # Patient CRUD, search, and clinical timeline
│   │   ├── pharmacy.routes.js # Medicine catalog, inventory updates, low stock
│   │   ├── prescriptions.routes.js # Prescription issuance and dispensing
│   │   └── staff.routes.js   # Active staff provider directory
│   ├── scripts/
│   │   ├── acceptanceTest.js # 119 automated end-to-end API verification checks
│   │   ├── inspectDatabase.js # Row counts and status distributions
│   │   └── seedDemonstrationData.js # Deterministic, idempotent demo dataset
│   ├── schema.sql            # Master DDL schema
│   └── server.js             # Express application entrypoint
├── frontend/
│   ├── src/
│   │   ├── assets/           # Logos and graphic assets
│   │   ├── components/       # Shared UI components (Hero, Nav, Brand, FAQ, etc.)
│   │   ├── layouts/          # PublicLayout and ApplicationLayout
│   │   ├── pages/            # Role pages (Dashboard, Patients, Pharmacy, Lab, AI, etc.)
│   │   ├── services/         # Axios/fetch API client wrappers
│   │   ├── App.jsx           # Root application state and navigation controller
│   │   ├── index.css         # Design system tokens and global typography
│   │   └── main.jsx          # React DOM entrypoint
│   └── vite.config.js        # Vite bundler configuration
├── deploy/
│   ├── deploy-backend.js     # Automated Render service synchronization
│   ├── deploy-frontend.js    # Verified Vercel build and aliasing workflow
│   ├── checkDatabase.cjs     # Database connectivity and row count prober
│   └── render-secrets.env.example # Environment variable template
└── package.json              # Monorepo root scripts and dependencies
```

---

## 5. Database Schema & Key Relationships

The schema is defined in [backend/schema.sql](file:///c:/Users/HP/Desktop/HealthBridge/backend/schema.sql) with full relational integrity:

1. **`branches`**: Primary care facility branch locations.
2. **`staff`**: Clinic workers with roles (`Administrator`, `Doctor`, `Receptionist`, `Pharmacist`, `Laboratory Staff`), bcrypt password hash, and active/inactive status.
3. **`patients`**: Full demographic, contact, and medical baseline data (`allergies`, `condition`, `blood_group`, `genotype`).
4. **`appointments`**: Patient consultations with foreign keys to `patients` and `staff` (provider), with `appointment_date`, `appointment_time`, and `status`.
5. **`consultations`**: Clinical encounters recording chief complaint, examination notes, vitals, diagnosis, treatment, and follow-up instructions.
6. **`prescriptions`**: Drug orders linked to `consultations` and `patients`.
7. **`prescription_items`**: Individual medications, dosages, frequency, and dispensing status.
8. **`medicines`**: Pharmacy catalog with unit pricing, `stock_quantity`, and `reorder_level`.
9. **`lab_requests`**: Diagnostic test requests created by clinicians.
10. **`lab_results`**: Structured test findings, abnormal flags, and technician notes.
11. **`audit_logs`**: Tamper-evident logging of administrative, authentication, and clinical data modifications.
12. **`password_reset_tokens`**: SHA-256 hashed single-use tokens with 30-minute expiration.

---

## 6. Authentication & User Roles

- **Staff Authentication**:
  - Email + Password verified via `bcrypt.compare`.
  - Generates signed JWT with 8-hour expiry and `audience: 'staff'`.
  - Roles enforced via `middleware/rbac.js`:
    - **Administrator**: Staff management, facility analytics, system audit logs.
    - **Receptionist**: Patient registration, demographic search, appointment scheduling.
    - **Doctor**: Clinical consultations, medical history review, prescribing, lab orders.
    - **Pharmacist**: Prescription review, medicine dispensing, inventory stock control.
    - **Laboratory Staff**: Test specimen intake, result recording, diagnostic reporting.
- **Patient Portal Authentication**:
  - Patient self-registration creates patient profile and linked credentials.
  - Generates signed JWT with `audience: 'patient'`.
  - Gated to personal health timeline, prescriptions, and lab results only.

---

## 7. AI Implementation: Honest Clinical Signals

Unlike black-box LLMs that risk hallucinating medical facts or failing due to upstream API quotas, HealthBridge implements **transparent, rule-based clinical intelligence** in [backend/routes/ai.routes.js](file:///c:/Users/HP/Desktop/HealthBridge/backend/routes/ai.routes.js):
- **Reviews Due**: Scans active patients with last clinic visits older than 90 days.
- **Duplicate Records**: Identifies conflicting records sharing identical normalized phone numbers.
- **Incomplete Records**: Flags missing allergies, baseline vitals, or residential addresses.
- **Abnormal Lab Results**: Pattern-matches critical laboratory markers (`positive`, `elevated`, `abnormal`, `high`, `nitrite +`, `hbsag`).
- **Unattended Follow-up**: Detects consultation follow-up dates without corresponding scheduled appointments.
- **Workload Gaps**: Computes real-time queues for pending lab tests and un-dispensed prescriptions.

The API explicitly reports `method: 'rule-based analysis of the HealthBridge database'` and `isMachineLearning: false` with clinical disclaimers.

---

## 8. Local Setup & Testing

### Prerequisites
- Node.js 18+ (tested on Node v22.20.0)
- MySQL 8.0+ running locally

### Installation
```bash
# 1. Install root dependencies
npm install

# 2. Configure backend environment
cd backend
cp .env.example .env
# Edit .env with your local MySQL credentials:
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=healthbridge
# JWT_SECRET=your_random_secret_string

# 3. Seed demonstration data
node scripts/seedDemonstrationData.js

# 4. Start backend server
node server.js
# Runs at http://localhost:5000 (Health check: http://localhost:5000/api/health)

# 5. Start frontend development server
cd ../frontend
npm run dev
# Runs at http://localhost:5173
```

### Running Test Suites
```bash
# Run complete 119-test backend API acceptance suite:
npm run test:api

# Run local API integration suite:
node test-local-api.cjs
```

---

## 9. Deployment Architecture

- **Production Frontend**: Vercel (`https://healthbridge-boluwatife-ayomides-projects.vercel.app`)
  - Continuous integration via `node deploy/deploy-frontend.js`.
  - Inlines `VITE_API_URL` pointing to Render API.
- **Production Backend**: Render (`https://healthbridge-backend-5c3b.onrender.com`)
  - Node.js web service running from `master` branch `backend/` root directory.
  - Protected with HTTPS, rate limiting, and CORS restrictions.
- **Production Database**: Aiven MySQL over TLS
  - Managed MySQL 8.0 instance with mandatory SSL/TLS certificate verification.
