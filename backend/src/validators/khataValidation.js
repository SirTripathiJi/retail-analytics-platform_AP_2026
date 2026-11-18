const ApiError = require('../errors/ApiError');

const PAYMENT_METHODS = new Set(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']);

function invalid(message) {
  throw new ApiError(400, message, 'VALIDATION_ERROR');
}

function validateAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    invalid('amount must be a positive finite number.');
  }
  const minorUnits = value * 100;
  if (Math.abs(minorUnits - Math.round(minorUnits)) > 1e-8) {
    invalid('amount may have at most two decimal places.');
  }
  return Math.round(minorUnits) / 100;
}

function optionalText(body, field, maximum) {
  if (body[field] === undefined || body[field] === null) return '';
  if (typeof body[field] !== 'string') invalid(`${field} must be a string.`);
  if (body[field].trim().length > maximum) invalid(`${field} must be ${maximum} characters or fewer.`);
  return body[field].trim();
}

function validateBody(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Request body must be a JSON object.');
  const unknown = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unknown) invalid(`Unsupported ledger field: ${unknown}.`);
}

function validateCredit(body) {
  validateBody(body, new Set(['amount', 'note', 'referenceId']));
  return {
    amount: validateAmount(body.amount),
    note: optionalText(body, 'note', 1000),
    referenceId: optionalText(body, 'referenceId', 150) || null,
  };
}

function validatePayment(body) {
  validateBody(body, new Set(['amount', 'paymentMethod', 'note', 'referenceId']));
  let paymentMethod = body.paymentMethod;
  if (paymentMethod !== undefined && paymentMethod !== null && paymentMethod !== '') {
    if (typeof paymentMethod !== 'string') invalid('paymentMethod must be a string.');
    paymentMethod = paymentMethod.trim().toUpperCase();
    if (!PAYMENT_METHODS.has(paymentMethod)) invalid('paymentMethod must be CASH, UPI, CARD, BANK_TRANSFER, or OTHER.');
  } else {
    paymentMethod = null;
  }
  return {
    amount: validateAmount(body.amount),
    paymentMethod,
    note: optionalText(body, 'note', 1000),
    referenceId: optionalText(body, 'referenceId', 150) || null,
  };
}

module.exports = { validateCredit, validatePayment };
