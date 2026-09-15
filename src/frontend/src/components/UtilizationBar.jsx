/**
 * UtilizationBar — thin horizontal fill bar showing a percentage.
 * Props: pct (0-100), color (optional CSS colour override)
 */
export default function UtilizationBar({ pct = 0, color }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const fillColor =
    color ||
    (clamped >= 90 ? 'var(--red)' : clamped >= 60 ? 'var(--orange)' : 'var(--accent)');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="util-bar-wrap">
        <div
          className="util-bar-fill"
          style={{ width: `${clamped}%`, background: fillColor }}
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 30 }}>{clamped}%</span>
    </div>
  );
}
