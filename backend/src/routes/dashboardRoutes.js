const express = require('express');
const { createAnalyticsController } = require('../controllers/analyticsController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createAnalyticsService } = require('../services/analyticsService');

function createDashboardRoutes({ analyticsRepository, jwtSecret, businessTimeZone, timeZoneResolver }) {
  const router = express.Router();
  const controller = createAnalyticsController(createAnalyticsService({ analyticsRepository, businessTimeZone, timeZoneResolver }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.get('/overview', controller.overview);
  return router;
}

module.exports = { createDashboardRoutes };
