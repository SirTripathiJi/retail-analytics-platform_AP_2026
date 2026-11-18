function createCategoryController(categoryService) {
  return {
    create: async (request, response) => {
      const category = await categoryService.create(request.body, request.auth.businessId);
      response.status(201).json({ category });
    },
    list: async (request, response) => {
      response.status(200).json(await categoryService.list(request.query, request.auth.businessId));
    },
    update: async (request, response) => {
      const category = await categoryService.update(request.params.id, request.body, request.auth.businessId);
      response.status(200).json({ category });
    },
    delete: async (request, response) => {
      response.status(200).json(await categoryService.delete(request.params.id, request.auth.businessId));
    },
  };
}

module.exports = { createCategoryController };
