const { isDatabaseConnected } = require('../config/database');

function getHealth(_request, response) {
  response.status(200).json({
    status: 'ok',
    service: 'arth-saathi-api',
    timestamp: new Date().toISOString(),
    database: isDatabaseConnected() ? 'connected' : 'not_configured',
  });
}

module.exports = { getHealth };
