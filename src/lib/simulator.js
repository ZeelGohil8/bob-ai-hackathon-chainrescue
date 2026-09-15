'use strict';
/**
 * simulator.js — Cold-chain temperature breach detection and re-routing logic.
 *
 * This module is intentionally standalone (no Express, no external HTTP calls)
 * so it can be exercised directly from the CLI or unit tests.
 */

// ── Embedded shipment / fleet data ───────────────────────────────────────────
// Mirrors src/backend/data/mockData.js so the CLI has no server dependency.

const SHIPMENTS = [
  {
    id: 'SHP-001',
    origin: 'Mumbai, IN',
    destination: 'Dubai, AE',
    status: 'in_transit',
    carrier: 'BlueStar Logistics',
    eta: '2025-08-10T14:00:00Z',
    cargo: { type: 'cold_chain', temperatureC: 3.2, thresholdMin: 2, thresholdMax: 6 },
    route: [
      { lat: 19.076, lon: 72.8777 },
      { lat: 20.5, lon: 65.0 },
      { lat: 25.2048, lon: 55.2708 },
    ],
    alerts: [],
  },
  {
    id: 'SHP-002',
    origin: 'Shanghai, CN',
    destination: 'Los Angeles, US',
    status: 'delayed',
    carrier: 'Pacific Freight Co.',
    eta: '2025-08-15T08:30:00Z',
    cargo: { type: 'electronics', temperatureC: null, thresholdMin: null, thresholdMax: null },
    route: [
      { lat: 31.2304, lon: 121.4737 },
      { lat: 35.0, lon: 170.0 },
      { lat: 33.9425, lon: -118.408 },
    ],
    alerts: ['typhoon_warning'],
  },
  {
    id: 'SHP-003',
    origin: 'Rotterdam, NL',
    destination: 'New York, US',
    status: 'in_transit',
    carrier: 'Euro Atlantic Lines',
    eta: '2025-08-12T20:00:00Z',
    cargo: { type: 'perishables', temperatureC: 7.8, thresholdMin: 0, thresholdMax: 5 },
    route: [
      { lat: 51.9225, lon: 4.47917 },
      { lat: 50.0, lon: -20.0 },
      { lat: 40.6413, lon: -73.7781 },
    ],
    alerts: ['temperature_breach'],
  },
];

const FLEET = [
  {
    id: 'VHC-A1',
    type: 'refrigerated_truck',
    driver: 'Raj Patel',
    status: 'available',
    currentLocation: { lat: 19.076, lon: 72.8777, city: 'Mumbai' },
    capacityKg: 5000,
    loadKg: 0,
    fuelLevel: 92,
  },
  {
    id: 'VHC-B2',
    type: 'standard_truck',
    driver: 'Priya Sharma',
    status: 'on_route',
    currentLocation: { lat: 28.6139, lon: 77.209, city: 'Delhi' },
    capacityKg: 8000,
    loadKg: 6200,
    fuelLevel: 64,
  },
  {
    id: 'VHC-C3',
    type: 'refrigerated_truck',
    driver: 'Amira Hassan',
    status: 'available',
    currentLocation: { lat: 25.2048, lon: 55.2708, city: 'Dubai' },
    capacityKg: 4000,
    loadKg: 0,
    fuelLevel: 78,
  },
  {
    id: 'VHC-D4',
    type: 'van',
    driver: 'Carlos Mendes',
    status: 'maintenance',
    currentLocation: { lat: 40.7128, lon: -74.006, city: 'New York' },
    capacityKg: 1500,
    loadKg: 0,
    fuelLevel: 45,
  },
];

// ── Temperature thresholds ────────────────────────────────────────────────────

/**
 * Maximum safe °C for cold-chain cargo.
 * A breach is flagged when current temperature exceeds this value.
 */
const TEMPERATURE_THRESHOLD_MAX_C = 2; // °C above thresholdMax triggers alert

// ── Haversine distance helper ─────────────────────────────────────────────────

/**
 * Returns the great-circle distance in km between two lat/lon pairs.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Return a copy of all shipments.
 * @returns {Array}
 */
function listShipments() {
  return SHIPMENTS;
}

/**
 * Find a shipment by ID. Returns null if not found.
 * @param {string} id
 * @returns {object|null}
 */
function getShipment(id) {
  return SHIPMENTS.find((s) => s.id === id) || null;
}

/**
 * Detect whether a shipment's cargo has a temperature breach.
 *
 * A breach exists when:
 *   cargo.type is 'cold_chain' or 'perishables'  AND
 *   cargo.temperatureC is above (thresholdMax + TEMPERATURE_THRESHOLD_MAX_C)
 *   OR below thresholdMin.
 *
 * @param {object} shipment
 * @returns {{ breached: boolean, severity: string|null, description: string|null }}
 */
function detectTemperatureBreach(shipment) {
  const { cargo } = shipment;
  const isColdChain = cargo.type === 'cold_chain' || cargo.type === 'perishables';

  if (!isColdChain || cargo.temperatureC === null) {
    return { breached: false, severity: null, description: null };
  }

  const tooHigh = cargo.temperatureC > cargo.thresholdMax;
  const tooLow = cargo.temperatureC < cargo.thresholdMin;

  if (!tooHigh && !tooLow) {
    return { breached: false, severity: null, description: null };
  }

  // Classify severity: critical if > thresholdMax + TEMPERATURE_THRESHOLD_MAX_C
  const severity =
    tooHigh && cargo.temperatureC > cargo.thresholdMax + TEMPERATURE_THRESHOLD_MAX_C
      ? 'critical'
      : 'high';

  const direction = tooHigh ? 'above' : 'below';
  const limit = tooHigh ? cargo.thresholdMax : cargo.thresholdMin;

  return {
    breached: true,
    severity,
    description:
      `Cargo temperature ${cargo.temperatureC}°C is ${direction} the safe threshold ` +
      `(${cargo.thresholdMin}°C–${cargo.thresholdMax}°C). Limit: ${limit}°C.`,
  };
}

