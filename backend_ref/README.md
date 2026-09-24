# HealthBridge Backend

Express + MySQL backend for the HealthBridge project, implementing the
architecture, database design, and functional requirements described in
Chapter Three of the project documentation, and the module logic
described in Chapter Four.

This is real, runnable code — but it needs to be run in your own
environment (or via Claude Code) since this chat can't host a live
server or persistent database for you.

## 1. Prerequisites

- Node.js 18+ installed
- MySQL 8+ installed and running (locally, or a free-tier cloud instance
  such as Railway, Render, or PlanetScale)

## 2. Setup

```bash
cd healthbridge-backend
npm install
cp .env.example .env
```

Open `.env` and fill in your real database credentials and a random
`JWT_SECRET` (any long random string — you can generate one with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

Create an empty database matching `DB_NAME` in your `.env`, then run:

```bash
npm run db:init
```

This applies `schema.sql` and creates one starter admin account:
- **Staff ID:** `S-ADMIN01`
- **Password:** `ChangeMe123!`

Log in with this once, then use the Admin dashboard's "Manage Staff"
screen (or `POST /api/admin/staff`) to create real accounts for your
receptionists, doctors, pharmacists, and lab staff — and change the
admin password immediately.

## 3. Run it

```bash
npm run dev   # with auto-restart on file changes (nodemon)
# or
npm start     # plain node
```

The API will be running at `http://localhost:5000`. Health check:
`GET http://localhost:5000/api/health`.

## 4. Connect the frontend

Update `FRONTEND_ORIGIN` in `.env` to match wherever you're running the
`HealthBridge_App.jsx` frontend (e.g. `http://localhost:3000` if you
set it up with Create React App or Vite). The frontend artifact
currently runs on mock in-memory data — wiring it to these real
endpoints means replacing the `useState(initialPatients)` etc. calls
with `fetch()` calls to the routes below.

## 5. API Overview

| Module | Method & Route | Requirement |
|---|---|---|
| Auth | `POST /api/auth/login` | — |
| Auth | `POST /api/auth/forgot-password` / `reset-password` | — |
| Reception | `POST /api/patients/check-duplicate` | FR-2, FR-11 (AI) |
| Reception | `POST /api/patients` | FR-1 |
| Reception | `GET /api/patients/search?q=` | FR-2 |
| Reception | `POST /api/appointments` | FR-3 |
| Reception | `GET /api/appointments/followup-recommendations` | FR-12 (AI) |
| Doctor | `GET /api/patients/:id` | FR-15 (cross-branch) |
| Doctor | `POST /api/consultations` | FR-5, FR-13 (AI summary) |
| Doctor | `POST /api/prescriptions` | FR-5 |
| Doctor | `POST /api/lab-tests` | FR-6 |
| Pharmacist | `GET /api/prescriptions/pending` | FR-7 |
| Pharmacist | `POST /api/prescriptions/:id/dispense` | FR-7 (auto inventory) |
| Pharmacist | `GET /api/drugs`, `/api/drugs/low-stock` | FR-8 |
| Lab Staff | `GET /api/lab-tests/pending` | FR-9 |
| Lab Staff | `POST /api/lab-tests/:id/result` | FR-9 (auto-notify doctor) |
| Admin | `POST/GET /api/admin/staff` | FR-10 |
| Admin | `GET /api/admin/analytics` | FR-10 |
| Admin | `GET /api/admin/audit-log` | Section 3.5.2 |

Every route (except login/password-reset) requires an
`Authorization: Bearer <token>` header, and is further restricted by
role using the exact permission matrix from Chapter 3, Table 3.10
(see `middleware/rbac.js`).

## 6. Security notes (Section 3.4.3 / 3.5.2 compliance)

- Passwords are hashed with bcrypt, never stored in plain text.
- JWT-based sessions with configurable expiry (`JWT_EXPIRES_IN`).
- `helmet` sets standard security headers; rate limiting is applied
  globally and more strictly on `/api/auth/login` to slow brute-force attempts.
- All SQL queries use parameterized placeholders (`?`) — never raw
  string concatenation — which is what prevents SQL injection.
- Role-based access control is enforced server-side on every route,
  not just hidden in the frontend UI.

## 7. What's deliberately NOT included

Per the project's own documented scope (Section 1.5) and limitations
(Section 1.6), this backend does not include: NHIA billing integration,
telemedicine/video consultation, real AI diagnostic features, or a
production deployment pipeline. The `AI_API_KEY` in `.env` is optional —
without it, `utils/aiHelpers.js` automatically falls back to the same
rule-based summarizer used in the frontend demo, so the whole system
still runs end-to-end with zero paid API cost.
