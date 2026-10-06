const jwt = require('jsonwebtoken');
const { query, isFallbackMode } = require('../config/db');
const { ApiError } = require('../lib/http');

/**
 * Verifies the bearer token and attaches the caller to the request.
 *
 * The token carries the role that was current at sign-in, but a role change or
 * a suspension must not stay unnoticed until the token expires. Every request
 * therefore re-reads the account and checks its status, so deactivating a staff
 * member takes effect on their very next call.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Authentication required.'));
  }

  const token = header.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    return next(new ApiError(500, 'Authentication is not configured on the server.'));
  }

  let claims;

  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(ApiError.unauthorized('Invalid or expired session.'));
  }

  if (claims.audience === 'patient') {
    req.user = {
      id: claims.id,
      role: 'Patient',
      audience: 'patient',
      fullName: claims.fullName,
      email: claims.email,
    };
    return next();
  }

  if (claims.demo) {
    req.user = {
      id: claims.id,
      role: claims.role,
      audience: 'staff',
      fullName: claims.fullName,
      email: claims.email,
      branch: claims.branch,
      demo: true,
    };
    return next();
  }

  if (isFallbackMode()) {
    return next(new ApiError(503, 'The HealthBridge database is unavailable. Please try again shortly.'));
  }

  query('SELECT id, full_name, email, role, branch_id, status FROM staff WHERE id = ? LIMIT 1', [
    claims.id,
  ])
    .then(([rows]) => {
      const staff = rows[0];

      if (!staff) {
        return next(ApiError.unauthorized('This account no longer exists.'));
      }

      if (staff.status !== 'Active') {
        return next(
          ApiError.forbidden('This account has been deactivated. Contact an administrator.')
        );
      }

      req.user = {
        id: staff.id,
        role: staff.role,
        audience: 'staff',
        fullName: staff.full_name,
        email: staff.email,
        branch: staff.branch_id,
      };

      return next();
    })
    .catch((error) => next(error));
}

/**
 * Rejects patient portal tokens on staff-only routes. Without this a patient
 * who signs in could reach clinical data simply because the route only checked
 * for a valid session.
 */
function staffOnly(req, res, next) {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required.'));
  }

  if (req.user.audience === 'patient') {
    return next(ApiError.forbidden('This area is for HealthBridge staff only.'));
  }

  return next();
}

module.exports = { authenticate, staffOnly };
