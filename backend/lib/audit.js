const { query } = require('../config/db');
const { idGenerators } = require('./ids');

/**
 * Audit trail for anything that changes a patient record.
 *
 * HealthBridge handles protected health information, so who looked at a record
 * and who changed it is as important as the change itself. The audit_logs table
 * already exists; previously nothing wrote to it, so the table was empty and
 * the Security page had nothing truthful to show.
 *
 * A failure to record an audit entry must never fail the operation the clinician
 * is performing, so errors are logged and swallowed.
 */

function describe(actor) {
  if (!actor) return { actorId: null, actorName: 'System', actorRole: null };

  return {
    actorId: actor.demo ? null : (actor.id || null),
    actorName: actor.fullName || actor.full_name || actor.email || 'Unknown user',
    actorRole: actor.role || null,
  };
}

/**
 * Records one action.
 *
 * @param {object} actor   the authenticated user making the change
 * @param {string} action  stable machine name, e.g. 'UPDATE_PATIENT'
 * @param {string} details human-readable description. Never include clinical
 *                         detail or a password here; this table is readable by
 *                         administrators and is retained longer than the record.
 * @param {object} [meta]  { entity, entityId }
 */
async function recordAudit(actor, action, details, meta = {}) {
  const { actorId, actorName, actorRole } = describe(actor);
  const id = idGenerators.audit();

  try {
    await query(
      `INSERT INTO audit_logs (id, actor_id, action, details, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        id,
        // audit_logs.actor_id references staff(id), so a patient-scoped action
        // has no staff actor to point at.
        actorId || null,
        action,
        [
          details,
          meta.entity ? `Target: ${meta.entity}${meta.entityId ? ` ${meta.entityId}` : ''}.` : '',
          actorName,
          actorRole ? `(${actorRole})` : '',
        ]
          .filter(Boolean)
          .join(' '),
      ]
    );
  } catch (error) {
    console.error(`Audit entry could not be written for ${action}:`, error.message);
  }

  return id;
}

module.exports = { recordAudit };
