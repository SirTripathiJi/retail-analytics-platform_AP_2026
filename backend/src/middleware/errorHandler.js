const ApiError = require('../errors/ApiError');

function notFoundHandler(request, response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;
  const isMalformedJson = error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body');
  const isTooLarge = error.type === 'entity.too.large';
  const status = isMalformedJson ? 400 : isTooLarge ? 413 : error.status || 500;
  const knownApiError = error instanceof ApiError;
  response.status(status).json({
    error: isMalformedJson ? 'Malformed JSON request body.'
      : isTooLarge ? 'Request body exceeds the 1 MB limit.'
        : status >= 500 && !knownApiError ? 'Internal server error'
          : status === 500 ? 'Internal server error' : error.message,
    ...((knownApiError || isMalformedJson || isTooLarge) && {
      code: isMalformedJson ? 'INVALID_JSON' : isTooLarge ? 'PAYLOAD_TOO_LARGE' : error.code,
    }),
  });
}

module.exports = { errorHandler, notFoundHandler };
