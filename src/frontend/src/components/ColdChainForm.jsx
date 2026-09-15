/**
 * ColdChainForm — IoT Cold Chain Temperature Excursion Audit
 *
 * Sends a POST to /api/evaluate-coldchain and renders the regulatory
 * severity status (Normal / Warning / Critical Violation) with a
 * color-coded badge, probability breakdown, and required action.
 */
import { useState } from 'react';

const API_URL = 'http://localhost:8000/api/evaluate-coldchain';

const INITIAL = {
  peak_sensor_temp_c:   '',
  temp_excursion_hours: '',
  temp_variance:        '',
  excursion_rate:       '',
  recovery_time_hours:  '',
};

/** Severity → badge CSS class */
function severityBadgeClass(sev) {
  if (!sev) return '';
  if (sev === 'Critical Violation') return 'badge badge-critical';
  if (sev === 'Warning')            return 'badge badge-high';
  return 'badge badge-low';
}

/** Severity → action-box CSS modifier */
function actionBoxMod(sev) {
  if (sev === 'Critical Violation') return 'ml-action-box--critical';
  if (sev === 'Warning')            return 'ml-action-box--warn';
  return 'ml-action-box--ok';
}

/** Severity icon */
function severityIcon(sev) {
  if (sev === 'Critical Violation') return '🚨';
  if (sev === 'Warning')            return '⚠️';
  return '✅';
}

/** Render one probability bar row */
function ProbBar({ label, value, colorClass }) {
  return (
    <div className="ml-prob-row">
      <span className="ml-prob-label">{label}</span>
      <div className="ml-bar-wrap">
        <div className={`ml-bar-fill ${colorClass}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="ml-prob-value">{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function ColdChainForm() {
  const [fields, setFields] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // null | { severity, probabilities, regulatory_action, message }
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
        peak_sensor_temp_c:   Number(fields.peak_sensor_temp_c),
        temp_excursion_hours: Number(fields.temp_excursion_hours),
        // optional — only send when filled
        ...(fields.temp_variance       !== '' && { temp_variance:       Number(fields.temp_variance) }),
        ...(fields.excursion_rate      !== '' && { excursion_rate:      Number(fields.excursion_rate) }),
        ...(fields.recovery_time_hours !== '' && { recovery_time_hours: Number(fields.recovery_time_hours) }),
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

  const probs = result?.probabilities ?? {};

  return (
    <div className="ml-form-card">
      <div className="ml-form-header">
        <span className="ml-form-icon">🌡️</span>
        <div>
          <h2 className="ml-form-title">IoT Cold Chain Temperature Excursion Audit</h2>
          <p className="ml-form-subtitle">
            Classify regulatory severity from sensor logs using the Random Forest model
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ml-form-body">
        {/* ── Required fields ── */}
        <div className="ml-fields-section">
          <div className="ml-fields-label">Required sensor readings</div>
          <div className="ml-fields-grid">
            <label className="ml-field">
              <span>Peak Sensor Temp (°C)</span>
              <input
                type="number" name="peak_sensor_temp_c" required
                min="-30" max="60" step="0.1"
                placeholder="e.g. 11.2"
                value={fields.peak_sensor_temp_c}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Excursion Duration (hours)</span>
              <input
                type="number" name="temp_excursion_hours" required
                min="0" max="24" step="0.1"
                placeholder="e.g. 6"
                value={fields.temp_excursion_hours}
                onChange={handleChange}
              />
            </label>
          </div>
        </div>

        {/* ── Optional fields ── */}
        <details className="ml-optional-section">
          <summary className="ml-optional-toggle">
            Optional derived statistics <span className="ml-optional-hint">(improve accuracy)</span>
          </summary>
          <div className="ml-fields-grid ml-fields-grid--optional">
            <label className="ml-field">
              <span>Temp Variance (°C std-dev)</span>
              <input
                type="number" name="temp_variance"
                min="0" step="0.01"
                placeholder="1.0"
                value={fields.temp_variance}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Excursion Rate (0–1)</span>
              <input
                type="number" name="excursion_rate"
                min="0" max="1" step="0.01"
                placeholder="auto-derived"
                value={fields.excursion_rate}
                onChange={handleChange}
              />
            </label>

            <label className="ml-field">
              <span>Recovery Time (hours)</span>
              <input
                type="number" name="recovery_time_hours"
                min="0" max="72" step="0.5"
                placeholder="0"
                value={fields.recovery_time_hours}
                onChange={handleChange}
              />
            </label>
          </div>
        </details>

        <div className="ml-form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner" />Evaluating…</> : '🔬 Evaluate Cold Chain'}
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
            <span className="ml-result-label">Regulatory Status</span>
            <span className={severityBadgeClass(result.severity)}>
              {severityIcon(result.severity)} {result.severity}
            </span>
          </div>

          {/* Per-class probability bars */}
          {Object.keys(probs).length > 0 && (
            <div className="ml-probs-section">
              <div className="ml-fields-label" style={{ marginBottom: '8px' }}>Class probabilities</div>
              <ProbBar label="Normal"             value={probs['Normal'] ?? 0}             colorClass="ml-bar-ok"      />
              <ProbBar label="Warning"            value={probs['Warning'] ?? 0}            colorClass="ml-bar-warn"    />
              <ProbBar label="Critical Violation" value={probs['Critical Violation'] ?? 0} colorClass="ml-bar-danger"  />
            </div>
          )}

          {/* Regulatory action */}
          <div className={`ml-action-box ${actionBoxMod(result.severity)}`}>
            <div className="ml-action-label">Required Regulatory Action</div>
            <p>{result.regulatory_action}</p>
          </div>

          <p className="ml-result-message">{result.message}</p>
        </div>
      )}
    </div>
  );
}
