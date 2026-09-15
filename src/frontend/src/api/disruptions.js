import client from './client';

/** Fetch all disruption events, optionally filtered. */
export async function getDisruptions({ severity, type } = {}) {
  const params = {};
  if (severity) params.severity = severity;
  if (type) params.type = type;
  const { data } = await client.get('/api/disruptions', { params });
  return data; // { count, events }
}

/** Fetch a single disruption event by ID. */
export async function getDisruption(id) {
  const { data } = await client.get(`/api/disruptions/${id}`);
  return data;
}

/** Ingest a new disruption event. */
export async function createDisruption(payload) {
  const { data } = await client.post('/api/disruptions', payload);
  return data;
}

/** Run watsonx.ai impact analysis on an event. */
export async function analyseDisruption(id) {
  const { data } = await client.post(`/api/disruptions/${id}/analyse`);
  return data;
}

/** Trigger cold-chain temperature breach scan. */
export async function scanTemperature() {
  const { data } = await client.post('/api/disruptions/scan/temperature');
  return data;
}
