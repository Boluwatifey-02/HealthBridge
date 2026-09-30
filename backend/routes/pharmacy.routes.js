const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const { idGenerators } = require('../lib/ids');
const { sendList } = require('../lib/listResponse');
const v = require('../lib/validation');

const router = express.Router();
router.use(authenticate, staffOnly);

const MEDICINE_SELECT = `SELECT id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status, branch_id, created_at
                         FROM medicines`;

/**
 * Stock status is derived from the quantities rather than stored, so a manual
 * stock correction can never leave a medicine labelled "In stock" while it is
 * actually below its reorder level.
 */
function deriveStatus(stock, reorderLevel) {
  if (Number(stock) <= 0) return 'Out of stock';
  if (Number(stock) <= Number(reorderLevel)) return 'Low stock';
  return 'In stock';
}

function mapMedicine(row) {
  if (!row) return null;

  const stock = Number(row.stock_quantity || 0);
  const reorderLevel = Number(row.reorder_level || 0);

  return {
    id: row.id,
    name: row.name,
    genericName: row.generic_name || '',
    category: row.generic_name || '',
    stock,
    unit: row.unit || 'units',
    reorderLevel,
    status: deriveStatus(stock, reorderLevel),
    strength: row.dosage || '',
    branch: row.branch_id,
    createdAt: row.created_at,
  };
}

router.get(
  '/',
  authorize('viewInventory'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    // This route used to insert six invented medicines the first time it was
    // opened on an empty database. A read that silently invents inventory makes
    // the stock figures impossible to trust, so an empty database now simply
    // reports an empty inventory.
    const search = v.text(req.query.search, 'Search term', { max: 120 });
    const status = req.query.status
      ? v.oneOf(req.query.status, 'Status', ['In stock', 'Low stock', 'Out of stock'])
      : null;
    const lowOnly = req.query.lowStock === 'true';

    const where = [];
    const params = [];

    if (search) {
      where.push('(name LIKE ? OR generic_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    if (lowOnly === true || status === 'Low stock') {
      where.push('stock_quantity > 0 AND stock_quantity <= reorder_level');
    } else if (status === 'Out of stock') {
      where.push('stock_quantity <= 0');
    } else if (status === 'In stock') {
      where.push('stock_quantity > reorder_level');
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await query(`${MEDICINE_SELECT} ${clause} ORDER BY name ASC`, params);

    const all = rows.map(mapMedicine);

return sendList(req, res, 'medicines', {
      medicines: all,
      total: all.length,
      summary: {
        inStock: all.filter((m) => m.status === 'In stock').length,
        lowStock: all.filter((m) => m.status === 'Low stock').length,
        outOfStock: all.filter((m) => m.status === 'Out of stock').length,
      },
    });
  })
);

router.get(
  '/:id',
  authorize('viewInventory'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${MEDICINE_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);

    if (!rows.length) {
      throw ApiError.notFound('That medicine was not found.');
    }

    return res.json(mapMedicine(rows[0]));
  })
);

router.post(
  '/',
  authorize('manageInventory'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const name = v.text(body.name, 'Medicine name', { required: true, max: 120 });
    const genericName = v.text(body.genericName || body.category, 'Generic name', { max: 120 });
    const dosage = v.text(body.dosage || body.strength, 'Dosage', { max: 80 });
    const unit = v.text(body.unit, 'Unit', { max: 50, fallback: 'units' });
    const stock = v.integer(body.stock ?? body.quantity, 'Stock quantity', { min: 0, max: 1000000, fallback: 0 });
    const reorderLevel = v.integer(body.reorderLevel ?? body.reorder_level, 'Reorder level', {
      min: 0,
      max: 1000000,
      fallback: 0,
    });

    const [existing] = await query('SELECT id FROM medicines WHERE name = ? LIMIT 1', [name]);

    if (existing.length) {
      throw ApiError.conflict(`${name} is already in the inventory.`);
    }

    const id = idGenerators.medicine();

    await query(
      `INSERT INTO medicines
        (id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, genericName, dosage, stock, reorderLevel, unit, deriveStatus(stock, reorderLevel), req.user.branch || 1]
    );

    await recordAudit(req.user, 'CREATE_MEDICINE', `Added ${name} to the pharmacy inventory.`, {
      entity: 'medicine',
      entityId: id,
    });

    const [rows] = await query(`${MEDICINE_SELECT} WHERE id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapMedicine(rows[0]));
  })
);

router.put(
  '/:id',
  authorize('manageInventory'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM medicines WHERE id = ? LIMIT 1', [req.params.id]);

    if (!existing.length) {
      throw ApiError.notFound('That medicine was not found.');
    }

    const before = existing[0];
    const body = req.body || {};

    const name = body.name !== undefined
      ? v.text(body.name, 'Medicine name', { required: true, max: 120 })
      : before.name;
    const genericName = body.genericName !== undefined
      ? v.text(body.genericName, 'Generic name', { max: 120 })
      : before.generic_name;
    const dosage = body.dosage !== undefined
      ? v.text(body.dosage, 'Dosage', { max: 80 })
      : before.dosage;
    const unit = body.unit !== undefined ? v.text(body.unit, 'Unit', { max: 50 }) : before.unit;
    const reorderLevel = body.reorderLevel !== undefined
      ? v.integer(body.reorderLevel, 'Reorder level', { min: 0, max: 1000000 })
      : Number(before.reorder_level || 0);
    const stock = body.stock !== undefined
      ? v.integer(body.stock, 'Stock quantity', { min: 0, max: 1000000 })
      : Number(before.stock_quantity || 0);

    // A stock correction is a deliberate physical count, so it is accepted as
    // an absolute figure rather than a delta.
    await query(
      `UPDATE medicines
          SET name = ?, generic_name = ?, dosage = ?, unit = ?, stock_quantity = ?,
              reorder_level = ?, status = ?
        WHERE id = ?`,
      [name, genericName, dosage, unit, stock, reorderLevel, deriveStatus(stock, reorderLevel), req.params.id]
    );

    const stockChanged = Number(before.stock_quantity) !== stock;

    await recordAudit(
      req.user,
      'UPDATE_MEDICINE',
      stockChanged
        ? `Corrected ${name} stock from ${Number(before.stock_quantity)} to ${stock}.`
        : `Updated details for ${name}.`,
      { entity: 'medicine', entityId: req.params.id }
    );

    const [rows] = await query(`${MEDICINE_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapMedicine(rows[0]));
  })
);

module.exports = router;
module.exports.mapMedicine = mapMedicine;
module.exports.deriveStatus = deriveStatus;
