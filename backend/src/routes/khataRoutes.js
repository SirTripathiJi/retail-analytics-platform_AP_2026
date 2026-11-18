const express = require('express');
const { createKhataController } = require('../controllers/khataController');
const { createRequireAuthentication } = require('../middleware/requireAuthentication');
const { createKhataService } = require('../services/khataService');

function createKhataRoutes({ customerRepository, ledgerRepository, jwtSecret }) {
  const router = express.Router();
  const controller = createKhataController(createKhataService({ customerRepository, ledgerRepository }));
  router.use(createRequireAuthentication({ jwtSecret }));
  router.get('/outstanding', controller.outstanding);
  return router;
}

module.exports = { createKhataRoutes };
