function createBusinessController(businessService) {
  return {
    getProfile: async (request, response) => response.status(200).json({
      profile: await businessService.getProfile(request.auth.businessId),
    }),
    updateProfile: async (request, response) => response.status(200).json({
      profile: await businessService.updateProfile(request.body, request.auth.businessId),
    }),
    getSettings: async (request, response) => response.status(200).json({
      settings: await businessService.getSettings(request.auth.businessId),
    }),
    updateSettings: async (request, response) => response.status(200).json({
      settings: await businessService.updateSettings(request.body, request.auth.businessId),
    }),
    previewReset: async (request, response) => response.status(200).json(
      await businessService.previewReset(request.auth.businessId),
    ),
    reset: async (request, response) => response.status(200).json(await businessService.reset(
      request.body, request.auth.businessId, request.auth.userId,
    )),
  };
}

module.exports = { createBusinessController };
