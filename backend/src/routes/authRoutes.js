const express = require('express');
const { createAuthController } = require('../controllers/authController');
const { createAuthService } = require('../services/authService');

function createAuthRoutes({ userRepository, jwtSecret, jwtExpiresIn }) {
  const router = express.Router();
  const authService = createAuthService({ userRepository, jwtSecret, jwtExpiresIn });
  const controller = createAuthController(authService);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  return router;
}

module.exports = { createAuthRoutes };
