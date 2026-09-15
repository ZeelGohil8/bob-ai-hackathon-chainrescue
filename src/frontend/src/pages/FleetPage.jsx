import { useState, useEffect, useCallback } from 'react';
import { getFleet, getUtilization, getFleetInsights } from '../api/fleet.js';
import FleetTable from '../components/FleetTable.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import UtilizationBar from '../components/UtilizationBar.jsx';

const STATUS_OPTS = ['', 'available', 'on_route', 'maintenance'];
const TYPE_OPTS = ['', 'refrigerated_truck', 'standard_truck', 'van'];

export default function FleetPage() {
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [error, setError] = useState(null);
  const [insightError, setInsightError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setError(null);
    try {
      const [fleetData, utilData] = await Promise.all([
        getFleet({ status: statusFilter, type: typeFilter }),
        getUtilization(),
      ]);
      setVehicles(fleetData.vehicles);
      setStats(utilData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVehicles(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 30_000);
    return () => clearInterval(interval);
  }, [fetchVehicles]);

  async function handleLoadInsights() {
    setLoadingInsight(true);
    setInsightError(null);
    try {
      const result = await getFleetInsights();
      setInsight(result.insight);
      setStats(result.stats);
    } catch (err) {
      setInsightError(`Could not load insights: ${err.message}`);
    } finally {
      setLoadingInsight(false);
    }
  }

  return (
    <div className="page">
      {/* ── KPI summary row ── */}
      {stats && (
        <div className="summary-row">
          <SummaryCard
            label="Total Vehicles"
            value={stats.totalVehicles}
            sub="in fleet"
          />
          <SummaryCard
            label="On Route"
            value={stats.byStatus?.on_route ?? 0}
            sub="actively dispatched"
          />
          <SummaryCard
            label="Available"
            value={stats.byStatus?.available ?? 0}
            sub="ready to dispatch"
          />
          <SummaryCard
            label="Utilization"
            value={`${stats.utilizationRate}%`}
            sub="on-route ratio"
          />
          <SummaryCard
            label="Avg Load"
            value={`${stats.avgLoadPercent}%`}
            sub="of capacity used"
          />
          <SummaryCard
            label="Avg Fuel"
            value={`${stats.avgFuelLevel}%`}
            sub="fleet-wide average"
          />
        </div>
      )}

      {/* ── Utilization detail bar ── */}
      {stats && (
        <div className="section-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>
                Fleet Utilization Rate
              </div>
              <UtilizationBar pct={stats.utilizationRate} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>
                Avg Fuel Level
              </div>
              <UtilizationBar
                pct={stats.avgFuelLevel}
                color={stats.avgFuelLevel < 30 ? 'var(--red)' : stats.avgFuelLevel < 55 ? 'var(--orange)' : 'var(--green)'}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>
                Avg Load
              </div>
              <UtilizationBar pct={stats.avgLoadPercent} />
            </div>
          </div>
        </div>
      )}

      {/* ── AI insights ── */}
      <div className="section-card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <h2>watsonx.ai Fleet Insights</h2>
          <button
            className="btn btn-primary"
            onClick={handleLoadInsights}
            disabled={loadingInsight}
          >
            {loadingInsight ? 'Generating…' : '⚡ Generate Insights'}
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {insightError && <div className="state-error">{insightError}</div>}
          {!insight && !insightError && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Click <strong>Generate Insights</strong> to get AI-powered fleet recommendations from IBM watsonx.ai.
            </p>
          )}
          {insight && (
            <div className="ai-box">
              <div className="ai-label">IBM watsonx.ai · Fleet Optimization Recommendations</div>
              {insight}
            </div>
          )}
        </div>
      </div>

      {/* ── Vehicle roster ── */}
      <div className="section-card">
        <div className="section-header">
          <h2>Vehicle Roster</h2>
          <span className="section-meta">Auto-refreshes every 30 s</span>
        </div>

        <div style={{ padding: '14px 20px 0' }}>
          <div className="refresh-row">
            <button className="btn btn-outline" onClick={fetchVehicles} disabled={loadingVehicles}>
              {loadingVehicles ? 'Loading…' : '↻ Refresh'}
            </button>
            {lastUpdated && (
              <span className="last-updated">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="filter-row">
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_OPTS.map((o) => (
                  <option key={o} value={o}>{o || 'All'}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {TYPE_OPTS.map((o) => (
                  <option key={o} value={o}>{o ? o.replace(/_/g, ' ') : 'All'}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <div className="state-error" style={{ margin: '0 20px 12px' }}>{error}</div>}

        {loadingVehicles && vehicles.length === 0 ? (
          <div className="spinner-wrap">
            <div className="spinner" /> Loading vehicles…
          </div>
        ) : (
          <FleetTable vehicles={vehicles} />
        )}
      </div>
    </div>
  );
}
