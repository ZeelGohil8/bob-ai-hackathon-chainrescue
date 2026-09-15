/**
 * Fleet Route Optimization Routes
 *
 * GET  /api/fleet                            — list all vehicles
 * GET  /api/fleet/utilization                — fleet utilization stats
 * GET  /api/fleet/insights                   — AI-generated fleet insights (watsonx.ai)
 * GET  /api/fleet/:id                        — get single vehicle
 * POST /api/fleet/assign                     — find best available vehicle for a shipment
 * POST /api/fleet/reroute                    — suggest optimized reroute for a shipment
 */

const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/auth');
const {
  listVehicles,
  getVehicleById,
  getUtilizationStats,
  findBestVehicle,
  suggestReroute,
  generateFleetInsights,
} = require('../services/fleetService');
const { listEvents } = require('../services/disruptionService');

// ── GET /api/fleet ────────────────────────────────────────────────────────────
router.get('/', requireApiKey, (req, res) => {
  const { status, type } = req.query;
  const vehicles = listVehicles({ status, type });
  res.json({ count: vehicles.length, vehicles });
});

// ── GET /api/fleet/utilization ────────────────────────────────────────────────
// NOTE: must be declared before /:id to avoid route shadowing
router.get('/utilization', requireApiKey, (req, res) => {
  const stats = getUtilizationStats();
  res.json(stats);
});

// ── GET /api/fleet/insights ───────────────────────────────────────────────────
router.get('/insights', requireApiKey, async (req, res, next) => {
  try {
    const activeDisruptions = listEvents().length;
    const result = await generateFleetInsights(activeDisruptions);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/fleet/:id ────────────────────────────────────────────────────────
router.get('/:id', requireApiKey, (req, res) => {
  const vehicle = getVehicleById(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: `Vehicle '${req.params.id}' not found.` });
  }
  res.json(vehicle);
});

// ── POST /api/fleet/assign ────────────────────────────────────────────────────
router.post('/assign', requireApiKey, (req, res, next) => {
  try {
    const { shipmentId, requiredCargoType, weightKg, originLat, originLon } = req.body;

    if (!shipmentId || originLat === undefined || originLon === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: shipmentId, originLat, originLon.',
      });
    }

    const vehicle = findBestVehicle({
      shipmentId,
      requiredCargoType,
      weightKg: weightKg || 0,
      originLat: parseFloat(originLat),
      originLon: parseFloat(originLon),
    });

    if (!vehicle) {
      return res.status(404).json({
        error: 'No available vehicle meets the requirements.',
        hint: 'Check vehicle status, fuel level, and cargo type compatibility.',
      });
    }

    res.json({
      assigned: true,
      vehicle,
      distanceFromOriginKm: vehicle.distanceKm,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/fleet/reroute ───────────────────────────────────────────────────
router.post('/reroute', requireApiKey, (req, res, next) => {
  try {
    const { shipmentId, disruptionType, avoidRegion } = req.body;

    if (!shipmentId) {
      return res.status(400).json({ error: 'Missing required field: shipmentId.' });
    }

    const rerouteResult = suggestReroute({ shipmentId, disruptionType, avoidRegion });
    res.json(rerouteResult);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
