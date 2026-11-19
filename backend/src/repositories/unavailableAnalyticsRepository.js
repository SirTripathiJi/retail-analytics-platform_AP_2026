const ApiError = require('../errors/ApiError');

function unavailable() {
  throw new ApiError(503, 'Analytics data repositories are not configured.', 'PERSISTENCE_UNAVAILABLE');
}

// The runtime never substitutes fixture or in-memory data for persistent analytics.
module.exports = {
  overview: unavailable,
  sales: unavailable,
  categoryPerformance: unavailable,
  productPerformance: unavailable,
  inventory: unavailable,
};
