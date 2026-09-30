const crypto = require('crypto');

/**
 * Identifier generation for records created through the API.
 *
 * The previous code built ids from `Date.now().toString().slice(-8)`, which
 * returns the same value for every record created inside the same second. Two
 * patients registered in quick succession therefore produced colliding primary
 * keys and the second insert failed for no visible reason. These ids combine a
 * millisecond timestamp with random bytes, which keeps them sortable and
 * readable while making a collision negligible.
 */

function buildId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');

  return `${prefix}-${timestamp}${random}`;
}

const idGenerators = {
  patient: () => buildId('HB-PAT'),
  appointment: () => buildId('HB-APT'),
  consultation: () => buildId('HB-CONS'),
  prescription: () => buildId('HB-RX'),
  medicine: () => buildId('HB-MED'),
  labRequest: () => buildId('HB-LAB'),
  labResult: () => buildId('HB-LRES'),
  document: () => buildId('HB-DOC'),
  audit: () => buildId('HB-AUD'),
};

module.exports = { buildId, idGenerators };
