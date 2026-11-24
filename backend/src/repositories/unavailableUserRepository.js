const ApiError = require('../errors/ApiError');

// TODO: Replace this boundary with the MongoDB-backed user repository after
// the central database integration is supplied. This intentionally persists
// nothing and prevents auth from appearing operational without persistence.
const unavailable = async () => {
  throw new ApiError(503, 'User persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
};

module.exports = {
  createUser: unavailable,
  findByEmail: unavailable,
  findById: unavailable,
  findMembershipsByUserId: unavailable,
};
