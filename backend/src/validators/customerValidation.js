const ApiError = require('../errors/ApiError');

const CUSTOMER_FIELDS = new Set(['fullName', 'phone', 'email', 'address', 'notes']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  throw new ApiError(400, message, 'VALIDATION_ERROR');
}

function assertObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Request body must be a JSON object.');
  const unknown = Object.keys(body).find((field) => !CUSTOMER_FIELDS.has(field));
  if (unknown) invalid(`Unsupported customer field: ${unknown}.`);
}

function normalizeFullName(value) {
  if (typeof value !== 'string' || !value.trim()) invalid('fullName is required.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > 150) invalid('fullName must be 150 characters or fewer.');
  return name;
}

function normalizePhone(value) {
  if (typeof value !== 'string' || !value.trim()) invalid('phone is required.');
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) {
    invalid('phone must contain 7 to 15 digits and may start with +.');
  }
  return phone;
}

function normalizeEmail(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') invalid('email must be a string.');
  const email = value.trim().toLowerCase();
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) invalid('email must be a valid email address.');
  return email || null;
}

function optionalText(value, field, maxLength) {
  if (value === undefined) return undefined;
  if (value === null) return '';
  if (typeof value !== 'string') invalid(`${field} must be a string.`);
  if (value.trim().length > maxLength) invalid(`${field} must be ${maxLength} characters or fewer.`);
  return value.trim();
}

function validateCreateCustomer(body) {
  assertObject(body);
  const customer = {
    fullName: normalizeFullName(body.fullName),
    phone: normalizePhone(body.phone),
    email: normalizeEmail(body.email),
    address: optionalText(body.address, 'address', 1000) ?? '',
    notes: optionalText(body.notes, 'notes', 2000) ?? '',
  };
  return customer;
}

function validateUpdateCustomer(body) {
  assertObject(body);
  if (!Object.keys(body).length) invalid('At least one customer field must be provided.');
  const update = {};
  if (Object.hasOwn(body, 'fullName')) update.fullName = normalizeFullName(body.fullName);
  if (Object.hasOwn(body, 'phone')) update.phone = normalizePhone(body.phone);
  if (Object.hasOwn(body, 'email')) update.email = normalizeEmail(body.email);
  if (Object.hasOwn(body, 'address')) update.address = optionalText(body.address, 'address', 1000);
  if (Object.hasOwn(body, 'notes')) update.notes = optionalText(body.notes, 'notes', 2000);
  return update;
}

module.exports = { validateCreateCustomer, validateUpdateCustomer };
