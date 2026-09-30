const express = require('express');
const bcrypt = require('bcrypt');

const { query, isFallbackMode } = require('../config/db');
const { authenticate, staffOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { recordAudit } = require('../lib/audit');
const { buildId } = require('../lib/ids');
const { getDashboardMetrics } = require('../services/dashboard');
const v = require('../lib/validation');

const router = express.Router();
router.use(authenticate, staffOnly);

const STAFF_SELECT = `SELECT id, full_name, email, role, phone, branch_id, status, created_at
                      FROM staff`;

const ROLES = ['Receptionist', 'Doctor', 'Pharmacist', 'Laboratory Staff', 'Administrator'];

function mapStaff(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone || '',
    branch: row.branch_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get(
  '/analytics',
  authorize('viewAnalytics'),
  asyncHandler(async (req, res) => {
    const metrics = await getDashboardMetrics();

    const [staffRows] = await query("SELECT COUNT(*) AS total FROM staff WHERE status = 'Active'");
    const [inactiveStaff] = await query("SELECT COUNT(*) AS total FROM staff WHERE status <> 'Active'");
    const [patientRows] = await query("SELECT COUNT(*) AS total FROM patients WHERE status = 'Active'");

    // Workload per role, so an administrator can see where the pressure is.
    const [workload] = await query(
      `SELECT
         (SELECT COUNT(*) FROM appointments WHERE status IN ('Scheduled', 'Confirmed', 'Pending')) AS openAppointments,
         (SELECT COUNT(*) FROM lab_requests WHERE status = 'Pending') AS pendingLab,
         (SELECT COUNT(*) FROM prescriptions WHERE status = 'Pending') AS pendingPrescriptions,
         (SELECT COUNT(*) FROM medicines WHERE stock_quantity <= reorder_level) AS lowStock,
         (SELECT COUNT(*) FROM consultations WHERE consultation_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS consultationsThisWeek`
    );

    const [byRole] = await query('SELECT role, COUNT(*) AS total FROM staff GROUP BY role ORDER BY role');

    return res.json({
      metrics,
      staffCount: Number(staffRows[0]?.total || 0),
      inactiveStaffCount: Number(inactiveStaff[0]?.total || 0),
      activePatients: Number(patientRows[0]?.total || 0),
      workload: {
        openAppointments: Number(workload[0]?.openAppointments || 0),
        pendingLabRequests: Number(workload[0]?.pendingLab || 0),
        pendingPrescriptions: Number(workload[0]?.pendingPrescriptions || 0),
        lowStockMedicines: Number(workload[0]?.lowStock || 0),
        consultationsThisWeek: Number(workload[0]?.consultationsThisWeek || 0),
      },
      staffByRole: byRole.map((row) => ({ role: row.role, total: Number(row.total) })),
    });
  })
);

router.get(
  '/audit-log',
  authorize('viewAuditLog'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const action = v.text(req.query.action, 'Action', { max: 100 });
    const search = v.text(req.query.search, 'Search term', { max: 120 });
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 200, fallback: 50 });

    const where = [];
    const params = [];

    if (action) {
      where.push('a.action = ?');
      params.push(action);
    }
    if (search) {
      where.push('(a.details LIKE ? OR s.full_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await query(
      `SELECT a.id, a.actor_id, a.action, a.details, a.created_at,
              s.full_name AS actor_name, s.role AS actor_role
         FROM audit_logs a
         LEFT JOIN staff s ON s.id = a.actor_id
         ${clause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN staff s ON s.id = a.actor_id ${clause}`,
      params
    );

    const [actions] = await query(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action ASC'
    );

    return res.json({
      entries: rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actor: row.actor_name || 'System',
        actorRole: row.actor_role || '',
        action: row.action,
        details: row.details || '',
        at: row.created_at,
      })),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      actions: actions.map((row) => row.action),
    });
  })
);

