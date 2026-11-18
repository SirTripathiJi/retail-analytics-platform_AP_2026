const ApiError = require('../errors/ApiError');

function unavailable() {
  throw new ApiError(503, 'Business data repository is not configured.', 'PERSISTENCE_UNAVAILABLE');
}

module.exports = {
  getProfile: unavailable,
  updateProfile: unavailable,
  getSettings: unavailable,
  updateSettings: unavailable,
  previewReset: unavailable,
  resetBusinessData: unavailable,
};
