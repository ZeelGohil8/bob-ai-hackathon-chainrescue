/**
 * SummaryCard — single KPI tile.
 */
export default function SummaryCard({ label, value, sub }) {
  return (
    <div className="summary-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
