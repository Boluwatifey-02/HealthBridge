const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// POST /api/lab-tests — Doctor requests a test (FR-6)
router.post("/", authorize("requestLabTest"), async (req, res) => {
  const { patientId, testType } = req.body;
  const testId = `LT-${uuidv4().slice(0, 6).toUpperCase()}`;
  await pool.query(
    "INSERT INTO lab_tests (test_id, patient_id, doctor_id, test_type) VALUES (?, ?, ?, ?)",
    [testId, patientId, req.user.staffId, testType]
  );
  res.status(201).json({ testId, message: "Lab test requested." });
});

// GET /api/lab-tests/pending — Lab staff queue (FR-9)
router.get("/pending", authorize("viewLabRequests"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT lt.test_id, p.full_name AS patient_name, s.full_name AS doctor_name,
            lt.test_type, lt.status
     FROM lab_tests lt
     JOIN patients p ON lt.patient_id = p.patient_id
     JOIN staff s ON lt.doctor_id = s.staff_id
     WHERE lt.status != 'Completed'
     ORDER BY lt.requested_at ASC`
  );
  res.json(rows);
});

// POST /api/lab-tests/:id/result — FR-9: uploading a result
// automatically notifies the requesting doctor (matches the design
// discussed in Section 4.2.4 — closes the loop that used to depend
// on the patient physically carrying the result back).
router.post("/:id/result", authorize("uploadLabResult"), async (req, res) => {
  const { result } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[test]] = await conn.query("SELECT doctor_id, patient_id FROM lab_tests WHERE test_id = ?", [req.params.id]);
    if (!test) { await conn.rollback(); return res.status(404).json({ error: "Lab test not found." }); }

    await conn.query(
      "UPDATE lab_tests SET result = ?, status = 'Completed', completed_at = NOW() WHERE test_id = ?",
      [result, req.params.id]
    );
    await conn.query(
      "INSERT INTO notifications (notification_id, recipient_staff_id, message) VALUES (?, ?, ?)",
      [uuidv4(), test.doctor_id, `Lab result ready for patient ${test.patient_id} (test ${req.params.id})`]
    );
    await conn.commit();
    res.json({ message: "Result uploaded and doctor notified." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to upload result." });
  } finally {
    conn.release();
  }
});

module.exports = router;
