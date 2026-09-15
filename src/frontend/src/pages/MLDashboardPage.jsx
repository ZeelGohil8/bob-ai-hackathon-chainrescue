/**
 * MLDashboardPage — Problem L2 Dashboard
 *
 * Composes the two ML prediction forms side-by-side on a single page.
 */
import DisruptionForm from '../components/DisruptionForm.jsx';
import ColdChainForm  from '../components/ColdChainForm.jsx';

export default function MLDashboardPage() {
  return (
    <div className="page">
      {/* Page intro */}
      <div className="ml-page-header">
        <div>
          <h1 className="ml-page-title">🤖 ML Risk Dashboard</h1>
          <p className="ml-page-subtitle">
            Problem L2 · Real-time disruption risk scoring and cold-chain
            regulatory severity classification powered by XGBoost &amp; Random Forest.
          </p>
        </div>
        <div className="ml-server-badge">
          <span className="ml-server-dot" />
          ML API&nbsp;
          <span className="ml-server-url">localhost:8000</span>
        </div>
      </div>

      {/* Two-column form grid */}
      <div className="ml-dashboard-grid">
        <DisruptionForm />
        <ColdChainForm />
      </div>

      {/* How it works footer */}
      <div className="ml-how-it-works section-card">
        <div className="section-header">
          <h2>How it works</h2>
        </div>
        <div className="ml-how-grid">
          <div className="ml-how-item">
            <div className="ml-how-icon">🛣️</div>
            <div className="ml-how-title">Disruption Reroute Check</div>
            <p className="ml-how-desc">
              Enter route delay, weather severity, and shipment value.  The
              XGBoost model scores the probability that a disruption will
              require intervention and flags whether automated re-routing is
              advised.
            </p>
            <div className="ml-how-badges">
              <span className="badge badge-low">Low Risk</span>
              <span className="badge badge-critical">High Risk</span>
            </div>
          </div>

          <div className="ml-how-item">
            <div className="ml-how-icon">🌡️</div>
            <div className="ml-how-title">Cold Chain Excursion Audit</div>
            <p className="ml-how-desc">
              Provide peak sensor temperature and excursion duration from IoT
              logs.  The Random Forest classifier returns a three-tier
              regulatory severity verdict and the required compliance action.
            </p>
            <div className="ml-how-badges">
              <span className="badge badge-low">Normal</span>
              <span className="badge badge-high">Warning</span>
              <span className="badge badge-critical">Critical Violation</span>
            </div>
          </div>

          <div className="ml-how-item">
            <div className="ml-how-icon">⚡</div>
            <div className="ml-how-title">Real-time Inference</div>
            <p className="ml-how-desc">
              Both models are loaded once at server startup.  Each form
              submission sends a single JSON POST to the FastAPI server on
              port 8000 and renders the response in under 100 ms.
            </p>
            <div className="ml-how-badges">
              <span className="badge badge-on_route">FastAPI · Uvicorn</span>
              <span className="badge badge-in_transit">XGBoost · scikit-learn</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
