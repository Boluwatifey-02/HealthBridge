const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// POST /api/prescriptions — Doctor writes a prescription (FR-5)
router.post("/", authorize("writePrescription"), async (req, res) => {
  const { patientId, items } = req.body; // items: [{ drugId, dosage, quantity }]
  const doctorId = req.user.staffId;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const prescriptionId = `RX-${uuidv4().slice(0, 6).toUpperCase()}`;
    await conn.query(
      "INSERT INTO prescriptions (prescription_id, patient_id, doctor_id) VALUES (?, ?, ?)",
      [prescriptionId, patientId, doctorId]
    );
    for (const item of items) {
      const itemId = `PI-${uuidv4().slice(0, 6).toUpperCase()}`;
      await conn.query(
        "INSERT INTO prescription_items (item_id, prescription_id, drug_id, dosage, quantity) VALUES (?, ?, ?, ?, ?)",
        [itemId, prescriptionId, item.drugId, item.dosage, item.quantity]
      );
    }
    await conn.commit();
    res.status(201).json({ prescriptionId, message: "Prescription created — now visible to pharmacy." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to create prescription." });
  } finally {
    conn.release();
  }
});

// GET /api/prescriptions/pending — Pharmacist's queue (FR-7)
router.get("/pending", authorize("viewPrescriptions"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT rx.prescription_id, p.full_name AS patient_name, s.full_name AS doctor_name,
            rx.status, rx.created_at
     FROM prescriptions rx
     JOIN patients p ON rx.patient_id = p.patient_id
     JOIN staff s ON rx.doctor_id = s.staff_id
     WHERE rx.status = 'Pending'
     ORDER BY rx.created_at ASC`
  );
  res.json(rows);
});

// POST /api/prescriptions/:id/dispense — FR-7: automatically
// decrements inventory, matching the design in Section 4.2.3.
router.post("/:id/dispense", authorize("dispenseDrug"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query(
      "SELECT * FROM prescription_items WHERE prescription_id = ?",
      [req.params.id]
    );

    for (const item of items) {
      const [[drug]] = await conn.query("SELECT stock_quantity FROM drugs WHERE drug_id = ? FOR UPDATE", [item.drug_id]);
      if (!drug || drug.stock_quantity < item.quantity) {
        await conn.rollback();
        return res.status(409).json({ error: `Insufficient stock for drug ${item.drug_id}.` });
      }
      await conn.query(
        "UPDATE drugs SET stock_quantity = stock_quantity - ? WHERE drug_id = ?",
        [item.quantity, item.drug_id]
      );
    }

    await conn.query("UPDATE prescriptions SET status = 'Dispensed' WHERE prescription_id = ?", [req.params.id]);
    await conn.commit();
    res.json({ message: "Prescription dispensed and inventory updated." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to dispense prescription." });
  } finally {
    conn.release();
  }
});

module.exports = router;
