const express = require('express');
const { createCustomerController } = require('../controllers/customerController');
const { createKhataController } = require('../controllers/khataController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createCustomerService } = require('../services/customerService');
const { createKhataService } = require('../services/khataService');
const { createPaymentService } = require('../services/paymentService');
const { createPaymentController } = require('../controllers/paymentController');

function createCustomerRoutes({ customerRepository, ledgerRepository, invoiceRepository, jwtSecret }) {
  const router = express.Router();
  const customerController = createCustomerController(createCustomerService({
    customerRepository, ledgerRepository, invoiceRepository,
  }));
  const khataController = createKhataController(createKhataService({ customerRepository, ledgerRepository }));
  const paymentController = createPaymentController(createPaymentService({ invoiceRepository, customerRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));

  router.post('/', customerController.create);
  router.get('/', customerController.list);
  router.get('/:id/khata/summary', khataController.summary);
  router.get('/:id/khata', khataController.ledger);
  router.post('/:id/khata/credit', khataController.credit);
  router.post('/:id/khata/payments', khataController.payment);
  router.post('/:id/payments', paymentController.payCustomer);
  router.get('/:id/purchases', customerController.purchaseHistory);
  router.get('/:id', customerController.getById);
  router.put('/:id', customerController.update);
  router.delete('/:id', customerController.delete);

  return router;
}

module.exports = { createCustomerRoutes };
