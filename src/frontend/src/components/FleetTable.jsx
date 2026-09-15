import StatusBadge from './StatusBadge.jsx';
import UtilizationBar from './UtilizationBar.jsx';

/**
 * FleetTable — renders vehicle roster with load/fuel bars.
 * Props:
 *   vehicles — array of vehicle objects
 */
export default function FleetTable({ vehicles }) {
  if (!vehicles || vehicles.length === 0) {
    return <div className="state-empty">No vehicles found.</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Driver</th>
          <th>Location</th>
          <th>Status</th>
          <th>Load</th>
          <th>Fuel</th>
          <th>Last Maintenance</th>
        </tr>
      </thead>
      <tbody>
        {vehicles.map((v) => {
          const loadPct = v.capacityKg > 0
            ? Math.round((v.loadKg / v.capacityKg) * 100)
            : 0;
          return (
            <tr key={v.id}>
              <td>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.id}</span>
              </td>
              <td style={{ textTransform: 'capitalize' }}>
                {v.type.replace(/_/g, ' ')}
              </td>
              <td>{v.driver}</td>
              <td>
                <div style={{ fontWeight: 500 }}>{v.currentLocation.city}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {v.currentLocation.lat.toFixed(2)}°, {v.currentLocation.lon.toFixed(2)}°
                </div>
              </td>
              <td>
                <StatusBadge value={v.status} />
              </td>
              <td>
                <UtilizationBar pct={loadPct} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {v.loadKg.toLocaleString()} / {v.capacityKg.toLocaleString()} kg
                </div>
              </td>
              <td>
                <UtilizationBar
                  pct={v.fuelLevel}
                  color={
                    v.fuelLevel < 25
                      ? 'var(--red)'
                      : v.fuelLevel < 50
                      ? 'var(--orange)'
                      : 'var(--green)'
                  }
                />
              </td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{v.lastMaintenance}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
