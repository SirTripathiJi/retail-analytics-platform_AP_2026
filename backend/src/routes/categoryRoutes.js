const express = require('express');
const { createCategoryController } = require('../controllers/categoryController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createCategoryService } = require('../services/categoryService');

function createCategoryRoutes({ categoryRepository, productRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createCategoryController(createCategoryService({ categoryRepository, productRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));

  router.post('/', controller.create);
  router.get('/', controller.list);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}

module.exports = { createCategoryRoutes };
