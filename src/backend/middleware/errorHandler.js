/**
 * Global error-handling middleware for Express.
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${status}] ${req.method} ${req.originalUrl} — ${message}`);
  if (err.stack && process.env.APP_ENV !== 'production') {
    logger.error(err.stack);
  }

  res.status(status).json({
    error: message,
    ...(process.env.APP_ENV !== 'production' && { stack: err.stack }),
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
