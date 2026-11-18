const ApiError = require('../errors/ApiError');
const { validateObjectId, validatePagination } = require('./inventoryValidation');
const METHODS = new Set(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']);
const TYPES = new Set(['INVOICE_CREATED', 'INVOICE_CANCELLED', 'PAYMENT_RECEIVED', 'CREDIT_RECORDED', 'KHATA_PAYMENT']);
function invalid(message) { throw new ApiError(400, message, 'VALIDATION_ERROR'); }
function money(value, field = 'amount') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
    invalid(`${field} must be a positive amount with at most two decimal places.`);
  }
  const paise = Math.round(value * 100);
  if (!Number.isSafeInteger(paise)) invalid(`${field} is too large.`);
  return paise;
}
function validatePaymentBody(body, { customerLevel = false, idempotencyKey } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Request body must be a JSON object.');
  const allowed = new Set(['amount', 'paymentMethod', 'note', 'referenceNumber', ...(customerLevel ? ['allocations'] : [])]);
  const unknown = Object.keys(body).find((field) => !allowed.has(field));
  if (unknown) invalid(`Unsupported payment field: ${unknown}.`);
  const amount = money(body.amount);
  if (typeof body.paymentMethod !== 'string' || !METHODS.has(body.paymentMethod.trim().toUpperCase())) {
    invalid('paymentMethod must be CASH, UPI, CARD, BANK_TRANSFER, or OTHER.');
  }
  const note = body.note === undefined ? '' : body.note;
  if (typeof note !== 'string' || note.trim().length > 1000) invalid('note must be a string of 1000 characters or fewer.');
  const referenceNumber = body.referenceNumber === undefined ? null : body.referenceNumber;
  if (referenceNumber !== null && (typeof referenceNumber !== 'string' || referenceNumber.trim().length > 150)) {
    invalid('referenceNumber must be a string of 150 characters or fewer.');
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))) {
    invalid('Idempotency-Key must be 8 to 128 safe characters.');
  }
  let allocations;
  if (customerLevel && body.allocations !== undefined) {
    if (!Array.isArray(body.allocations) || !body.allocations.length || body.allocations.length > 100) invalid('allocations must contain 1 to 100 entries.');
    const seen = new Set();
    allocations = body.allocations.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => !['invoiceId', 'allocatedAmount'].includes(key))) {
        invalid('Each allocation must contain invoiceId and allocatedAmount only.');
      }
      const invoiceId = validateObjectId(entry.invoiceId, 'invoiceId');
      if (seen.has(invoiceId)) invalid('Duplicate invoice IDs are not allowed in allocations.');
      seen.add(invoiceId);
      return { invoiceId, allocatedAmount: money(entry.allocatedAmount, 'allocatedAmount') };
    });
    if (allocations.reduce((sum, entry) => sum + entry.allocatedAmount, 0) !== amount) invalid('Allocation totals must equal the payment amount.');
  }
  return { amount, paymentMethod: body.paymentMethod.trim().toUpperCase(), note: note.trim(),
    referenceNumber: referenceNumber?.trim() || null, allocations, idempotencyKey };
}
function validatePaymentQuery(query) {
  const result = { ...validatePagination(query) };
  if (query.customerId !== undefined) result.customerId = validateObjectId(query.customerId, 'customerId');
  if (query.invoiceId !== undefined) result.invoiceId = validateObjectId(query.invoiceId, 'invoiceId');
  if (query.paymentMethod !== undefined) {
    const method = String(query.paymentMethod).toUpperCase();
    if (!METHODS.has(method)) invalid('paymentMethod is invalid.');
    result.paymentMethod = method;
  }
  for (const field of ['from', 'to']) if (query[field] !== undefined) {
    const date = new Date(query[field]);
    if (Number.isNaN(date.getTime())) invalid(`${field} must be a valid date.`);
    result[field] = date;
  }
  if (result.from && result.to && result.from > result.to) invalid('from must be before to.');
  return result;
}
function validateTransactionQuery(query) {
  const result = validatePaymentQuery(query);
  if (query.invoiceId !== undefined) result.invoiceId = validateObjectId(query.invoiceId, 'invoiceId');
  if (query.type !== undefined) {
    if (!TYPES.has(query.type)) invalid('type is not a supported transaction type.');
    result.type = query.type;
  }
  return result;
}
module.exports = { METHODS, money, validatePaymentBody, validatePaymentQuery, validateTransactionQuery };
