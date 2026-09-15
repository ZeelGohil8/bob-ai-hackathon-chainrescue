import { useState, useEffect, useCallback } from 'react';
import { getDisruptions, scanTemperature } from '../api/disruptions.js';
import DisruptionTable from '../components/DisruptionTable.jsx';
import SummaryCard from '../components/SummaryCard.jsx';

const SEVERITY_OPTS = ['', 'critical', 'high', 'medium', 'low'];
const TYPE_OPTS = ['', 'weather', 'temperature_breach', 'port_congestion', 'labor_strike'];

export default function DisruptionsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDisruptions({ severity, type });
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [severity, type]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleScan() {
    setScanning(true);
    setError(null);
    try {
      await scanTemperature();
      await fetchData();
    } catch (err) {
      setError(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  }

  // Compute summary counts
  const events = data?.events || [];
  const countBySeverity = (sev) => events.filter((e) => e.severity === sev).length;

  return (
    <div className="page">
      <div className="summary-row">
        <SummaryCard label="Total Alerts" value={data?.count ?? '—'} sub="active disruptions" />
        <SummaryCard
          label="Critical"
          value={countBySeverity('critical')}
          sub="immediate action needed"
        />
        <SummaryCard label="High" value={countBySeverity('high')} sub="urgent" />
        <SummaryCard label="Medium" value={countBySeverity('medium')} sub="monitor closely" />
        <SummaryCard label="Low" value={countBySeverity('low')} sub="informational" />
      </div>

      <div className="section-card">
        <div className="section-header">
          <h2>Active Disruption Events</h2>
          <span className="section-meta">
            Auto-refreshes every 30 s — click a row to expand details
          </span>
        </div>

        <div style={{ padding: '14px 20px 0' }}>
          <div className="refresh-row">
            <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleScan}
              disabled={scanning}
              title="Scan all in-transit cold-chain shipments for temperature breaches"
            >
              {scanning ? 'Scanning…' : '🌡 Scan Temperature Breaches'}
            </button>
            {lastUpdated && (
              <span className="last-updated">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="filter-row">
            <label>
              Severity
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITY_OPTS.map((o) => (
                  <option key={o} value={o}>{o || 'All'}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPE_OPTS.map((o) => (
                  <option key={o} value={o}>{o || 'All'}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <div className="state-error" style={{ margin: '0 20px 12px' }}>{error}</div>}

        {loading && !data ? (
          <div className="spinner-wrap">
            <div className="spinner" /> Loading disruption events…
          </div>
        ) : (
          <DisruptionTable events={events} onRefresh={fetchData} />
        )}
      </div>
    </div>
  );
}
