import { useState } from 'react';
import DisruptionsPage  from './pages/DisruptionsPage.jsx';
import FleetPage        from './pages/FleetPage.jsx';
import MLDashboardPage  from './pages/MLDashboardPage.jsx';

const TABS = [
  { id: 'disruptions', label: '⚠ Disruption Alerts' },
  { id: 'fleet',       label: '🚛 Fleet & Routes'    },
  { id: 'ml',          label: '🤖 ML Risk Dashboard' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('disruptions');

  return (
    <>
      <header className="app-header">
        <div>
          <h1>🔗 ChainRescue</h1>
        </div>
        <div className="subtitle">Supply Chain Disruption Assistant · Fleet Optimizer</div>
        <nav className="nav-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {activeTab === 'disruptions' && <DisruptionsPage />}
        {activeTab === 'fleet'       && <FleetPage />}
        {activeTab === 'ml'          && <MLDashboardPage />}
      </main>
    </>
  );
}
