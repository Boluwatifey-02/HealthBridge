const express = require('express');

const { query, getConnection, isFallbackMode } = require('../config/db');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const { idGenerators } = require('../lib/ids');
const { sendList } = require('../lib/listResponse');
const v = require('../lib/validation');

const router = express.Router();
router.use(authenticate, staffOnly);

const PRESCRIPTION_SELECT = `SELECT rx.id, rx.patient_id, rx.doctor_id, rx.consultation_id,
                                     rx.medicine_name, rx.dosage, rx.frequency, rx.duration,
                                     rx.quantity, rx.instructions, rx.status, rx.created_at,
                                     p.full_name AS patient_name,
                                     d.full_name AS doctor_name
                              FROM prescriptions rx
                              LEFT JOIN patients p ON p.id = rx.patient_id
                              LEFT JOIN staff d ON d.id = rx.doctor_id`;

function mapPrescription(row) {
  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id || '',
    patient: row.patient_name || 'Unknown patient',
    doctorId: row.doctor_id || '',
    doctor: row.doctor_name || '',
    consultationId: row.consultation_id || '',
    medicineName: row.medicine_name,
    dosage: row.dosage || '',
    frequency: row.frequency || '',
    duration: row.duration || '',
    quantity: Number(row.quantity || 0),
    instructions: row.instructions || '',
    status: row.status || 'Pending',
    createdAt: row.created_at,
  };
}

router.get(
  '/',
  authorize('viewPrescriptions'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const status = req.query.status ? v.oneOf(req.query.status, 'Status', ['Pending', 'Dispensed', 'Cancelled']) : null;
    const patientId = v.text(req.query.patientId, 'Patient id', { max: 50 });
    const search = v.text(req.query.search, 'Search term', { max: 120 });
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 200, fallback: 100 });

    const where = [];
    const params = [];

    if (status) {
      where.push('rx.status = ?');
      params.push(status);
    }
    if (patientId) {
      where.push('rx.patient_id = ?');
      params.push(patientId);
    }
    if (search) {
      where.push('(rx.medicine_name LIKE ? OR p.full_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await query(
      `${PRESCRIPTION_SELECT} ${clause} ORDER BY rx.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM prescriptions rx
         LEFT JOIN patients p ON p.id = rx.patient_id ${clause}`,
      params
    );

return sendList(req, res, 'prescriptions', {
      prescriptions: rows.map(mapPrescription),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    });
  })
);

