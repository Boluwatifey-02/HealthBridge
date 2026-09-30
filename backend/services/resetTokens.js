const crypto = require('crypto');

const { query } = require('../config/db');

/**
 * Password reset tokens.
 *
 * Staff and patient accounts recover their password the same way, so the rules
 * live in one place: the token is random, only its SHA-256 digest is stored, it
 * expires, it can be used once, and requesting a new one invalidates whatever
 * was outstanding.
 *
 * Storing only the digest matters because the reset table is the one part of the
 * database a backup or a read-only leak would expose. A digest cannot be turned
 * back into a working link.
 */

const TTL_MINUTES = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Issues a token, replacing any token already outstanding for the account.
 *
 * @param {'staff'|'patient'} kind
 * @param {string} accountId
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
async function issueToken(kind, accountId) {
  const table = kind === 'patient' ? 'patient_password_reset_tokens' : 'password_reset_tokens';
  const column = kind === 'patient' ? 'patient_id' : 'staff_id';

  const token = crypto.randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // Issuing a new request invalidates any earlier one, so a link obtained by
  // intercepting an old email stops working.
  await query(`DELETE FROM ${table} WHERE ${column} = ?`, [accountId]);

  await query(
    `INSERT INTO ${table} (id, ${column}, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    [id, accountId, hashToken(token), expiresAt]
  );

  return { token, expiresAt };
}

/**
 * Returns the record for a token, or null when it is unknown, already used or
 * expired.
 */
async function findValidToken(kind, token) {
  if (typeof token !== 'string' || !token.trim()) return null;

  const table = kind === 'patient' ? 'patient_password_reset_tokens' : 'password_reset_tokens';
  const column = kind === 'patient' ? 'patient_id' : 'staff_id';

  const [rows] = await query(
    `SELECT id, ${column}, expires_at, used_at FROM ${table} WHERE token_hash = ? LIMIT 1`,
    [hashToken(token.trim())]
  );

  const record = rows[0];

  if (!record || record.used_at) return null;

  return new Date(record.expires_at).getTime() > Date.now() ? record : null;
}

/**
 * Consumes a token and writes the new password hash in one step. The token is
 * deleted before the hash is written inside a transaction, so a link cannot be
 * replayed even if the request is interrupted.
 */
async function consumeTokenAndSetPassword(kind, token, passwordHash) {
  const table = kind === 'patient' ? 'patient_password_reset_tokens' : 'password_reset_tokens';
  const accountTable = kind === 'patient' ? 'patients' : 'staff';
  const column = kind === 'patient' ? 'patient_id' : 'staff_id';

  const { getConnection } = require('../config/db');
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, ${column} AS account_id, expires_at, used_at FROM ${table} WHERE token_hash = ? FOR UPDATE`,
      [hashToken(String(token).trim())]
    );

    const record = rows[0];

    if (!record || record.used_at || new Date(record.expires_at).getTime() <= Date.now()) {
      await connection.rollback();
      return false;
    }

    await connection.query(`DELETE FROM ${table} WHERE ${column} = ?`, [record.account_id]);
    await connection.query(`UPDATE ${accountTable} SET password_hash = ? WHERE id = ?`, [
      passwordHash,
      record.account_id,
    ]);

    await connection.commit();
    return true;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Password reset rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  TTL_MINUTES,
  hashToken,
  issueToken,
  findValidToken,
  consumeTokenAndSetPassword,
};
