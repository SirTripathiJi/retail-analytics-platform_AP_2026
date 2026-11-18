const ApiError = require('../errors/ApiError');
const {
  DEFAULT_SETTINGS, RESET_CONFIRMATION, validateProfileUpdate, validateResetRequest, validateSettingsUpdate,
} = require('../validators/businessValidation');

function requireBusinessId(value) {
  if (!value) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(value);
}

function createBusinessService({ businessRepository, now = () => new Date() }) {
  return {
    async getProfile(businessValue) {
      const businessId = requireBusinessId(businessValue);
      const profile = await businessRepository.getProfile(businessId);
      if (!profile) throw new ApiError(404, 'Business profile has not been created.', 'BUSINESS_PROFILE_NOT_FOUND');
      return profile;
    },
    async updateProfile(body, businessValue) {
      const businessId = requireBusinessId(businessValue);
      const fields = validateProfileUpdate(body);
      const current = await businessRepository.getProfile(businessId);
      if (!current && !fields.businessName) {
        throw new ApiError(400, 'businessName is required when creating a business profile.', 'BUSINESS_NAME_REQUIRED');
      }
      return businessRepository.updateProfile(businessId, { ...fields, updatedAt: now() });
    },
    async getSettings(businessValue) {
      const businessId = requireBusinessId(businessValue);
      return { ...DEFAULT_SETTINGS, ...(await businessRepository.getSettings(businessId)) };
    },
    async updateSettings(body, businessValue) {
      const businessId = requireBusinessId(businessValue);
      const fields = validateSettingsUpdate(body);
      return businessRepository.updateSettings(businessId, fields);
    },
    async previewReset(businessValue) {
      const businessId = requireBusinessId(businessValue);
      const snapshot = await businessRepository.previewReset(businessId);
      return { businessId, ...snapshot, asOf: now() };
    },
    async reset(body, businessValue, actorId) {
      const businessId = requireBusinessId(businessValue);
      const { counts, snapshotFingerprint } = validateResetRequest(body);
      const result = await businessRepository.resetBusinessData({ businessId, expectedCounts: counts, expectedFingerprint: snapshotFingerprint, actorId });
      return { success: true, businessId, resetAt: result.resetAt, deletedCounts: result.deletedCounts,
        confirmationText: RESET_CONFIRMATION };
    },
  };
}

module.exports = { createBusinessService };
