/**
 * StatusBadge — coloured pill for severity or status values.
 * Usage: <StatusBadge value="critical" /> <StatusBadge value="available" />
 */
export default function StatusBadge({ value }) {
  if (!value) return null;
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      {value.replace('_', ' ')}
    </span>
  );
}
