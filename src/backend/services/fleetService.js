/**
 * fleetService — business logic for fleet route optimization,
 * vehicle assignment, and utilization analytics.
 *
 * Uses a greedy nearest-available heuristic for demo.
 * In production this could integrate Google OR-Tools or a routing API.
 */

const { generateText } = require('./watsonxService');
const { fleet, shipments } = require('../data/mockData');
const logger = require('../utils/logger');

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Fleet helpers ─────────────────────────────────────────────────────────────

function listVehicles({ status, type } = {}) {
  let vehicles = fleet;
  if (status) vehicles = vehicles.filter((v) => v.status === status);
  if (type) vehicles = vehicles.filter((v) => v.type === type);
  return vehicles;
}

function getVehicleById(id) {
  return fleet.find((v) => v.id === id) || null;
}

/**
 * Compute overall fleet utilization stats.
 */
function getUtilizationStats() {
  const total = fleet.length;
  const byStatus = fleet.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  const loaded = fleet.filter((v) => v.loadKg > 0);
  const avgLoadPct =
    loaded.length === 0
      ? 0
      : Math.round(loaded.reduce((s, v) => s + v.loadKg / v.capacityKg, 0) / loaded.length * 100);

  const avgFuel = Math.round(fleet.reduce((s, v) => s + v.fuelLevel, 0) / total);

  return {
    totalVehicles: total,
    byStatus,
    avgLoadPercent: avgLoadPct,
    avgFuelLevel: avgFuel,
    utilizationRate: Math.round(((byStatus.on_route || 0) / total) * 100),
  };
}

/**
 * Find the best available vehicle to re-route a disrupted shipment.
 *
 * Strategy:
 *  1. Filter vehicles that are `available` and match the required cargo type.
 *  2. Among those, pick the one closest to the shipment origin.
 *  3. Verify it has sufficient remaining capacity.
 */
function findBestVehicle({ shipmentId, requiredCargoType, weightKg, originLat, originLon }) {
  const candidates = fleet.filter(
    (v) =>
      v.status === 'available' &&
      v.fuelLevel >= 20 &&
      v.capacityKg - v.loadKg >= (weightKg || 0) &&
      (requiredCargoType === 'cold_chain' || requiredCargoType === 'perishables'
        ? v.type === 'refrigerated_truck'
        : true)
  );

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((v) => ({
      ...v,
      distanceKm: haversineKm(originLat, originLon, v.currentLocation.lat, v.currentLocation.lon),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return ranked[0];
}

/**
 * Suggest an optimized re-route for a shipment affected by a disruption.
 * Returns waypoints and estimated delay delta.
 */
function suggestReroute({ shipmentId, disruptionType, avoidRegion }) {
  const shipment = shipments.find((s) => s.id === shipmentId);
  if (!shipment) throw Object.assign(new Error(`Shipment ${shipmentId} not found`), { status: 404 });

  // Simple stub: propose an alternate waypoint bypassing the disrupted region
  const alternateWaypoints = shipment.route.map((wp, i) => {
    if (i === 1) {
      // Shift the middle waypoint slightly to simulate a detour
      return { lat: wp.lat - 2.5, lon: wp.lon + 3.0, note: `Detour (bypassing ${avoidRegion || 'disrupted zone'})` };
    }
    return wp;
  });

  const originalDistKm = shipment.route.reduce((total, wp, i) => {
    if (i === 0) return total;
    const prev = shipment.route[i - 1];
    return total + haversineKm(prev.lat, prev.lon, wp.lat, wp.lon);
  }, 0);

  const rerouteDistKm = alternateWaypoints.reduce((total, wp, i) => {
    if (i === 0) return total;
    const prev = alternateWaypoints[i - 1];
    return total + haversineKm(prev.lat, prev.lon, wp.lat, wp.lon);
  }, 0);

  const extraKm = Math.round(rerouteDistKm - originalDistKm);
  const extraHours = Math.round(extraKm / 40); // assume avg 40 km/h

  logger.info(`Reroute suggested for ${shipmentId}: +${extraKm} km, ~+${extraHours}h delay`);

  return {
    shipmentId,
    originalRoute: shipment.route,
    suggestedRoute: alternateWaypoints,
    extraDistanceKm: extraKm,
    estimatedExtraDelayHours: extraHours,
    reason: `Avoiding ${avoidRegion || disruptionType || 'disrupted zone'}`,
  };
}

/**
 * Use watsonx.ai to generate a natural-language optimization recommendation
 * for the full fleet given current utilization and active disruptions.
 */
async function generateFleetInsights(activeDisruptionCount) {
  const stats = getUtilizationStats();
  const availableVehicles = fleet.filter((v) => v.status === 'available');
  const lowFuel = fleet.filter((v) => v.fuelLevel < 25);

  const prompt = `
You are ChainRescue's fleet optimization AI.

Current fleet status:
- Total vehicles: ${stats.totalVehicles}
- On route: ${stats.byStatus.on_route || 0}
- Available: ${stats.byStatus.available || 0}
- In maintenance: ${stats.byStatus.maintenance || 0}
- Average load: ${stats.avgLoadPercent}%
- Average fuel level: ${stats.avgFuelLevel}%
- Utilization rate: ${stats.utilizationRate}%
- Active supply-chain disruptions: ${activeDisruptionCount}
- Vehicles with low fuel (<25%): ${lowFuel.map((v) => v.id).join(', ') || 'none'}

Available vehicles:
${availableVehicles.map((v) => `- ${v.id} (${v.type}) at ${v.currentLocation.city}, fuel ${v.fuelLevel}%, capacity ${v.capacityKg - v.loadKg} kg free`).join('\n')}

Provide:
1. Top 3 fleet optimization recommendations.
2. Vehicles that should be dispatched to cover disrupted shipments.
3. Maintenance or refuelling priorities.

Be concise and action-oriented.
`.trim();

  const insight = await generateText(prompt, { maxNewTokens: 500 });
  return { stats, insight };
}

module.exports = {
  listVehicles,
  getVehicleById,
  getUtilizationStats,
  findBestVehicle,
  suggestReroute,
  generateFleetInsights,
};
