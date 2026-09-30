const { ApiError } = require('./http');

/**
 * Input validation for records that reach the database.
 *
 * Every function either returns a cleaned value or throws an ApiError, so a
 * route can gather several fields at once and fail with a single 400 that names
 * all of the problems rather than one confusing error at a time.
 */

function text(value, field, { required = false, max = 255, fallback = '' } = {}) {
  if (value === undefined || value === null) {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const cleaned = String(value).trim();

  if (!cleaned) {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  if (cleaned.length > max) {
    throw ApiError.badRequest(`${field} must be ${max} characters or fewer.`);
  }

  return cleaned;
}

function longText(value, field, { required = false, fallback = '' } = {}) {
  return text(value, field, { required, max: 20000, fallback });
}

function integer(value, field, { required = false, min = 0, max = 1000000, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw ApiError.badRequest(`${field} must be a whole number.`);
  }

  if (parsed < min || parsed > max) {
    throw ApiError.badRequest(`${field} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function oneOf(value, field, allowed, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const cleaned = String(value).trim();

  if (!allowed.includes(cleaned)) {
    throw ApiError.badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  }

  return cleaned;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function email(value, field, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const cleaned = String(value).trim().toLowerCase();

  if (!EMAIL_PATTERN.test(cleaned) || cleaned.length > 120) {
    throw ApiError.badRequest(`${field} must be a valid email address.`);
  }

  return cleaned;
}

function phone(value, field, { required = false, fallback = '' } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const cleaned = String(value).trim();

  // Digits, spaces and the punctuation international phone numbers use.
  if (!/^[0-9+()\-\s]{6,30}$/.test(cleaned)) {
    throw ApiError.badRequest(`${field} must be a valid phone number.`);
  }

  return cleaned;
}

/** Accepts an ISO date or a YYYY-MM-DD value and returns YYYY-MM-DD. */
function isoDate(value, field, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${field} must be a valid date.`);
  }

  return date.toISOString().slice(0, 10);
}

/** Accepts an ISO timestamp and returns the MySQL DATETIME form. */
function dateTime(value, field, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${field} must be a valid date and time.`);
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Accepts HH:MM or HH:MM:SS and returns the MySQL TIME form. */
function timeOfDay(value, field, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return fallback;
  }

  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) throw ApiError.badRequest(`${field} must be a time such as 09:30.`);

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw ApiError.badRequest(`${field} must be a valid time of day.`);
  }

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

const MIN_PASSWORD_LENGTH = 8;

function password(value, field = 'Password') {
  const cleaned = String(value ?? '');

  if (cleaned.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(
      `${field} must be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }

  if (!/[A-Za-z]/.test(cleaned) || !/\d/.test(cleaned)) {
    throw ApiError.badRequest(`${field} must contain both a letter and a number.`);
  }

  if (cleaned.length > 200) {
    throw ApiError.badRequest(`${field} must be 200 characters or fewer.`);
  }

  return cleaned;
}

module.exports = {
  text,
  longText,
  integer,
  oneOf,
  email,
  phone,
  isoDate,
  dateTime,
  timeOfDay,
  password,
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
};
