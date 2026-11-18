const express = require('express');
const { createPaymentController } = require('../controllers/paymentController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createPaymentService } = require('../services/paymentService');

function createTransactionRoutes({ invoiceRepository, customerRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createPaymentController(createPaymentService({ invoiceRepository, customerRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.get('/', controller.transactions);
  router.get('/:id', controller.transaction);
  return router;
}
module.exports = { createTransactionRoutes };
