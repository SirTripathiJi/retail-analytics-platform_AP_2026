const ApiError = require('../errors/ApiError');

const PRODUCT_FIELDS = new Set([
  'name', 'description', 'sku', 'categoryId', 'purchasePrice', 'sellingPrice',
  'stockQuantity', 'lowStockThreshold', 'unit', 'expiryDate',
]);
const CATEGORY_FIELDS = new Set(['name', 'description']);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function badRequest(message) {
  throw new ApiError(400, message, 'VALIDATION_ERROR');
}

function assertBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    badRequest('Request body must be a JSON object.');
  }
}

function assertAllowedFields(body, allowed) {
  const unknown = Object.keys(body).filter((field) => !allowed.has(field));
  if (unknown.length) badRequest(`Unsupported field: ${unknown[0]}.`);
}

function validateName(value, field = 'name') {
  if (typeof value !== 'string' || !value.trim()) badRequest(`${field} is required.`);
  if (value.trim().length > 150) badRequest(`${field} must be 150 characters or fewer.`);
  return value.trim();
}

function validateDescription(value) {
  if (typeof value !== 'string') badRequest('description must be a string.');
  if (value.length > 2000) badRequest('description must be 2000 characters or fewer.');
  return value.trim();
}

function validatePrice(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    badRequest(`${field} must be a non-negative number.`);
  }
  const paise = Math.round(value * 100);
  if (Math.abs(value * 100 - paise) > 1e-8 || !Number.isSafeInteger(paise)) {
    badRequest(`${field} must be a safe amount with at most two decimal places.`);
  }
  return value;
}

function validateQuantity(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    badRequest(`${field} must be a non-negative integer.`);
  }
  return value;
}

function validateSku(value) {
  if (typeof value !== 'string' || !value.trim()) badRequest('sku is required.');
  if (value.trim().length > 100) badRequest('sku must be 100 characters or fewer.');
  return value.trim();
}

function validateCategoryId(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    badRequest('categoryId must be a valid category ID or null.');
  }
  return value.toLowerCase();
}

function validateExpiryDate(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    badRequest('expiryDate must be an ISO date string or null.');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) badRequest('expiryDate must be a valid date.');
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day) {
    badRequest('expiryDate must be a valid calendar date.');
  }
  return date;
}

function validateUnit(value) {
  if (typeof value !== 'string' || !value.trim()) badRequest('unit must be a non-empty string.');
  if (value.trim().length > 30) badRequest('unit must be 30 characters or fewer.');
  return value.trim();
}

function validateCreateProduct(body) {
  assertBody(body);
  assertAllowedFields(body, PRODUCT_FIELDS);
  const required = ['name', 'sku', 'purchasePrice', 'sellingPrice', 'stockQuantity'];
  const missing = required.filter((field) => body[field] === undefined || body[field] === null);
  if (missing.length) badRequest(`Required fields are missing: ${missing.join(', ')}.`);

  return {
    name: validateName(body.name),
    description: body.description === undefined ? '' : validateDescription(body.description),
    sku: validateSku(body.sku),
    categoryId: body.categoryId === undefined ? null : validateCategoryId(body.categoryId),
    purchasePrice: validatePrice(body.purchasePrice, 'purchasePrice'),
    sellingPrice: validatePrice(body.sellingPrice, 'sellingPrice'),
    stockQuantity: validateQuantity(body.stockQuantity, 'stockQuantity'),
    lowStockThreshold: body.lowStockThreshold === undefined
      ? 0 : validateQuantity(body.lowStockThreshold, 'lowStockThreshold'),
    unit: body.unit === undefined ? 'unit' : validateUnit(body.unit),
    expiryDate: body.expiryDate === undefined ? null : validateExpiryDate(body.expiryDate),
  };
}

function validateUpdateProduct(body) {
  assertBody(body);
  assertAllowedFields(body, PRODUCT_FIELDS);
  const fields = Object.keys(body);
  if (!fields.length) badRequest('At least one product field must be provided.');

  const update = {};
  for (const field of fields) {
    switch (field) {
      case 'name': update.name = validateName(body.name); break;
      case 'description': update.description = validateDescription(body.description); break;
      case 'sku': update.sku = validateSku(body.sku); break;
      case 'categoryId': update.categoryId = validateCategoryId(body.categoryId); break;
      case 'purchasePrice': update.purchasePrice = validatePrice(body.purchasePrice, field); break;
      case 'sellingPrice': update.sellingPrice = validatePrice(body.sellingPrice, field); break;
      case 'stockQuantity': update.stockQuantity = validateQuantity(body.stockQuantity, field); break;
      case 'lowStockThreshold': update.lowStockThreshold = validateQuantity(body.lowStockThreshold, field); break;
      case 'unit': update.unit = validateUnit(body.unit); break;
      case 'expiryDate': update.expiryDate = validateExpiryDate(body.expiryDate); break;
      default: break;
    }
  }
  return update;
}

function validateCategory(body, { partial = false } = {}) {
  assertBody(body);
  assertAllowedFields(body, CATEGORY_FIELDS);
  if (partial && !Object.keys(body).length) badRequest('At least one category field must be provided.');
  if (!partial && (typeof body.name !== 'string' || !body.name.trim())) badRequest('name is required.');

  const category = {};
  if (body.name !== undefined) category.name = validateName(body.name);
  if (body.description !== undefined) category.description = validateDescription(body.description);
  if (!partial && category.description === undefined) category.description = '';
  return category;
}

function validateObjectId(id, label = 'id') {
  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id)) {
    throw new ApiError(400, `${label} must be a valid ID.`, 'INVALID_ID');
  }
  return id.toLowerCase();
}

function validatePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) badRequest('page must be a positive integer.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) badRequest('limit must be an integer from 1 to 100.');
  return { page, limit, skip: (page - 1) * limit };
}

function validateDays(value, defaultValue = 30) {
  const days = value === undefined ? defaultValue : Number(value);
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    badRequest('days must be an integer from 0 to 3650.');
  }
  return days;
}

function validateBooleanQuery(value, field) {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  badRequest(`${field} must be true or false.`);
}

module.exports = {
  validateBooleanQuery,
  validateCategory,
  validateCreateProduct,
  validateDays,
  validateObjectId,
  validatePagination,
  validateUpdateProduct,
};
