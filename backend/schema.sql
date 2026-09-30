CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
  id VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Receptionist', 'Doctor', 'Pharmacist', 'Laboratory Staff', 'Administrator') NOT NULL,
  phone VARCHAR(40),
  branch_id INT,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  age INT,
  gender VARCHAR(20),
  phone VARCHAR(50),
  address VARCHAR(255),
  blood_group VARCHAR(10),
  allergies VARCHAR(255),
  `condition` VARCHAR(255),
  status VARCHAR(40) DEFAULT 'Active',
  last_visit DATE,
  branch_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50),
  doctor_id VARCHAR(50),
  provider VARCHAR(150),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason VARCHAR(255),
  status ENUM('Scheduled', 'Confirmed', 'Pending', 'Completed', 'Cancelled') DEFAULT 'Scheduled',
  notes TEXT,
  branch_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES staff(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS consultations (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL,
  doctor_id VARCHAR(50) NOT NULL,
  consultation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  complaint TEXT,
  diagnosis TEXT,
  treatment TEXT,
  notes TEXT,
  follow_up VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS medicines (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  generic_name VARCHAR(120),
  dosage VARCHAR(80),
  stock_quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  status VARCHAR(40) DEFAULT 'In stock',
  branch_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL,
  doctor_id VARCHAR(50) NOT NULL,
  consultation_id VARCHAR(50),
  medicine_name VARCHAR(120) NOT NULL,
  dosage VARCHAR(80),
  frequency VARCHAR(80),
  duration VARCHAR(80),
  quantity INT NOT NULL DEFAULT 0,
  instructions TEXT,
  status ENUM('Pending', 'Dispensed', 'Cancelled') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES staff(id),
  FOREIGN KEY (consultation_id) REFERENCES consultations(id)
);

CREATE TABLE IF NOT EXISTS lab_requests (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL,
  doctor_id VARCHAR(50),
  test_name VARCHAR(150) NOT NULL,
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Pending', 'Completed', 'Cancelled') DEFAULT 'Pending',
  priority VARCHAR(30) DEFAULT 'Routine',
  notes TEXT,
  branch_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES staff(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS lab_results (
  id VARCHAR(50) PRIMARY KEY,
  lab_request_id VARCHAR(50) NOT NULL,
  result_text TEXT,
  lab_staff_id VARCHAR(50),
  result_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(40) DEFAULT 'Completed',
  notes TEXT,
  FOREIGN KEY (lab_request_id) REFERENCES lab_requests(id),
  FOREIGN KEY (lab_staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(50) PRIMARY KEY,
  actor_id VARCHAR(50),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS patient_documents (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL,
  document_type VARCHAR(120),
  file_name VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Only the SHA-256 hash of a reset token is stored, so a database leak cannot be
-- replayed as a working reset link. One active token per staff member: issuing a
-- new request invalidates any earlier one.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(50) PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_password_reset_token_hash (token_hash),
  KEY idx_password_reset_staff (staff_id)
);

INSERT INTO branches (id, name, location)
SELECT 1, 'Main Centre', 'Lagos'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE id = 1);
