/**
 * DisruptionForm — Disruption Reroute Check
 *
 * Sends a POST to /api/predict-disruption and renders the risk level,
 * probability, and reroute recommendation with a color-coded badge.
 */
import { useState } from 'react';

const API_URL = 'http://localhost:8000/api/predict-disruption';

const INITIAL = {
  route_delay_hours: '',
  weather_severity: '',
  shipment_value_usd: '',
  temp_excursion_hours: '',
  peak_sensor_temp_c: '',
  idle_fleet_hours: '',
};

/** Map risk level → badge CSS class name */
function riskBadgeClass(risk) {
  if (!risk) return '';
  return risk === 'High' ? 'badge badge-critical' : 'badge badge-low';
}

/** Map probability 0–1 → progress-bar colour class */
function probBarClass(p) {
  if (p >= 0.75) return 'ml-bar-fill ml-bar-danger';
  if (p >= 0.50) return 'ml-bar-fill ml-bar-warn';
  return 'ml-bar-fill ml-bar-ok';
}

export default function DisruptionForm() {
  const [fields, setFields] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // null | { risk, probability_high, reroute_suggested, message }
  const [error, setError]   = useState(null);

  function handleChange(e) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const body = {
        route_delay_hours:    Number(fields.route_delay_hours),
        weather_severity:     Number(fields.weather_severity),
        shipment_value_usd:   Number(fields.shipment_value_usd),
        // optional — only send if filled in
        ...(fields.temp_excursion_hours !== '' && { temp_excursion_hours: Number(fields.temp_excursion_hours) }),
        ...(fields.peak_sensor_temp_c   !== '' && { peak_sensor_temp_c:   Number(fields.peak_sensor_temp_c) }),
        ...(fields.idle_fleet_hours     !== '' && { idle_fleet_hours:     Number(fields.idle_fleet_hours) }),
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `API error ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err.message || 'Unknown error — is the ML server running?');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFields(INITIAL);
    setResult(null);
    setError(null);
  }

  const probPct = result ? Math.round(result.probability_high * 100) : 0;

  return (
    <div className="ml-form-card">
      <div className="ml-form-header">
        <span className="ml-form-icon">🛣️</span>
        <div>
          <h2 className="ml-form-title">Disruption Reroute Check</h2>
          <p className="ml-form-subtitle">
            Predict route disruption risk using the XGBoost classifier
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ml-form-body">
        {/* ── Required fields ── */}
        <div className="ml-fields-section">
          <div className="ml-fields-label">Required signals</div>
          <div className="ml-fields-grid">
            <label className="ml-field">
              <span>Route Delay (hours)</span>
              <input
                type="number" name="route_delay_hours" required
                min="0" max="720" step="0.1"
                placeholder="e.g. 22"
                value={fields.route_delay_hours}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Weather Severity (1–5)</span>
              <input
                type="number" name="weather_severity" required
                min="1" max="5" step="1"
                placeholder="1 = calm, 5 = extreme"
                value={fields.weather_severity}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Shipment Value (USD)</span>
              <input
                type="number" name="shipment_value_usd" required
                min="0" step="100"
                placeholder="e.g. 85000"
                value={fields.shipment_value_usd}
                onChange={handleChange}
              />
            </label>
          </div>
        </div>

        {/* ── Optional fields ── */}
        <details className="ml-optional-section">
          <summary className="ml-optional-toggle">
            Optional sensor signals <span className="ml-optional-hint">(improve accuracy)</span>
          </summary>
          <div className="ml-fields-grid ml-fields-grid--optional">
            <label className="ml-field">
              <span>Temp Excursion (hours)</span>
              <input
                type="number" name="temp_excursion_hours"
                min="0" max="24" step="0.1"
                placeholder="0"
                value={fields.temp_excursion_hours}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Peak Sensor Temp (°C)</span>
              <input
                type="number" name="peak_sensor_temp_c"
                min="-30" max="60" step="0.1"
                placeholder="4.0"
                value={fields.peak_sensor_temp_c}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Idle Fleet (hours)</span>
              <input
                type="number" name="idle_fleet_hours"
                min="0" max="168" step="0.5"
                placeholder="0"
                value={fields.idle_fleet_hours}
                onChange={handleChange}
              />
            </label>
          </div>
        </details>

        <div className="ml-form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner" />Analysing…</> : '⚡ Predict Disruption Risk'}
          </button>
          <button type="button" className="btn btn-outline" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className="state-error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="ml-result">
          <div className="ml-result-header">
            <span className="ml-result-label">Prediction Result</span>
            <span className={riskBadgeClass(result.risk)}>
              {result.risk === 'High' ? '🔴' : '🟢'} {result.risk} Risk
            </span>
          </div>

          {/* Probability bar */}
          <div className="ml-prob-row">
            <span className="ml-prob-label">Disruption probability</span>
            <div className="ml-bar-wrap">
              <div
                className={probBarClass(result.probability_high)}
                style={{ width: `${probPct}%` }}
              />
            </div>
            <span className="ml-prob-value">{probPct}%</span>
          </div>

          {/* Reroute recommendation */}
          <div className={`ml-reroute-box ${result.reroute_suggested ? 'ml-reroute-box--active' : 'ml-reroute-box--ok'}`}>
            {result.reroute_suggested
              ? '🔀 Automated re-routing is recommended for this shipment.'
              : '✅ No re-routing required. Shipment is on track.'}
          </div>

          <p className="ml-result-message">{result.message}</p>
        </div>
      )}
    </div>
  );
}
