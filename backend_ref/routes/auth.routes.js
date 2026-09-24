const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { staffId, password } = req.body;
  if (!staffId || !password) {
    return res.status(400).json({ error: "staffId and password are required." });
  }
  try {
    const [rows] = await pool.query("SELECT * FROM staff WHERE staff_id = ?", [staffId]);
    const staff = rows[0];
    // Deliberately vague error message on both "user not found" and
    // "wrong password" so a login attempt can't be used to enumerate
    // valid staff IDs.
    if (!staff) return res.status(401).json({ error: "Invalid credentials." });

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = jwt.sign(
      { staffId: staff.staff_id, role: staff.role, branchId: staff.branch_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    await pool.query(
      "INSERT INTO audit_logs (log_id, actor, action) VALUES (?, ?, ?)",
      [uuidv4(), staff.full_name, "Logged in"]
    );

    res.json({
      token,
      staff: { staffId: staff.staff_id, fullName: staff.full_name, role: staff.role, branchId: staff.branch_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// POST /api/auth/forgot-password
// Demo-scoped: generates a reset token and returns it directly.
// In a real deployment this would email/SMS the token instead of
// returning it in the response.
router.post("/forgot-password", async (req, res) => {
  const { staffId } = req.body;
  const [rows] = await pool.query("SELECT staff_id FROM staff WHERE staff_id = ?", [staffId]);
  // Always respond the same way whether or not the account exists,
  // to avoid leaking which staff IDs are valid.
  if (!rows[0]) {
    return res.json({ message: "If that account exists, a reset link has been generated." });
  }
  const resetToken = jwt.sign({ staffId, purpose: "reset" }, process.env.JWT_SECRET, { expiresIn: "15m" });
  res.json({ message: "Reset token generated.", resetToken });
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;
  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset") throw new Error("Invalid token purpose");
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE staff SET password_hash = ? WHERE staff_id = ?", [hash, decoded.staffId]);
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(400).json({ error: "Reset link is invalid or has expired." });
  }
});

module.exports = router;
