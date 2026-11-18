const express = require('express');
const { createProductController } = require('../controllers/productController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createProductService } = require('../services/productService');

function createProductRoutes({ productRepository, categoryRepository, businessSettingsRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createProductController(createProductService({ productRepository, categoryRepository, businessSettingsRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));

  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/low-stock', controller.lowStock);
  router.get('/expiring', controller.expiring);
  router.get('/expired', controller.expired);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}

module.exports = { createProductRoutes };
