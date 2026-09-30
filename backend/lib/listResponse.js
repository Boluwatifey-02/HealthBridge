/**
 * Response shapes for the list endpoints.
 *
 * The interface published at the time the API was deployed was written before
 * these endpoints were paginated. It treats the response as a bare array and
 * calls methods such as .filter and .map on it, so an envelope left every page
 * of that build empty.
 *
 * A new caller asks for the envelope with ?format=envelope, which carries the
 * page size and total alongside the items. Anything else keeps the bare array
 * so the already-published build continues to work. This is a compatibility
 * path for a bundle that cannot be replaced from here; once the current
 * interface is the one being served, the bare array can go with it.
 */

const ENVELOPE_FORMATS = new Set(['envelope', 'paginated']);

function wantsEnvelope(req) {
  const requested = String((req.query || {}).format || '').trim().toLowerCase();

  return ENVELOPE_FORMATS.has(requested);
}

/**
 * Sends either the bare array or the full envelope, whichever the caller asked
 * for. A missing or non-array item list is reported honestly rather than being
 * reshaped into something that looks like an empty result.
 */
function sendList(req, res, key, payload) {
  if (wantsEnvelope(req)) {
    return res.json(payload);
  }

  const items = payload ? payload[key] : undefined;

  if (!Array.isArray(items)) {
    return res.status(500).json({
      message: `The ${key} collection was not available in the expected format.`,
    });
  }

  return res.json(items);
}

module.exports = { wantsEnvelope, sendList };
