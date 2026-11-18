const ApiError = require('../errors/ApiError');
const { validateObjectId, validatePagination } = require('./inventoryValidation');

const ID = /^[a-f\d]{24}$/i;
function invalid(message) { throw new ApiError(400, message, 'VALIDATION_ERROR'); }
function amountPaise(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
    || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
    invalid(`${field} must be a non-negative amount with at most two decimal places.`);
  }
  return Math.round(value * 100);
}

function validateCreateInvoice(body, idempotencyKey) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Request body must be a JSON object.');
  const allowed = new Set(['customerId', 'items', 'additionalCharges', 'discount', 'paymentType']);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) invalid(`Unsupported invoice field: ${unknown}.`);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) invalid('items must contain 1 to 100 products.');
  const totals = new Map();
  for (const item of body.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid('Each item must be an object.');
    if (Object.keys(item).some((key) => !['productId', 'quantity'].includes(key))) invalid('Only productId and quantity are accepted for product items.');
    if (typeof item.productId !== 'string' || !ID.test(item.productId)) invalid('Each productId must be a valid ID.');
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 1000000) invalid('Product quantity must be a positive integer.');
    const id = item.productId.toLowerCase();
    totals.set(id, (totals.get(id) || 0) + item.quantity);
  }
  if (body.customerId !== undefined && body.customerId !== null) validateObjectId(body.customerId, 'customerId');
  const paymentType = body.paymentType;
  if (!['CASH', 'CREDIT'].includes(paymentType)) invalid('paymentType must be CASH or CREDIT.');
  const charges = body.additionalCharges === undefined ? [] : body.additionalCharges;
  if (!Array.isArray(charges) || charges.length > 50) invalid('additionalCharges must be an array of at most 50 charges.');
  const additionalCharges = charges.map((charge) => {
    if (!charge || typeof charge !== 'object' || Array.isArray(charge)) invalid('Each additional charge must be an object.');
    if (Object.keys(charge).some((key) => !['name', 'quantity', 'unitPrice'].includes(key))) invalid('A custom charge accepts only name, quantity, and unitPrice.');
    if (typeof charge.name !== 'string' || !charge.name.trim() || charge.name.trim().length > 120) invalid('Custom charge name is required and must be 120 characters or fewer.');
    const quantity = charge.quantity === undefined ? 1 : charge.quantity;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) invalid('Custom charge quantity must be positive.');
    const unitPrice = amountPaise(charge.unitPrice, 'unitPrice');
    const total = Math.round(unitPrice * quantity);
    if (!Number.isSafeInteger(total)) invalid('Custom charge total is too large.');
    return { name: charge.name.trim(), quantity, unitPrice, total };
  });
  const discount = body.discount === undefined ? 0 : amountPaise(body.discount, 'discount');
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))) {
    invalid('Idempotency-Key must be 8 to 128 safe characters.');
  }
  return {
    customerId: body.customerId ? body.customerId.toLowerCase() : null,
    items: [...totals].map(([productId, quantity]) => ({ productId, quantity })),
    additionalChargeItems: additionalCharges,
    discount,
    paymentType,
    idempotencyKey,
  };
}

function validateInvoiceQuery(query) {
  const pagination = validatePagination(query);
  const result = { ...pagination };
  if (query.customerId !== undefined) result.customerId = validateObjectId(query.customerId, 'customerId');
  if (query.status !== undefined) {
    if (!['PAID', 'UNPAID', 'PARTIALLY_PAID', 'DUE', 'CANCELLED'].includes(query.status)) invalid('status must be PAID, UNPAID, PARTIALLY_PAID, or CANCELLED.');
    result.status = query.status;
  }
  for (const field of ['from', 'to']) {
    if (query[field] !== undefined) {
      const value = new Date(query[field]);
      if (Number.isNaN(value.getTime())) invalid(`${field} must be a valid date.`);
      result[field] = value;
    }
  }
  if (result.from && result.to && result.from > result.to) invalid('from must be before to.');
  return result;
}

module.exports = { amountPaise, validateCreateInvoice, validateInvoiceQuery };
