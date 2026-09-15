/**
 * GET /api/health
 * Simple liveness probe — no auth required.
 */

const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chainrescue-backend',
    timestamp: new Date().toISOString(),
    env: process.env.APP_ENV || 'development',
  });
});

module.exports = router;
