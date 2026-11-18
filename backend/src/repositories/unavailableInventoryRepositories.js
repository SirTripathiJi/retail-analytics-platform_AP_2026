const ApiError = require('../errors/ApiError');

// TODO: Replace these explicit unavailable boundaries with tenant-scoped
// MongoDB repositories once tenant Db selection is injected by the integration owner.
const unavailable = async () => {
  throw new ApiError(503, 'Inventory persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
};

const productRepository = {
  create: unavailable,
  list: unavailable,
  findById: unavailable,
  updateById: unavailable,
  deleteById: unavailable,
  findLowStock: unavailable,
  findExpiring: unavailable,
  findExpired: unavailable,
  countByCategory: unavailable,
};

const categoryRepository = {
  create: unavailable,
  list: unavailable,
  findById: unavailable,
  findByName: unavailable,
  updateById: unavailable,
  deleteById: unavailable,
};

module.exports = { categoryRepository, productRepository };
