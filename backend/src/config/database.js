let centralDatabase;
let closeCentralConnection;

/**
 * TODO: The database integration owner must create the MongoClient from
 * approved runtime configuration, connect it, then register its Db/close
 * handles here. Keep URI and database selection out of this boundary.
 * Register handles created by the future MongoDB integration adapter.
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
  getDatabase,
  isDatabaseConnected,
  registerCentralDatabase,
};
