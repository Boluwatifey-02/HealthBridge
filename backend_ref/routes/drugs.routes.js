const express = require("express");
const { pool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// GET /api/drugs — FR-8: inventory list with low-stock flag
router.get("/", authorize("manageInventory"), async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM drugs WHERE branch_id = ?", [req.user.branchId]);
  const withStatus = rows.map((d) => ({
    ...d,
    lowStock: d.stock_quantity <= d.reorder_level,
  }));
  res.json(withStatus);
});

// GET /api/drugs/low-stock — FR-8: proactive alert list for dashboards
router.get("/low-stock", authorize("manageInventory"), async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM drugs WHERE branch_id = ? AND stock_quantity <= reorder_level",
    [req.user.branchId]
  );
  res.json(rows);
});

module.exports = router;
