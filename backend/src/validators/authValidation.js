const ApiError = require('../errors/ApiError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.', 'INVALID_REQUEST_BODY');
  }
}

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw new ApiError(400, 'Email is required.', 'VALIDATION_ERROR');
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    throw new ApiError(400, 'A valid email address is required.', 'VALIDATION_ERROR');
  }
  return normalized;
}

function validateRegistration(body) {
  requireObjectBody(body);
  const missing = ['fullName', 'email', 'password', 'businessName']
    .filter((field) => typeof body[field] !== 'string' || !body[field].trim());

  if (missing.length) {
    throw new ApiError(400, `Required fields are missing: ${missing.join(', ')}.`, 'VALIDATION_ERROR');
  }

  const password = body.password;
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ApiError(
      400,
      'Password must be at least 8 characters and include a letter and a number.',
      'VALIDATION_ERROR',
    );
  }

  return {
    fullName: body.fullName.trim(),
    email: normalizeEmail(body.email),
    password,
    businessName: body.businessName.trim(),
  };
}

function validateLogin(body) {
  requireObjectBody(body);
  const email = normalizeEmail(body.email);
  if (typeof body.password !== 'string' || !body.password) {
    throw new ApiError(400, 'Password is required.', 'VALIDATION_ERROR');
  }
  const businessId = typeof body.businessId === 'string' && body.businessId.trim()
    ? body.businessId.trim() : undefined;
  return { email, password: body.password, businessId };
}

module.exports = { validateLogin, validateRegistration };