router.get(
  '/:id',
  authorize('viewPrescriptions'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${PRESCRIPTION_SELECT} WHERE rx.id = ? LIMIT 1`, [req.params.id]);

    if (!rows.length) {
      throw ApiError.notFound('That prescription was not found.');
    }

    return res.json(mapPrescription(rows[0]));
  })
);

router.post(
  '/',
  authorize('writePrescription'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const patientId = v.text(body.patientId, 'Patient', { required: true, max: 50 });
    const medicineName = v.text(body.medicineName, 'Medicine name', { required: true, max: 120 });
    const dosage = v.text(body.dosage, 'Dosage', { required: true, max: 80 });
    const frequency = v.text(body.frequency, 'Frequency', { required: true, max: 80 });
    const duration = v.text(body.duration, 'Duration', { required: true, max: 80 });
    const quantity = v.integer(body.quantity, 'Quantity', { required: true, min: 1, max: 100000 });
    const instructions = v.longText(body.instructions, 'Instructions');
    const consultationId = v.text(body.consultationId || body.consultation_id, 'Consultation id', { max: 50 });
    const doctorId = v.text(body.doctorId || body.doctor_id, 'Doctor id', {
      max: 50,
      fallback: req.user.id,
    });

    const [patientRows] = await query('SELECT id FROM patients WHERE id = ? LIMIT 1', [patientId]);

    if (!patientRows.length) {
      throw ApiError.notFound('That patient was not found.');
    }

    const [doctorRows] = await query('SELECT id FROM staff WHERE id = ? AND status = ? LIMIT 1', [
      doctorId,
      'Active',
    ]);

    if (!doctorRows.length) {
      throw ApiError.badRequest('The selected doctor is not an active staff member.');
    }

    // A prescription should trace back to the consultation that justified it.
    if (consultationId) {
      const [linkRows] = await query(
        'SELECT id FROM consultations WHERE id = ? AND patient_id = ? LIMIT 1',
        [consultationId, patientId]
      );

      if (!linkRows.length) {
        throw ApiError.badRequest('That consultation does not belong to this patient.');
      }
    }

    const id = idGenerators.prescription();

    await query(
      `INSERT INTO prescriptions
        (id, patient_id, doctor_id, consultation_id, medicine_name, dosage, frequency, duration, quantity, instructions, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [id, patientId, doctorId, consultationId || null, medicineName, dosage, frequency, duration, quantity, instructions]
    );

    await recordAudit(req.user, 'CREATE_PRESCRIPTION', `Issued a prescription for ${medicineName}.`, {
      entity: 'prescription',
      entityId: id,
    });

    const [rows] = await query(`${PRESCRIPTION_SELECT} WHERE rx.id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapPrescription(rows[0]));
  })
);

/**
 * Dispense a prescription and reduce the matching stock.
 *
 * This did not exist at all before: prescriptions could be created but nothing
 * ever moved them to "Dispensed" and inventory never changed, so the pharmacy
 * figures on the dashboard were static no matter how much was handed out.
 *
 * The stock update and the status change run inside one transaction, because a
 * prescription marked dispensed while the stock decrement was rolled back would
 * record that a patient received medicine that was never taken off the shelf.
 */
router.post(
  '/:id/dispense',
  authorize('dispenseDrug'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM prescriptions WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);

    if (!existing.length) {
      throw ApiError.notFound('That prescription was not found.');
    }

    const prescription = existing[0];

    if (prescription.status === 'Dispensed') {
      throw ApiError.conflict('That prescription has already been dispensed.');
    }

    if (prescription.status === 'Cancelled') {
      throw ApiError.conflict('That prescription was cancelled and cannot be dispensed.');
    }

    const [inventory] = await query(
      'SELECT id, name, stock_quantity FROM medicines WHERE name = ? ORDER BY stock_quantity DESC LIMIT 1',
      [prescription.medicine_name]
    );

    if (!inventory.length) {
      throw ApiError.badRequest(
        `${prescription.medicine_name} is not in the inventory, so it cannot be dispensed. Add it to the pharmacy first.`
      );
    }

    const stock = inventory[0];

    if (Number(stock.stock_quantity) < Number(prescription.quantity)) {
      throw ApiError.conflict(
        `Only ${Number(stock.stock_quantity)} of ${prescription.medicine_name} remain in stock, but ${Number(prescription.quantity)} is required.`
      );
    }

    const connection = await getConnection();
    const requested = req.body || {};

    try {
      await connection.beginTransaction();

      // Re-check under the lock: two pharmacists dispensing at the same moment
      // must not both pass the stock test above and over-draw the shelf.
      const [locked] = await connection.query(
        'SELECT stock_quantity FROM medicines WHERE id = ? FOR UPDATE',
        [stock.id]
      );

      if (Number(locked[0].stock_quantity) < Number(prescription.quantity)) {
        await connection.rollback();
        throw ApiError.conflict(
          `Only ${Number(locked[0].stock_quantity)} of ${prescription.medicine_name} remain in stock.`
        );
      }

      await connection.query(
        `UPDATE medicines
            SET stock_quantity = stock_quantity - ?,
                status = CASE WHEN (stock_quantity - ?) <= reorder_level THEN 'Low stock' ELSE 'In stock' END
          WHERE id = ?`,
        [prescription.quantity, prescription.quantity, stock.id]
      );

      await connection.query(
        "UPDATE prescriptions SET status = 'Dispensed' WHERE id = ? AND status = 'Pending'",
        [req.params.id]
      );

      await connection.commit();
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Dispense rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      connection.release();
    }

    const dispensedAt = v.dateTime(requested.dispensedAt, 'Dispensed at', {
      fallback: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    await recordAudit(
      req.user,
      'DISPENSE_DRUG',
      `Dispensed ${Number(prescription.quantity)} of ${prescription.medicine_name}.`,
      { entity: 'prescription', entityId: req.params.id }
    );

    const [rows] = await query(`${PRESCRIPTION_SELECT} WHERE rx.id = ? LIMIT 1`, [req.params.id]);

    return res.json({
      ...mapPrescription(rows[0]),
      dispensedAt,
      remainingStock: Number(stock.stock_quantity) - Number(prescription.quantity),
    });
  })
);

router.post(
  '/:id/cancel',
  authorize('cancelPrescription'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT id, status FROM prescriptions WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);

    if (!existing.length) {
      throw ApiError.notFound('That prescription was not found.');
    }

    if (existing[0].status === 'Dispensed') {
      throw ApiError.conflict('A prescription that has already been dispensed cannot be cancelled.');
    }

    await query("UPDATE prescriptions SET status = 'Cancelled' WHERE id = ?", [req.params.id]);
    await recordAudit(req.user, 'CANCEL_PRESCRIPTION', 'Cancelled a prescription.', {
      entity: 'prescription',
      entityId: req.params.id,
    });

    const [rows] = await query(`${PRESCRIPTION_SELECT} WHERE rx.id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapPrescription(rows[0]));
  })
);

module.exports = router;
module.exports.mapPrescription = mapPrescription;
