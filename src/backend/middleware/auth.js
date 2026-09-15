/**
 * Simple API-key authentication middleware.
 * Reads x-api-key header and compares against CHAINRESCUE_API_KEY env var.
 * Set CHAINRESCUE_API_KEY="" (empty) to disable auth in local dev.
 */

const logger = require('../utils/logger');

function requireApiKey(req, res, next) {
  const expectedKey = process.env.CHAINRESCUE_API_KEY;

  // Auth disabled when key is not configured (local dev convenience)
  if (!expectedKey) {
    return next();
  }

  const providedKey = req.headers['x-api-key'];
  if (!providedKey || providedKey !== expectedKey) {
    logger.warn(`Unauthorized request to ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized — valid x-api-key header required.' });
  }

  next();
}

module.exports = { requireApiKey };