/**
 * Scan all shipments and return those with active temperature breaches.
 * @returns {Array<{ shipmentId, severity, description }>}
 */
function scanBreaches() {
  return SHIPMENTS.reduce((acc, shipment) => {
    const result = detectTemperatureBreach(shipment);
    if (result.breached) {
      acc.push({
        shipmentId: shipment.id,
        severity: result.severity,
        description: result.description,
      });
    }
    return acc;
  }, []);
}

/**
 * Suggest a re-route that bypasses the disrupted zone.
 * The middle waypoint is shifted to simulate a detour corridor.
 *
 * @param {string} shipmentId
 * @param {string} breachType  'temperature' | 'weather' | 'port_congestion'
 * @returns {object}
 */
function rerouteShipment(shipmentId, breachType) {
  const shipment = getShipment(shipmentId);
  if (!shipment) {
    throw Object.assign(new Error(`Shipment ${shipmentId} not found`), { code: 'NOT_FOUND' });
  }

  const avoidLabel =
    breachType === 'temperature'
      ? 'refrigeration-failure zone'
      : breachType === 'weather'
      ? 'severe weather corridor'
      : 'congested port';

  // Detour: shift the middle waypoint to avoid the disrupted corridor.
  // Latitudinal shift avoids common northern storm tracks; longitudinal shift
  // moves cargo around the congested waypoint.
  const suggestedRoute = shipment.route.map((wp, i) => {
    if (i === 1) {
      return {
        lat: Math.round((wp.lat - 2.5) * 100) / 100,
        lon: Math.round((wp.lon + 3.0) * 100) / 100,
        note: `Detour — bypassing ${avoidLabel}`,
      };
    }
    return { ...wp };
  });

  // Compute distance delta
  function routeDistKm(route) {
    return route.reduce((total, wp, i) => {
      if (i === 0) return total;
      const prev = route[i - 1];
      return total + haversineKm(prev.lat, prev.lon, wp.lat, wp.lon);
    }, 0);
  }

  const originalDistKm = routeDistKm(shipment.route);
  const rerouteDistKm = routeDistKm(suggestedRoute);
  const extraKm = Math.max(0, rerouteDistKm - originalDistKm);
  const extraHours = Math.round(extraKm / 40); // assume avg 40 km/h inter-modal speed

  return {
    shipmentId,
    originalRoute: shipment.route,
    suggestedRoute,
    extraDistanceKm: extraKm,
    estimatedExtraDelayHours: extraHours,
    reason: `Avoiding ${avoidLabel}`,
  };
}

/**
 * Find the closest available vehicle capable of handling a given shipment.
 * Refrigerated trucks are required for cold-chain and perishable cargo.
 *
 * @param {object} shipment
 * @returns {object|null}
 */
function findBestVehicle(shipment) {
  const needsRefrigeration =
    shipment.cargo.type === 'cold_chain' || shipment.cargo.type === 'perishables';

  const origin = shipment.route[0];
  const candidates = FLEET.filter(
    (v) =>
      v.status === 'available' &&
      v.fuelLevel >= 20 &&
      (!needsRefrigeration || v.type === 'refrigerated_truck')
  );

  if (candidates.length === 0) return null;

  return candidates
    .map((v) => ({
      ...v,
      distanceKm: haversineKm(origin.lat, origin.lon, v.currentLocation.lat, v.currentLocation.lon),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

/**
 * Run a full disruption simulation for a given shipment and breach type.
 *
 * Returns a combined result object containing:
 *  - shipment details
 *  - a synthesised disruption event
 *  - a re-route plan
 *  - the best available replacement vehicle (if any)
 *
 * @param {string} shipmentId
 * @param {'temperature'|'weather'|'port_congestion'} breachType
 * @returns {object}
 */
function simulate(shipmentId, breachType) {
  const shipment = getShipment(shipmentId);
  if (!shipment) {
    throw Object.assign(new Error(`Shipment "${shipmentId}" not found`), { code: 'NOT_FOUND' });
  }

  // Build disruption event
  let severity, description;
  if (breachType === 'temperature') {
    const detection = detectTemperatureBreach(shipment);
    severity = detection.breached ? detection.severity : 'medium';
    description = detection.breached
      ? detection.description
      : `Simulated temperature breach for ${shipmentId}: cargo exceeds safe range.`;
  } else if (breachType === 'weather') {
    severity = 'critical';
    description = `Severe weather event detected along the route of ${shipmentId}. Typhoon / storm advisory issued.`;
  } else {
    severity = 'medium';
    description = `Port congestion affecting the destination port for ${shipmentId}. Expected 48–72 hour delay.`;
  }

  const event = {
    id: `SIM-${shipmentId}-${breachType.toUpperCase()}`,
    type: breachType === 'temperature' ? 'temperature_breach' : breachType,
    severity,
    affectedShipments: [shipmentId],
    detectedAt: new Date().toISOString(),
    description,
  };

  // Compute re-route and best vehicle
  const reroute = rerouteShipment(shipmentId, breachType);
  const bestVehicle = findBestVehicle(shipment);

  return { shipment, event, reroute, bestVehicle };
}

module.exports = {
  listShipments,
  getShipment,
  detectTemperatureBreach,
  scanBreaches,
  rerouteShipment,
  findBestVehicle,
  simulate,
  TEMPERATURE_THRESHOLD_MAX_C,
};
