import client from './client';

/** Fetch all vehicles, optionally filtered. */
export async function getFleet({ status, type } = {}) {
  const params = {};
  if (status) params.status = status;
  if (type) params.type = type;
  const { data } = await client.get('/api/fleet', { params });
  return data; // { count, vehicles }
}

/** Fetch a single vehicle by ID. */
export async function getVehicle(id) {
  const { data } = await client.get(`/api/fleet/${id}`);
  return data;
}

/** Fetch fleet utilization stats. */
export async function getUtilization() {
  const { data } = await client.get('/api/fleet/utilization');
  return data;
}

/** Fetch AI-generated fleet insights. */
export async function getFleetInsights() {
  const { data } = await client.get('/api/fleet/insights');
  return data; // { stats, insight }
}

/** Find best available vehicle for a shipment. */
export async function assignVehicle(payload) {
  const { data } = await client.post('/api/fleet/assign', payload);
  return data;
}

/** Suggest an optimized reroute for a shipment. */
export async function rerouteShipment(payload) {
  const { data } = await client.post('/api/fleet/reroute', payload);
  return data;
}
