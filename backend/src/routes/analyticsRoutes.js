const express = require('express');
const { createAnalyticsController } = require('../controllers/analyticsController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createAnalyticsService } = require('../services/analyticsService');

function createAnalyticsRoutes({ analyticsRepository, jwtSecret, businessTimeZone, timeZoneResolver }) {
  const router = express.Router();
  const controller = createAnalyticsController(createAnalyticsService({ analyticsRepository, businessTimeZone, timeZoneResolver }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.get('/sales', controller.sales);
  router.get('/categories', controller.categories);
  router.get('/products', controller.products);
  router.get('/inventory', controller.inventory);
  return router;
}

module.exports = { createAnalyticsRoutes };
