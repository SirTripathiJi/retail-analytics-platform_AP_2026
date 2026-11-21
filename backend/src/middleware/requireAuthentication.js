const jwt = require('jsonwebtoken');
const ApiError = require('../errors/ApiError');

function createRequireAuthentication({ jwtSecret = process.env.JWT_SECRET } = {}) {
  return function requireAuthentication(request, _response, next) {
    const authorization = request.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return next(new ApiError(401, 'A Bearer token is required.', 'AUTHENTICATION_REQUIRED'));
    }
    if (!jwtSecret) {
      return next(new ApiError(503, 'Authentication token verification is not configured.', 'AUTH_CONFIGURATION_UNAVAILABLE'));
    }

    try {
      const payload = jwt.verify(match[1], jwtSecret);
      if (typeof payload !== 'object' || !payload.sub) {
        throw new Error('Token subject is missing.');
      }
      request.auth = {
        userId: payload.sub,
        businessId: payload.businessId || payload.sub,
        email: payload.email,
      };
      return next();
    } catch (_error) {
      return next(new ApiError(401, 'The authentication token is invalid or expired.', 'INVALID_TOKEN'));
    }
  };
}

module.exports = { createRequireAuthentication };
