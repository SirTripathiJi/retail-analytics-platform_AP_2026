function createCustomerController(customerService) {
  return {
    create: async (request, response) => {
      const customer = await customerService.create(request.body, request.auth.businessId);
      response.status(201).json({ customer });
    },
    list: async (request, response) => {
      response.status(200).json(await customerService.list(request.query, request.auth.businessId));
    },
    getById: async (request, response) => {
      const customer = await customerService.getById(request.params.id, request.auth.businessId);
      response.status(200).json({ customer });
    },
    update: async (request, response) => {
      const customer = await customerService.update(request.params.id, request.body, request.auth.businessId);
      response.status(200).json({ customer });
    },
    delete: async (request, response) => {
      response.status(200).json(await customerService.delete(request.params.id, request.auth.businessId));
    },
    purchaseHistory: async (request, response) => {
      response.status(200).json(await customerService.purchaseHistory(
        request.params.id, request.query, request.auth.businessId,
      ));
    },
  };
}

module.exports = { createCustomerController };
