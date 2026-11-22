const ApiError = require('../errors/ApiError');
const { tenantRequestContext } = require('../config/tenantRepositoryProvider');

function createResolveTenantContext(tenantRepositoryProvider) {
  if (!tenantRepositoryProvider || typeof tenantRepositoryProvider.resolveRequestContext !== 'function') {
    throw new TypeError('A tenant repository provider is required.');
  }

  return async function resolveTenantContext(request, _response, next) {
    try {
      if (!request.auth?.userId || !request.auth?.businessId) {
        throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
      }
      const context = await tenantRepositoryProvider.resolveRequestContext({
        userId: request.auth.userId,
        businessId: String(request.auth.businessId),
      });
      tenantRequestContext.run(context, () => next());
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { createResolveTenantContext };
