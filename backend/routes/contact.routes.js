const express = require('express');

const { query, isFallbackMode } = require('../config/db');
const { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE } = require('../lib/http');
const { buildId } = require('../lib/ids');
const v = require('../lib/validation');

const router = express.Router();

/**
 * Contact form submissions from the public landing page.
 *
 * The form used to show a success alert and keep nothing, so a clinic was told
 * someone had got in touch when no record existed. A submitted message is now
 * stored and can be read by an administrator, so the promise the page makes is
 * one the system keeps.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (isFallbackMode()) {
      throw new ApiError(503, DATABASE_UNAVAILABLE_MESSAGE);
    }

    const body = req.body || {};
    const name = v.text(body.name, 'Name', { required: true, max: 120 });
    const email = v.email(body.email, 'Email address', { required: true });
    const subject = v.text(body.subject, 'Subject', { max: 255 });
    const message = v.text(body.message, 'Message', { required: true, max: 4000 });

    const id = buildId('HB-MSG');

    await query(
      `INSERT INTO contact_messages (id, name, email, subject, message, status)
       VALUES (?, ?, ?, ?, ?, 'New')`,
      [id, name, email, subject || null, message]
    );

    // Confirmed only because the row is really written. If the insert above
    // throws, the caller receives an error instead of a false confirmation.
    return res.status(201).json({
      id,
      message: 'Thank you. Your message has been recorded and an administrator can read it.',
    });
  })
);

module.exports = router;
