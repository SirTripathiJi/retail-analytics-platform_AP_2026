require('dotenv').config();

const { createApp } = require('./app');
const { closeDatabaseConnection, connectCentralDatabase } = require('./config/database');
const { createTenantRepositoryProvider } = require('./config/tenantRepositoryProvider');
const { createMongoUserRepository } = require('./repositories/mongoUserRepository');

const port = Number(process.env.PORT) || 3001;
let server;
let shuttingDown = false;
let tenantRepositoryProvider;

async function startServer() {
  const database = await connectCentralDatabase();
  tenantRepositoryProvider = database.connected
    ? createTenantRepositoryProvider({ centralDatabase: database.database })
    : null;
  const app = createApp({
    ...(database.connected ? { userRepository: createMongoUserRepository(database.database) } : {}),
    ...(tenantRepositoryProvider ? { tenantRepositoryProvider } : {}),
  });
  server = app.listen(port, () => {
    console.log(`अर्थ SAATHI API listening on port ${port}.`);
    console.log(database.connected
      ? 'Central MongoDB connection is ready.'
      : 'Central MongoDB is not configured; database-backed operations will be unavailable.');
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down gracefully.`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (tenantRepositoryProvider) await tenantRepositoryProvider.close();
    await closeDatabaseConnection();
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch((error) => {
  console.error(error.message || 'Central MongoDB initialization failed.');
  process.exit(1);
});
