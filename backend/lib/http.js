/**
 * Small helpers shared by every route module.
 *
 * The routes previously repeated the same try/catch, "is the database
 * available" and 500-response boilerplate in each file. Centralising it here
 * keeps the handlers focused on the actual work and makes it impossible for one
 * route to accidentally leak a raw database error to a client.
 */

/** An error carrying the HTTP status the client should see. */
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    if (details) this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message) {
    return new ApiError(401, message);
  }

  static forbidden(message) {
    return new ApiError(403, message);
  }

  static notFound(message) {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }
}

/**
 * Wraps an async handler so a rejected promise reaches the Express error
 * handler instead of hanging the request.
 */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

const DATABASE_UNAVAILABLE_MESSAGE =
  'The HealthBridge database is unavailable. Please try again shortly.';

module.exports = { ApiError, asyncHandler, DATABASE_UNAVAILABLE_MESSAGE };
