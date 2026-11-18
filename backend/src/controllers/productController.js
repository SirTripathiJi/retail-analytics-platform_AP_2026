function createProductController(productService) {
  return {
    create: async (request, response) => {
      const product = await productService.create(request.body, request.auth.businessId);
      response.status(201).json({ product });
    },
    list: async (request, response) => {
      response.status(200).json(await productService.list(request.query, request.auth.businessId));
    },
    getById: async (request, response) => {
      const product = await productService.getById(request.params.id, request.auth.businessId);
      response.status(200).json({ product });
    },
    update: async (request, response) => {
      const product = await productService.update(request.params.id, request.body, request.auth.businessId);
      response.status(200).json({ product });
    },
    delete: async (request, response) => {
      response.status(200).json(await productService.delete(request.params.id, request.auth.businessId));
    },
    lowStock: async (request, response) => {
      response.status(200).json(await productService.lowStock(request.query, request.auth.businessId));
    },
    expiring: async (request, response) => {
      response.status(200).json(await productService.expiring(request.query, request.auth.businessId));
    },
    expired: async (request, response) => {
      response.status(200).json(await productService.expired(request.query, request.auth.businessId));
    },
  };
}

module.exports = { createProductController };
