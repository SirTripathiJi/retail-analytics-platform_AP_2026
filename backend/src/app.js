const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const healthRoutes = require('./routes/healthRoutes');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createProductRoutes } = require('./routes/productRoutes');
const { createCategoryRoutes } = require('./routes/categoryRoutes');
const { createCustomerRoutes } = require('./routes/customerRoutes');
const { createKhataRoutes } = require('./routes/khataRoutes');
const { createInvoiceRoutes } = require('./routes/invoiceRoutes');
const { createPaymentRoutes } = require('./routes/paymentRoutes');
const { createTransactionRoutes } = require('./routes/transactionRoutes');
const { createAnalyticsRoutes } = require('./routes/analyticsRoutes');
const { createDashboardRoutes } = require('./routes/dashboardRoutes');
const unavailableUserRepository = require('./repositories/unavailableUserRepository');
const { categoryRepository, productRepository } = require('./repositories/unavailableInventoryRepositories');
const {
  customerRepository,
  invoiceRepository,
  ledgerRepository,
} = require('./repositories/unavailableCustomerRepositories');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const unavailableAnalyticsRepository = require('./repositories/unavailableAnalyticsRepository');
const unavailableBusinessRepository = require('./repositories/unavailableBusinessRepository');
const { createBusinessRoutes } = require('./routes/businessRoutes');

function createApp({
  userRepository = unavailableUserRepository,
  // TODO: The integration owner injects the tenant-selected repositories here.
  inventoryProductRepository = productRepository,
  inventoryCategoryRepository = categoryRepository,
  // TODO: Inject customer and ledger repositories from the same tenant Db.
  customerDataRepository = customerRepository,
  customerLedgerRepository = ledgerRepository,
  invoiceDataRepository = invoiceRepository,
  // TODO: Inject a tenant-Db-backed business repository for profile, settings, and reset.
  businessDataRepository = null,
  // TODO: Inject analytics repository backed by the authenticated tenant Db.
  analyticsDataRepository = unavailableAnalyticsRepository,
  businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'UTC',
  jwtSecret = process.env.JWT_SECRET,
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h',
} = {}) {
  const app = express();
  const businessRepository = businessDataRepository || unavailableBusinessRepository;
  const timeZoneResolver = businessDataRepository
    ? async (businessId) => (await businessDataRepository.getSettings(businessId)).timezone
    : undefined;
  const defaultOrigins = process.env.NODE_ENV === 'production'
    ? '' : 'http://localhost:5173,http://localhost:4173';
  const allowedOrigins = (process.env.CORS_ORIGIN ?? defaultOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.includes('*')) throw new Error('CORS_ORIGIN must list explicit origins; wildcard origins are not allowed.');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
  app.use(express.json({ limit: '1mb', strict: true }));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again later.', code: 'RATE_LIMITED' },
  });
  app.use('/api', healthRoutes);
  app.use('/api/auth', authLimiter, createAuthRoutes({ userRepository, jwtSecret, jwtExpiresIn }));
  app.use('/api/products', createProductRoutes({
    productRepository: inventoryProductRepository,
    categoryRepository: inventoryCategoryRepository,
    businessSettingsRepository: businessDataRepository || undefined,
    jwtSecret,
  }));
  app.use('/api/categories', createCategoryRoutes({
    categoryRepository: inventoryCategoryRepository,
    productRepository: inventoryProductRepository,
    jwtSecret,
  }));
  app.use('/api/customers', createCustomerRoutes({
    customerRepository: customerDataRepository,
    ledgerRepository: customerLedgerRepository,
    invoiceRepository: invoiceDataRepository,
    jwtSecret,
  }));
  app.use('/api/khata', createKhataRoutes({
    customerRepository: customerDataRepository,
    ledgerRepository: customerLedgerRepository,
    jwtSecret,
  }));
  app.use('/api/invoices', createInvoiceRoutes({
    invoiceRepository: invoiceDataRepository,
    productRepository: inventoryProductRepository,
    customerRepository: customerDataRepository,
    jwtSecret,
  }));
  app.use('/api/payments', createPaymentRoutes({
    invoiceRepository: invoiceDataRepository,
    customerRepository: customerDataRepository,
    jwtSecret,
  }));
  app.use('/api/transactions', createTransactionRoutes({
    invoiceRepository: invoiceDataRepository,
    customerRepository: customerDataRepository,
    jwtSecret,
  }));
  app.use('/api/dashboard', createDashboardRoutes({ analyticsRepository: analyticsDataRepository, jwtSecret, businessTimeZone, timeZoneResolver }));
  app.use('/api/analytics', createAnalyticsRoutes({ analyticsRepository: analyticsDataRepository, jwtSecret, businessTimeZone, timeZoneResolver }));
  app.use('/api/business', createBusinessRoutes({ businessRepository, jwtSecret }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
