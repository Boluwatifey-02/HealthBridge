const express = require('express');

const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function mapMedicineRow(row) {
  if (!row) {
    return null;
  }

  const stock = Number(row.stock_quantity ?? row.stock ?? 0);
  const reorderLevel = Number(row.reorder_level ?? row.reorderLevel ?? 0);
  const status = stock <= reorderLevel ? 'Low stock' : 'In stock';

  return {
    id: row.id,
    name: row.name,
    category: row.generic_name || 'General',
    stock,
    unit: row.unit || 'units',
    reorderLevel,
    status,
    strength: row.dosage || row.strength || 'Standard dose',
  };
}

async function ensureInventorySeed() {
  const [countRows] = await query('SELECT COUNT(*) AS total FROM medicines');

  if (Number(countRows[0]?.total || 0) > 0) {
    return;
  }

  const defaultMedicines = [
    {
      id: 'MED-1001',
      name: 'Paracetamol 500mg',
      generic_name: 'Pain Relief',
      dosage: '500mg',
      stock_quantity: 240,
      reorder_level: 50,
      unit: 'tablets',
      status: 'In stock',
    },
    {
      id: 'MED-1002',
      name: 'Amoxicillin 500mg',
      generic_name: 'Antibiotic',
      dosage: '500mg',
      stock_quantity: 85,
      reorder_level: 30,
      unit: 'capsules',
      status: 'In stock',
    },
    {
      id: 'MED-1003',
      name: 'Artemether/Lumefantrine',
      generic_name: 'Antimalarial',
      dosage: '80/480mg',
      stock_quantity: 42,
      reorder_level: 50,
      unit: 'packs',
      status: 'Low stock',
    },
    {
      id: 'MED-1004',
      name: 'Metformin 500mg',
      generic_name: 'Diabetes',
      dosage: '500mg',
      stock_quantity: 120,
      reorder_level: 40,
      unit: 'tablets',
      status: 'In stock',
    },
    {
      id: 'MED-1005',
      name: 'Salbutamol Inhaler',
      generic_name: 'Respiratory',
      dosage: '100mcg',
      stock_quantity: 18,
      reorder_level: 20,
      unit: 'inhalers',
      status: 'Low stock',
    },
    {
      id: 'MED-1006',
      name: 'Cetirizine 10mg',
      generic_name: 'Allergy',
      dosage: '10mg',
      stock_quantity: 96,
      reorder_level: 25,
      unit: 'tablets',
      status: 'In stock',
    },
  ];

  for (const medicine of defaultMedicines) {
    await query(
      `INSERT INTO medicines (id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [
        medicine.id,
        medicine.name,
        medicine.generic_name,
        medicine.dosage,
        medicine.stock_quantity,
        medicine.reorder_level,
        medicine.unit,
        medicine.status,
      ]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureInventorySeed();

    const [rows] = await query(
      `SELECT id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status
       FROM medicines
       ORDER BY created_at DESC`
    );

    return res.json(rows.map(mapMedicineRow));
  } catch (error) {
    console.error('Get medicine inventory failed:', error);
    return res.status(500).json({ message: 'Failed to load pharmacy inventory.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, strength, quantity, expiry, status, stock, unit, category, reorderLevel, reorder_level } = req.body || {};

    const medicineName = String(name || '').trim();
    const medicineStrength = String(strength || unit || 'Standard dose').trim();
    const medicineQuantity = Number(quantity ?? stock ?? 0);
    const medicineUnit = String(unit || medicineStrength || 'units').trim();
    const medicineCategory = String(category || 'General').trim();
    const medicineReorderLevel = Number(reorderLevel ?? reorder_level ?? 0);

    if (!medicineName) {
      return res.status(400).json({ message: 'Medicine name is required.' });
    }

    const medicineId = `MED-${Date.now().toString().slice(-8)}`;
    const nextStatus = status || (medicineQuantity <= medicineReorderLevel ? 'Low stock' : 'In stock');

    await query(
      `INSERT INTO medicines (id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicineId,
        medicineName,
        medicineCategory,
        medicineStrength,
        medicineQuantity,
        medicineReorderLevel,
        medicineUnit,
        nextStatus,
      ]
    );

    const [rows] = await query(
      `SELECT id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status
       FROM medicines WHERE id = ?`,
      [medicineId]
    );

    return res.status(201).json(mapMedicineRow(rows[0]));
  } catch (error) {
    console.error('Create medicine failed:', error);
    return res.status(500).json({ message: 'Failed to add medicine.' });
  }
});

module.exports = router;
