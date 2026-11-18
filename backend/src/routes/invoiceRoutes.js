const express = require('express');
const { createInvoiceController } = require('../controllers/invoiceController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createInvoiceService } = require('../services/invoiceService');
const { createPaymentService } = require('../services/paymentService');
const { createPaymentController } = require('../controllers/paymentController');

function createInvoiceRoutes({ invoiceRepository, productRepository, customerRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createInvoiceController(createInvoiceService({ invoiceRepository, productRepository, customerRepository }));
  const paymentController = createPaymentController(createPaymentService({ invoiceRepository, customerRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/number/:invoiceNumber', controller.getByNumber);
  router.post('/:id/cancel', controller.cancel);
  router.post('/:id/payments', paymentController.payInvoice);
  router.get('/:id', controller.getById);
  return router;
}
module.exports = { createInvoiceRoutes };
