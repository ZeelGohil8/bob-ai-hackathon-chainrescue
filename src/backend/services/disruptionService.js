/**
 * disruptionService — business logic for supply-chain disruption detection,
 * alert management, and AI-powered impact analysis.
 */

const { v4: uuidv4 } = require('uuid');
const { generateText } = require('./watsonxService');
const { disruptionEvents, shipments } = require('../data/mockData');
const logger = require('../utils/logger');

// In-memory store for demo (replace with DB in production)
let activeEvents = [...disruptionEvents];

/**
 * Return all active disruption events, optionally filtered by severity or type.
 */
function listEvents({ severity, type } = {}) {
  let events = activeEvents;
  if (severity) events = events.filter((e) => e.severity === severity);
  if (type) events = events.filter((e) => e.type === type);
  return events;
}

/**
 * Return a single event by ID.
 */
function getEventById(id) {
  return activeEvents.find((e) => e.id === id) || null;
}

/**
 * Ingest a new disruption event (from an external webhook or IoT stream).
 */
function createEvent({ type, subtype, severity, affectedRegion, description, affectedShipments = [] }) {
  const event = {
    id: `EVT-${uuidv4().slice(0, 8).toUpperCase()}`,
    type,
    subtype: subtype || type,
    severity,
    affectedRegion,
    affectedShipments,
    detectedAt: new Date().toISOString(),
    description,
    recommendedAction: null,
  };
  activeEvents.push(event);
  logger.info(`New disruption event created: ${event.id} [${event.severity}] ${event.type}`);
  return event;
}

/**
 * Use watsonx.ai to analyse the impact of an event and suggest actions.
 * Attaches the AI recommendation back onto the stored event.
 */
async function analyseImpact(eventId) {
  const event = getEventById(eventId);
  if (!event) throw Object.assign(new Error(`Event ${eventId} not found`), { status: 404 });

  // Fetch any shipments affected
  const affectedShipmentData = shipments.filter((s) => event.affectedShipments.includes(s.id));

  const prompt = `
You are a supply chain risk analyst AI assistant called ChainRescue.

A disruption event has been detected:
- Type: ${event.type} (${event.subtype})
- Severity: ${event.severity}
- Region: ${event.affectedRegion}
- Description: ${event.description}

Affected shipments:
${affectedShipmentData.length ? affectedShipmentData.map((s) =>
  `- ${s.id}: ${s.origin} → ${s.destination} (carrier: ${s.carrier}, cargo: ${s.cargo.type})`
).join('\n') : '- None currently flagged.'}

Provide:
1. A concise impact assessment (2-3 sentences).
2. Immediate recommended actions (numbered list, max 4 items).
3. Estimated delay risk (Low / Medium / High / Critical).

Respond in plain text, no markdown headers.
`.trim();

  const aiText = await generateText(prompt, { maxNewTokens: 400 });

  // Persist recommendation
  event.aiAnalysis = aiText;
  event.analysedAt = new Date().toISOString();

  logger.info(`AI impact analysis complete for event ${eventId}`);
  return event;
}

/**
 * Scan all in-transit cold-chain shipments for temperature breaches
 * and auto-create disruption events.
 */
function scanTemperatureBreaches() {
  const newEvents = [];
  for (const shipment of shipments) {
    const { cargo } = shipment;
    if (
      cargo.type === 'cold_chain' || cargo.type === 'perishables'
    ) {
      if (
        cargo.temperatureC !== null &&
        (cargo.temperatureC < cargo.thresholdMin || cargo.temperatureC > cargo.thresholdMax)
      ) {
        // Avoid duplicating an existing unresolved breach event
        const existing = activeEvents.find(
          (e) => e.type === 'temperature_breach' && e.affectedShipments.includes(shipment.id)
        );
        if (!existing) {
          const event = createEvent({
            type: 'temperature_breach',
            subtype: 'cold_chain',
            severity: cargo.temperatureC > cargo.thresholdMax + 3 ? 'critical' : 'high',
            affectedRegion: `En route ${shipment.origin} → ${shipment.destination}`,
            description: `Shipment ${shipment.id} temperature ${cargo.temperatureC}°C is outside safe range [${cargo.thresholdMin}°C–${cargo.thresholdMax}°C].`,
            affectedShipments: [shipment.id],
          });
          newEvents.push(event);
        }
      }
    }
  }
  return newEvents;
}

module.exports = { listEvents, getEventById, createEvent, analyseImpact, scanTemperatureBreaches };
