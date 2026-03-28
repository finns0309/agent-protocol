export function StatPill({ value, label, isText = false }) {
  return (
    <div className="stat-pill">
      <div className={`stat-pill-value ${isText ? "is-text" : ""}`}>{value}</div>
      <div className="stat-pill-label">{label}</div>
    </div>
  );
}
