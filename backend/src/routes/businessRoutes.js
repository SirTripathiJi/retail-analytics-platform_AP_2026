const express = require('express');
const { createBusinessController } = require('../controllers/businessController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createBusinessService } = require('../services/businessService');

function createBusinessRoutes({ businessRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createBusinessController(createBusinessService({ businessRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.get('/profile', controller.getProfile);
  router.put('/profile', controller.updateProfile);
  router.get('/settings', controller.getSettings);
  router.put('/settings', controller.updateSettings);
  router.get('/reset/preview', controller.previewReset);
  router.post('/reset', controller.reset);
  return router;
}

module.exports = { createBusinessRoutes };
