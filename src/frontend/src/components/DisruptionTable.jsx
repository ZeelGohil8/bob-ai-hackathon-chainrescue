import { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import { analyseDisruption } from '../api/disruptions.js';

/**
 * DisruptionTable — renders active disruption events with inline AI analysis.
 * Props:
 *   events  — array of disruption event objects
 *   onRefresh — callback to re-fetch events after mutation
 */
export default function DisruptionTable({ events, onRefresh }) {
  const [analysing, setAnalysing] = useState({});
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState(null);

  async function handleAnalyse(eventId) {
    setAnalysing((prev) => ({ ...prev, [eventId]: true }));
    setError(null);
    try {
      await analyseDisruption(eventId);
      onRefresh();
    } catch (err) {
      setError(`Analysis failed for ${eventId}: ${err.message}`);
    } finally {
      setAnalysing((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!events || events.length === 0) {
    return <div className="state-empty">No disruption events found.</div>;
  }

  return (
    <>
      {error && <div className="state-error">{error}</div>}
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Region</th>
            <th>Detected</th>
            <th>Affected Shipments</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((evt) => (
            <>
              <tr key={evt.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(evt.id)}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{evt.id}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{evt.type.replace('_', ' ')}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{evt.subtype}</div>
                </td>
                <td>
                  <StatusBadge value={evt.severity} />
                </td>
                <td style={{ maxWidth: 180, wordBreak: 'break-word' }}>{evt.affectedRegion}</td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>
                  {new Date(evt.detectedAt).toLocaleString()}
                </td>
                <td>
                  {evt.affectedShipments && evt.affectedShipments.length > 0
                    ? evt.affectedShipments.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            background: 'var(--gray-lt)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: '1px 5px',
                            marginRight: 4,
                          }}
                        >
                          {s}
                        </span>
                      ))
                    : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                </td>
                <td>
                  <button
                    className="btn btn-outline"
                    disabled={analysing[evt.id]}
                    onClick={(e) => { e.stopPropagation(); handleAnalyse(evt.id); }}
                  >
                    {analysing[evt.id] ? 'Analysing…' : '⚡ AI Analyse'}
                  </button>
                </td>
              </tr>

              {/* Expanded detail row */}
              {expanded[evt.id] && (
                <tr key={`${evt.id}-detail`}>
                  <td colSpan={7} style={{ background: 'var(--gray-lt)', padding: '12px 20px' }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Description: </strong>{evt.description}
                    </div>
                    {evt.recommendedAction && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>Recommended Action: </strong>{evt.recommendedAction}
                      </div>
                    )}
                    {evt.aiAnalysis && (
                      <div className="ai-box" style={{ marginTop: 8 }}>
                        <div className="ai-label">watsonx.ai Impact Analysis</div>
                        {evt.aiAnalysis}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </>
  );
}
