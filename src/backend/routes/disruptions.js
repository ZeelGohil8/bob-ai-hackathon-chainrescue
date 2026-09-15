/**
 * Disruption Alert Routes
 *
 * GET    /api/disruptions              — list all active disruption events
 * GET    /api/disruptions/:id          — get single event detail
 * POST   /api/disruptions              — ingest a new disruption event
 * POST   /api/disruptions/:id/analyse  — run watsonx.ai impact analysis
 * POST   /api/disruptions/scan/temperature — scan cold-chain shipments for breaches
 */

const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/auth');
const {
  listEvents,
  getEventById,
  createEvent,
  analyseImpact,
  scanTemperatureBreaches,
} = require('../services/disruptionService');

// ── GET /api/disruptions ─────────────────────────────────────────────────────
router.get('/', requireApiKey, (req, res) => {
  const { severity, type } = req.query;
  const events = listEvents({ severity, type });
  res.json({ count: events.length, events });
});

// ── GET /api/disruptions/:id ─────────────────────────────────────────────────
router.get('/:id', requireApiKey, (req, res, next) => {
  try {
    const event = getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: `Disruption event '${req.params.id}' not found.` });
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/disruptions ────────────────────────────────────────────────────
router.post('/', requireApiKey, (req, res, next) => {
  try {
    const { type, subtype, severity, affectedRegion, description, affectedShipments } = req.body;

    if (!type || !severity || !affectedRegion || !description) {
      return res.status(400).json({
        error: 'Missing required fields: type, severity, affectedRegion, description.',
      });
    }

    const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({
        error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}.`,
      });
    }

    const event = createEvent({ type, subtype, severity, affectedRegion, description, affectedShipments });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/disruptions/:id/analyse ────────────────────────────────────────
router.post('/:id/analyse', requireApiKey, async (req, res, next) => {
  try {
    const updatedEvent = await analyseImpact(req.params.id);
    res.json(updatedEvent);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/disruptions/scan/temperature ───────────────────────────────────
router.post('/scan/temperature', requireApiKey, (req, res, next) => {
  try {
    const newEvents = scanTemperatureBreaches();
    res.json({
      scanned: true,
      newEventsCreated: newEvents.length,
      events: newEvents,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
