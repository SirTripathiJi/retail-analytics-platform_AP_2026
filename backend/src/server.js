require('dotenv').config();

const app = require('./app');
const { closeDatabaseConnection } = require('./config/database');

const port = Number(process.env.PORT) || 3001;
let server;
let shuttingDown = false;

function startServer() {
  server = app.listen(port, () => {
    console.log(`अर्थ SAATHI API listening on port ${port}.`);
    console.log('MongoDB integration is pending; no database connection was opened.');
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
    await closeDatabaseConnection();
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
