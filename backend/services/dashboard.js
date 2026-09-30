const { query, isFallbackMode } = require('../config/db');

/**
 * Dashboard figures, computed from the database every time they are requested.
 *
 * The previous version returned four lifetime counts. That made it impossible to
 * answer the questions a clinic actually asks on opening the screen: what is
 * booked today, what is overdue, which medicines need reordering, and what has
 * happened recently. Every number below comes from a query against the tables
 * that hold the real work.
 */

function count(rows) {
  return Number(rows?.[0]?.total || 0);
}

async function totalPatients() {
  const [rows] = await query(
    "SELECT COUNT(*) AS total FROM patients WHERE status = 'Active'"
  );
  return count(rows);
}

async function appointmentsToday() {
  const [rows] = await query(
    "SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = CURDATE() AND status <> 'Cancelled'"
  );
  return count(rows);
}

async function upcomingAppointments() {
  const [rows] = await query(
    `SELECT COUNT(*) AS total FROM appointments
      WHERE appointment_date >= CURDATE() AND status IN ('Scheduled', 'Confirmed', 'Pending')`
  );
  return count(rows);
}

async function lowStockMedicines() {
  const [rows] = await query(
    'SELECT COUNT(*) AS total FROM medicines WHERE stock_quantity <= reorder_level'
  );
  return count(rows);
}

async function pendingLabRequests() {
  const [rows] = await query("SELECT COUNT(*) AS total FROM lab_requests WHERE status = 'Pending'");
  return count(rows);
}

async function pendingPrescriptions() {
  const [rows] = await query("SELECT COUNT(*) AS total FROM prescriptions WHERE status = 'Pending'");
  return count(rows);
}

async function patientsSeenLast30Days() {
  const [rows] = await query(
    `SELECT COUNT(DISTINCT patient_id) AS total FROM consultations
      WHERE consultation_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
  );
  return count(rows);
}

async function newPatientsLast30Days() {
  const [rows] = await query(
    'SELECT COUNT(*) AS total FROM patients WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
  );
  return count(rows);
}

/**
 * Daily attendance over a window, zero-filled so the chart shows real gaps
 * rather than joining days together and implying continuous activity.
 */
async function dailyAttendance(days = 14) {
  const [rows] = await query(
    `SELECT DATE(appointment_date) AS day, COUNT(*) AS total
       FROM appointments
      WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status <> 'Cancelled'
      GROUP BY DATE(appointment_date)
      ORDER BY day ASC`,
    [days]
  );

  const byDay = new Map(rows.map((row) => [String(row.day).slice(0, 10), count(row)]));

  const series = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);

    series.push({ date: key, count: byDay.get(key) || 0 });
  }

  return series;
}

async function statusBreakdown() {
  const [appointments] = await query(
    'SELECT status, COUNT(*) AS total FROM appointments GROUP BY status'
  );
  const [prescriptions] = await query(
    'SELECT status, COUNT(*) AS total FROM prescriptions GROUP BY status'
  );
  const [labRequests] = await query(
    'SELECT status, COUNT(*) AS total FROM lab_requests GROUP BY status'
  );

  const toObject = (rows) =>
    rows.reduce((accumulator, row) => ({ ...accumulator, [row.status]: count(row) }), {});

  return {
    appointments: toObject(appointments),
    prescriptions: toObject(prescriptions),
    labRequests: toObject(labRequests),
  };
}

async function recentActivity(limit = 12) {
  // The audit trail is the only place that records who did what, and it is now
  // written on every change, so it is the honest source for "recent activity".
  const [rows] = await query(
    `SELECT a.id, a.action, a.details, a.created_at, a.actor_id,
            s.full_name AS actor_name, s.role AS actor_role
       FROM audit_logs a
       LEFT JOIN staff s ON s.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    details: row.details || '',
    at: row.created_at,
    actor: row.actor_name || 'System',
    actorRole: row.actor_role || '',
  }));
}

async function inventoryAttention(limit = 10) {
  const [rows] = await query(
    `SELECT id, name, stock_quantity, reorder_level, unit
       FROM medicines
      WHERE stock_quantity <= reorder_level
      ORDER BY (stock_quantity - reorder_level) ASC, name ASC
      LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    stock: Number(row.stock_quantity || 0),
    reorderLevel: Number(row.reorder_level || 0),
    unit: row.unit || 'units',
    shortfall: Math.max(0, Number(row.reorder_level || 0) - Number(row.stock_quantity || 0)),
  }));
}

async function getDashboardMetrics() {
  if (isFallbackMode()) {
    return {
      totals: {
        totalPatients: 0,
        appointments: 0,
        lowStockItems: 0,
        pendingLabRequests: 0,
      },
      today: {
        appointmentsToday: 0,
        upcomingAppointments: 0,
        patientsSeenLast30Days: 0,
        newPatientsLast30Days: 0,
        pendingLabRequests: 0,
        pendingPrescriptions: 0,
        lowStockMedicines: 0,
      },
      attendance: [],
      breakdown: { appointments: {}, prescriptions: {}, labRequests: {} },
      recentActivity: [],
      inventoryAttention: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const [totalPatientsCount, appointmentCount, lowStockCount, pendingLabCount] = await Promise.all([
    totalPatients(),
    count(await query('SELECT COUNT(*) AS total FROM appointments')),
    lowStockMedicines(),
    pendingLabRequests(),
  ]);

  const [
    todayAppointments,
    upcoming,
    seenLast30,
    newLast30,
    pendingRx,
    attendance,
    breakdown,
    activity,
    attention,
  ] = await Promise.all([
    appointmentsToday(),
    upcomingAppointments(),
    patientsSeenLast30Days(),
    newPatientsLast30Days(),
    pendingPrescriptions(),
    dailyAttendance(14),
    statusBreakdown(),
    recentActivity(12),
    inventoryAttention(10),
  ]);

  return {
    // Kept under the original names so any existing consumer keeps working.
    totals: {
      totalPatients: totalPatientsCount,
      appointments: appointmentCount,
      lowStockItems: lowStockCount,
      pendingLabRequests: pendingLabCount,
    },
    today: {
      appointmentsToday: todayAppointments,
      upcomingAppointments: upcoming,
      patientsSeenLast30Days: seenLast30,
      newPatientsLast30Days: newLast30,
      pendingLabRequests: pendingLabCount,
      pendingPrescriptions: pendingRx,
      lowStockMedicines: lowStockCount,
    },
    attendance,
    breakdown,
    recentActivity: activity,
    inventoryAttention: attention,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getDashboardMetrics };
