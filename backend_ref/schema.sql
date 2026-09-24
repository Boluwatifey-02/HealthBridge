-- ============================================================
-- HealthBridge Database Schema
-- Matches the database design in Chapter 3, Section 3.6 of the
-- project documentation. Run this once against an empty MySQL
-- database (e.g. `mysql -u root -p healthbridge_db < schema.sql`).
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_branch (
  branch_id   VARCHAR(20) PRIMARY KEY,
  branch_name VARCHAR(120) NOT NULL,
  address     VARCHAR(255),
  state       VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id      VARCHAR(20) PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  role          ENUM('Receptionist','Doctor','Pharmacist','Lab Staff','Admin') NOT NULL,
  phone_number  VARCHAR(30),
  branch_id     VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES hospital_branch(branch_id)
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id     VARCHAR(20) PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  date_of_birth  DATE NOT NULL,
  gender         ENUM('Male','Female') NOT NULL,
  phone_number   VARCHAR(30),
  address        VARCHAR(255),
  allergies      VARCHAR(255) DEFAULT 'None recorded',
  branch_id      VARCHAR(20),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES hospital_branch(branch_id),
  INDEX idx_patient_name (full_name),
  INDEX idx_patient_phone (phone_number)
);

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id   VARCHAR(20) PRIMARY KEY,
  patient_id       VARCHAR(20) NOT NULL,
  doctor_id        VARCHAR(20) NOT NULL,
  appointment_date DATETIME NOT NULL,
  status           ENUM('Booked','Completed','Missed','Cancelled') DEFAULT 'Booked',
  reminder_sent    BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES staff(staff_id),
  -- Prevents the exact conflict test case from Chapter 4, Table 4.1 (test case 3):
  -- one doctor cannot be double-booked at the same date/time.
  UNIQUE KEY uq_doctor_slot (doctor_id, appointment_date)
);

CREATE TABLE IF NOT EXISTS medical_records (
  record_id   VARCHAR(20) PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL,
  doctor_id   VARCHAR(20) NOT NULL,
  diagnosis   VARCHAR(120),
  notes       TEXT,
  ai_summary  TEXT,
  record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id VARCHAR(20) PRIMARY KEY,
  patient_id      VARCHAR(20) NOT NULL,
  doctor_id       VARCHAR(20) NOT NULL,
  status          ENUM('Pending','Dispensed') DEFAULT 'Pending',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS drugs (
  drug_id        VARCHAR(20) PRIMARY KEY,
  drug_name      VARCHAR(120) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  unit_price     DECIMAL(10,2) DEFAULT 0,
  branch_id      VARCHAR(20),
  reorder_level  INT DEFAULT 20,
  FOREIGN KEY (branch_id) REFERENCES hospital_branch(branch_id)
);

CREATE TABLE IF NOT EXISTS prescription_items (
  item_id         VARCHAR(20) PRIMARY KEY,
  prescription_id VARCHAR(20) NOT NULL,
  drug_id         VARCHAR(20) NOT NULL,
  dosage          VARCHAR(120),
  quantity        INT NOT NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id),
  FOREIGN KEY (drug_id) REFERENCES drugs(drug_id)
);

CREATE TABLE IF NOT EXISTS lab_tests (
  test_id     VARCHAR(20) PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL,
  doctor_id   VARCHAR(20) NOT NULL,
  test_type   VARCHAR(120) NOT NULL,
  result      TEXT,
  status      ENUM('Requested','In Progress','Completed') DEFAULT 'Requested',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id VARCHAR(20) PRIMARY KEY,
  recipient_staff_id VARCHAR(20) NOT NULL,
  message         VARCHAR(255) NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id     VARCHAR(20) PRIMARY KEY,
  actor      VARCHAR(120) NOT NULL,
  action     VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed a starter branch so the app has somewhere to register staff/patients against.
INSERT IGNORE INTO hospital_branch (branch_id, branch_name, address, state)
VALUES ('BR-001', 'Ikeja PHC', '1 Sample Road, Ikeja', 'Lagos');
