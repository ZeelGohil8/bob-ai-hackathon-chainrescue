#!/usr/bin/env node
/**
 * ChainRescue CLI
 *
 * Usage:
 *   node src/cli/index.js simulate <shipmentId> <breachType>
 *   node src/cli/index.js scan-breaches
 *   node src/cli/index.js reroute <shipmentId> <breachType>
 *   node src/cli/index.js list-shipments
 *
 * breachType: temperature | weather | port_congestion
 */

'use strict';

const { simulate, scanBreaches, rerouteShipment, listShipments } = require('../lib/simulator');
const logger = require('../utils/logger');

const [, , command, ...args] = process.argv;

function usage() {
  logger.info('');
  logger.info('ChainRescue CLI — Supply Chain Resilience Tool');
  logger.info('───────────────────────────────────────────────');
  logger.info('Commands:');
  logger.info('  simulate <shipmentId> <breachType>  Simulate a breach and show re-routing options');
  logger.info('  scan-breaches                        Scan all shipments for active breaches');
  logger.info('  reroute <shipmentId> <breachType>   Compute and display a re-route plan');
  logger.info('  list-shipments                       List all tracked shipments and their status');
  logger.info('');
  logger.info('breachType values: temperature | weather | port_congestion');
  logger.info('');
  logger.info('Examples:');
  logger.info('  node src/cli/index.js simulate SHP-001 temperature');
  logger.info('  node src/cli/index.js simulate SHP-002 weather');
  logger.info('  node src/cli/index.js scan-breaches');
  logger.info('  node src/cli/index.js reroute SHP-003 temperature');
  logger.info('  node src/cli/index.js list-shipments');
  logger.info('');
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(0);
  }

  switch (command) {
    case 'simulate': {
      const [shipmentId, breachType] = args;
      if (!shipmentId || !breachType) {
        logger.error('simulate requires <shipmentId> and <breachType>');
        logger.error('  Example: node src/cli/index.js simulate SHP-001 temperature');
        process.exit(1);
      }
      const validTypes = ['temperature', 'weather', 'port_congestion'];
      if (!validTypes.includes(breachType)) {
        logger.error(`Invalid breachType "${breachType}". Must be one of: ${validTypes.join(', ')}`);
        process.exit(1);
      }
      logger.info(`Running simulation — shipment: ${shipmentId}, breach type: ${breachType}`);
      const result = simulate(shipmentId, breachType);
      printSimulationResult(result);
      break;
    }

    case 'scan-breaches': {
      logger.info('Scanning all shipments for active temperature breaches…');
      const breaches = scanBreaches();
      if (breaches.length === 0) {
        logger.success('No active temperature breaches detected.');
      } else {
        logger.warn(`${breaches.length} breach(es) detected:`);
        breaches.forEach((b) => printBreachSummary(b));
      }
      break;
    }

    case 'reroute': {
      const [shipmentId, breachType] = args;
      if (!shipmentId || !breachType) {
        logger.error('reroute requires <shipmentId> and <breachType>');
        logger.error('  Example: node src/cli/index.js reroute SHP-003 temperature');
        process.exit(1);
      }
      logger.info(`Computing re-route for shipment ${shipmentId} (disruption: ${breachType})…`);
      const plan = rerouteShipment(shipmentId, breachType);
      printReroutePlan(plan);
      break;
    }

    case 'list-shipments': {
      const shipments = listShipments();
      logger.info(`Tracked shipments (${shipments.length} total):`);
      logger.info('');
      shipments.forEach((s) => {
        const tempStr =
          s.cargo.temperatureC !== null
            ? ` | Temp: ${s.cargo.temperatureC}°C [${s.cargo.thresholdMin}–${s.cargo.thresholdMax}°C]`
            : '';
        const alertStr = s.alerts.length ? ` ⚠  ${s.alerts.join(', ')}` : '';
        logger.info(`  ${s.id}  ${s.status.padEnd(12)}  ${s.origin} → ${s.destination}${tempStr}${alertStr}`);
      });
      logger.info('');
      break;
    }

    default:
      logger.error(`Unknown command: "${command}"`);
      usage();
      process.exit(1);
  }
}

// ── Pretty printers ────────────────────────────────────────────────────────────

function printSimulationResult(result) {
  const { shipment, event, reroute, bestVehicle } = result;
  logger.info('');
  logger.info('═══════════════════ SIMULATION RESULT ═══════════════════');
  logger.info(`  Shipment  : ${shipment.id} (${shipment.origin} → ${shipment.destination})`);
  logger.info(`  Carrier   : ${shipment.carrier}`);
  logger.info(`  ETA       : ${shipment.eta}`);
  logger.info(`  Event     : [${event.severity.toUpperCase()}] ${event.type} — ${event.description}`);
  logger.info('');
  if (reroute) {
    logger.info('  Re-route Plan:');
    logger.info(`    Extra distance : +${reroute.extraDistanceKm} km`);
    logger.info(`    Extra delay    : ~+${reroute.estimatedExtraDelayHours}h`);
    logger.info(`    Reason         : ${reroute.reason}`);
  }
  if (bestVehicle) {
    logger.info('');
    logger.info('  Recommended Vehicle:');
    logger.info(`    ID       : ${bestVehicle.id} (${bestVehicle.type})`);
    logger.info(`    Location : ${bestVehicle.currentLocation.city}`);
    logger.info(`    Fuel     : ${bestVehicle.fuelLevel}%`);
    logger.info(`    Distance : ${bestVehicle.distanceKm} km away`);
  }
  logger.info('══════════════════════════════════════════════════════════');
  logger.info('');
}

function printBreachSummary(b) {
  logger.warn(`  [${b.severity.toUpperCase()}] ${b.shipmentId} — ${b.description}`);
}

function printReroutePlan(plan) {
  logger.info('');
  logger.info('════════════════════ RE-ROUTE PLAN ══════════════════════');
  logger.info(`  Shipment      : ${plan.shipmentId}`);
  logger.info(`  Extra distance: +${plan.extraDistanceKm} km`);
  logger.info(`  Extra delay   : ~+${plan.estimatedExtraDelayHours}h`);
  logger.info(`  Reason        : ${plan.reason}`);
  logger.info('');
  logger.info('  Suggested waypoints:');
  plan.suggestedRoute.forEach((wp, i) => {
    const note = wp.note ? `  ← ${wp.note}` : '';
    logger.info(`    ${i + 1}. lat ${wp.lat}, lon ${wp.lon}${note}`);
  });
  logger.info('═════════════════════════════════════════════════════════');
  logger.info('');
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
