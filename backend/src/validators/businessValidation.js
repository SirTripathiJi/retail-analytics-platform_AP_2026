const ApiError = require('../errors/ApiError');

const PROFILE_FIELDS = new Set(['businessName', 'businessType', 'phone', 'email', 'address']);
const SETTING_FIELDS = new Set(['currency', 'timezone', 'lowStockThreshold']);
const RESET_FIELDS = new Set(['confirmationText', 'counts', 'snapshotFingerprint']);
const DEFAULT_SETTINGS = Object.freeze({ currency: 'INR', timezone: 'UTC', lowStockThreshold: 5 });
const RESET_CONFIRMATION = 'RESET MY BUSINESS DATA';
const RESET_COUNT_KEYS = Object.freeze([
  'products', 'categories', 'customers', 'khataLedgerEntries', 'invoices', 'payments', 'invoiceSequences', 'transactions',
]);

function invalid(message) { throw new ApiError(400, message, 'VALIDATION_ERROR'); }

function assertObject(body, name = 'Request body') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid(`${name} must be a JSON object.`);
}

function assertOnly(body, fields, label) {
  const unsupported = Object.keys(body).find((key) => !fields.has(key));
  if (unsupported) invalid(`Unsupported ${label} field: ${unsupported}.`);
}

function optionalString(value, field, maxLength) {
  if (value === null) return null;
  if (typeof value !== 'string') invalid(`${field} must be a string${maxLength ? ` of ${maxLength} characters or fewer` : ''}.`);
  const result = value.trim();
  if (maxLength && result.length > maxLength) invalid(`${field} must be ${maxLength} characters or fewer.`);
  return result;
}

function normalizeEmail(value) {
  if (value === null) return null;
  if (typeof value !== 'string') invalid('email must be a valid email address or null.');
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('email must be a valid email address or null.');
  return email;
}

function normalizePhone(value) {
  if (value === null) return null;
  if (typeof value !== 'string') invalid('phone must be a valid phone number or null.');
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) invalid('phone must contain 8 to 15 digits and may start with +.');
  return phone;
}

function validateProfileUpdate(body) {
  assertObject(body);
  assertOnly(body, PROFILE_FIELDS, 'profile');
  if (!Object.keys(body).length) invalid('At least one editable profile field must be provided.');
  const result = {};
  if (Object.hasOwn(body, 'businessName')) {
    const value = optionalString(body.businessName, 'businessName', 150);
    if (!value) invalid('businessName must not be empty.');
    result.businessName = value;
  }
  if (Object.hasOwn(body, 'businessType')) result.businessType = optionalString(body.businessType, 'businessType', 80);
  if (Object.hasOwn(body, 'phone')) result.phone = normalizePhone(body.phone);
  if (Object.hasOwn(body, 'email')) result.email = normalizeEmail(body.email);
  if (Object.hasOwn(body, 'address')) result.address = optionalString(body.address, 'address', 500);
  return result;
}

function isCurrencyCode(value) {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    return Intl.supportedValuesOf('currency').includes(value);
  } catch (_error) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: value }).resolvedOptions().currency === value; }
    catch (_formatError) { return false; }
  }
}

function isTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0)); return true; }
  catch (_error) { return false; }
}

function validateSettingsUpdate(body) {
  assertObject(body);
  assertOnly(body, SETTING_FIELDS, 'settings');
  if (!Object.keys(body).length) invalid('At least one setting must be provided.');
  const result = {};
  if (Object.hasOwn(body, 'currency')) {
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
    if (!isCurrencyCode(currency)) invalid('currency must be a supported three-letter ISO currency code.');
    result.currency = currency;
  }
  if (Object.hasOwn(body, 'timezone')) {
    if (!isTimeZone(body.timezone)) invalid('timezone must be a valid IANA timezone identifier.');
    result.timezone = body.timezone.trim();
  }
  if (Object.hasOwn(body, 'lowStockThreshold')) {
    if (!Number.isInteger(body.lowStockThreshold) || body.lowStockThreshold < 0 || body.lowStockThreshold > 1000000) {
      invalid('lowStockThreshold must be an integer from 0 to 1000000.');
    }
    result.lowStockThreshold = body.lowStockThreshold;
  }
  return result;
}

function validateResetRequest(body) {
  assertObject(body);
  assertOnly(body, RESET_FIELDS, 'reset');
  if (body.confirmationText !== RESET_CONFIRMATION) invalid(`confirmationText must exactly equal "${RESET_CONFIRMATION}".`);
  if (!body.counts || typeof body.counts !== 'object' || Array.isArray(body.counts)) invalid('counts from the reset preview are required.');
  const keys = Object.keys(body.counts).sort();
  if (keys.length !== RESET_COUNT_KEYS.length || keys.some((key, index) => key !== [...RESET_COUNT_KEYS].sort()[index])) {
    invalid('counts must include exactly the values returned by the reset preview.');
  }
  for (const key of RESET_COUNT_KEYS) {
    if (!Number.isSafeInteger(body.counts[key]) || body.counts[key] < 0) invalid(`counts.${key} must be a non-negative integer.`);
  }
  if (typeof body.snapshotFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(body.snapshotFingerprint)) {
    invalid('snapshotFingerprint from the reset preview is required.');
  }
  return { counts: { ...body.counts }, snapshotFingerprint: body.snapshotFingerprint };
}

module.exports = {
  DEFAULT_SETTINGS,
  RESET_CONFIRMATION,
  RESET_COUNT_KEYS,
  isCurrencyCode,
  isTimeZone,
  validateProfileUpdate,
  validateResetRequest,
  validateSettingsUpdate,
};
