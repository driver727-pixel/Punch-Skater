interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  /** Tooltip shown on hover over the stat label */
  tooltip?: string;
}

export function StatBar({ label, value, max = 10, color = "#00ff88", tooltip }: StatBarProps) {
  const pct = (value / max) * 100;
  return (
    <div className="stat-bar">
      <span className="stat-label" title={tooltip}>{label}</span>
      <div className="stat-track">
        <div
          className="stat-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}
