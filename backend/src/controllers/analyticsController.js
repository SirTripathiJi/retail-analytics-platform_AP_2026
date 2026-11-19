function createAnalyticsController(analyticsService) {
  return {
    overview: async (request, response) => response.status(200).json({
      overview: await analyticsService.overview(request.query, request.auth.businessId),
    }),
    sales: async (request, response) => response.status(200).json(
      await analyticsService.sales(request.query, request.auth.businessId),
    ),
    categories: async (request, response) => response.status(200).json(
      await analyticsService.categories(request.query, request.auth.businessId),
    ),
    products: async (request, response) => response.status(200).json(
      await analyticsService.products(request.query, request.auth.businessId),
    ),
    inventory: async (request, response) => response.status(200).json({
      inventory: await analyticsService.inventory(request.query, request.auth.businessId),
    }),
  };
}

module.exports = { createAnalyticsController };
