const { MongoClient } = require('mongodb');

let centralDatabase;
let closeCentralConnection;

async function connectCentralDatabase({
  uri = process.env.CENTRAL_MONGODB_URI,
  databaseName = process.env.CENTRAL_MONGODB_DATABASE,
  serverSelectionTimeoutMS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
} = {}) {
  if (!uri || !databaseName) return { configured: false, connected: false };
  if (centralDatabase) return { configured: true, connected: true, database: centralDatabase };

  const client = new MongoClient(uri, {
    appName: 'arth-saathi-api',
    serverSelectionTimeoutMS,
    retryWrites: true,
  });
  try {
    await client.connect();
    const database = client.db(databaseName);
    await database.command({ ping: 1 });
    await database.collection('users').createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' });
    await database.collection('businessMemberships').createIndex(
      { userId: 1, businessId: 1 }, { unique: true, name: 'memberships_user_business_unique' },
    );
    await database.collection('tenantConnections').createIndex(
      { businessId: 1 }, { unique: true, name: 'tenant_connections_business_unique' },
    );
    registerCentralDatabase({ database, close: () => client.close() });
    return { configured: true, connected: true, database };
  } catch {
    await client.close().catch(() => {});
    throw new Error('Central MongoDB could not be initialized. Check the configured Atlas connection and database access.');
  }
}

/**
 * Register a connected central Db and its close callback. URI and database
 * selection stay inside connectCentralDatabase.
 * @param {{ database: import('mongodb').Db, close: () => Promise<void> }} connection
 */
function registerCentralDatabase(connection) {
  if (!connection?.database || typeof connection.close !== 'function') {
    throw new TypeError('A database handle and close function are required.');
  }

  centralDatabase = connection.database;
  closeCentralConnection = connection.close;
}

function getDatabase() {
  if (!centralDatabase) {
    throw new Error('Central database integration is not configured.');
  }
  return centralDatabase;
}

function isDatabaseConnected() {
  return Boolean(centralDatabase);
}

async function closeDatabaseConnection() {
  if (!closeCentralConnection) return;

  const close = closeCentralConnection;
  centralDatabase = undefined;
  closeCentralConnection = undefined;
  await close();
}

module.exports = {
  closeDatabaseConnection,
  connectCentralDatabase,
  getDatabase,
  isDatabaseConnected,
  registerCentralDatabase,
};
