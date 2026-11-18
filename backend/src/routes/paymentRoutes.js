const express = require('express');
const { createPaymentController } = require('../controllers/paymentController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createPaymentService } = require('../services/paymentService');

function createPaymentRoutes({ invoiceRepository, customerRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createPaymentController(createPaymentService({ invoiceRepository, customerRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.get('/summary', controller.summary);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  return router;
}
module.exports = { createPaymentRoutes };