router.get(
  '/contact-messages',
  authorize('viewAuditLog'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const status = req.query.status ? v.oneOf(req.query.status, 'Status', ['New', 'Read', 'Replied']) : null;
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 100000, fallback: 1 });
    const pageSize = v.integer(req.query.pageSize, 'Page size', { min: 1, max: 200, fallback: 50 });

    const clause = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];

    const [rows] = await query(
      `SELECT id, name, email, subject, message, status, created_at
         FROM contact_messages ${clause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const [countRows] = await query(`SELECT COUNT(*) AS total FROM contact_messages ${clause}`, params);

    return res.json({
      messages: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        subject: row.subject || '',
        message: row.message,
        status: row.status,
        at: row.created_at,
      })),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    });
  })
);

router.get(
  '/staff',
  authorize('viewStaff'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [rows] = await query(`${STAFF_SELECT} ORDER BY full_name ASC`);

    return res.json({ staff: rows.map(mapStaff), total: rows.length });
  })
);

router.post(
  '/staff',
  authorize('manageStaff'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const fullName = v.text(body.fullName, 'Full name', { required: true, max: 120 });
    const email = v.email(body.email, 'Email address', { required: true });
    const role = v.oneOf(body.role, 'Role', ROLES, { required: true });
    const phoneNumber = v.phone(body.phone, 'Phone number');
    const password = v.password(body.password, 'Password');
    const branch = v.integer(req.user.branch, 'Branch', { min: 1, max: 10000, fallback: 1 });

    const [existing] = await query('SELECT id FROM staff WHERE email = ? LIMIT 1', [email]);

    if (existing.length) {
      throw ApiError.conflict('A staff account already uses that email address.');
    }

    const id = buildId('HB-STAFF');
    const passwordHash = await bcrypt.hash(password, 10);

    await query(
      `INSERT INTO staff (id, full_name, email, password_hash, role, phone, branch_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [id, fullName, email, passwordHash, role, phoneNumber, branch]
    );

    await recordAudit(req.user, 'CREATE_STAFF', `Created a ${role} account.`, {
      entity: 'staff',
      entityId: id,
    });

    const [rows] = await query(`${STAFF_SELECT} WHERE id = ? LIMIT 1`, [id]);

    return res.status(201).json(mapStaff(rows[0]));
  })
);

/**
 * Updates a staff account. An administrator can deactivate their own account by
 * accident and lock everyone out, so that specific case is refused.
 */
router.put(
  '/staff/:id',
  authorize('manageStaff'),
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const [existing] = await query('SELECT * FROM staff WHERE id = ? LIMIT 1', [req.params.id]);

    if (!existing.length) {
      throw ApiError.notFound('That staff account was not found.');
    }

    const before = existing[0];
    const body = req.body || {};

    const fullName = body.fullName !== undefined
      ? v.text(body.fullName, 'Full name', { required: true, max: 120 })
      : before.full_name;
    const role = body.role !== undefined
      ? v.oneOf(body.role, 'Role', ROLES, { required: true })
      : before.role;
    const phoneNumber = body.phone !== undefined
      ? v.phone(body.phone, 'Phone number')
      : before.phone;
    const status = body.status !== undefined
      ? v.oneOf(body.status, 'Status', ['Active', 'Inactive'], { required: true })
      : before.status;

    if (before.id === req.user.id && status === 'Inactive') {
      throw ApiError.badRequest('You cannot deactivate the account you are signed in with.');
    }

    // Removing the last administrator would leave nobody able to manage staff
    // or read the audit trail, so the change is refused.
    if (before.role === 'Administrator' && (role !== 'Administrator' || status === 'Inactive')) {
      const [others] = await query(
        "SELECT COUNT(*) AS total FROM staff WHERE role = 'Administrator' AND status = 'Active' AND id <> ?",
        [before.id]
      );

      if (Number(others[0]?.total || 0) === 0) {
        throw ApiError.badRequest(
          'This is the only active administrator account, so its access cannot be removed.'
        );
      }
    }

    await query(
      'UPDATE staff SET full_name = ?, role = ?, phone = ?, status = ? WHERE id = ?',
      [fullName, role, phoneNumber, status, req.params.id]
    );

    if (body.password) {
      const password = v.password(body.password, 'Password');
      await query('UPDATE staff SET password_hash = ? WHERE id = ?', [
        await bcrypt.hash(password, 10),
        req.params.id,
      ]);
    }

    const changes = [];
    if (before.full_name !== fullName) changes.push('name');
    if (before.role !== role) changes.push(`role -> ${role}`);
    if (before.status !== status) changes.push(`status -> ${status}`);
    if (body.password) changes.push('password reset');

    await recordAudit(
      req.user,
      'UPDATE_STAFF',
      changes.length ? `Updated a staff account (${changes.join(', ')}).` : 'Updated a staff account with no changed fields.',
      { entity: 'staff', entityId: req.params.id }
    );

    const [rows] = await query(`${STAFF_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);

    return res.json(mapStaff(rows[0]));
  })
);

module.exports = router;
