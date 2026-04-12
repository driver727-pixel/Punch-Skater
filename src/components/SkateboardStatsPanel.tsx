import type { BoardLoadout } from "../lib/boardBuilder";

interface SkateboardStatsPanelProps {
  loadout: BoardLoadout;
}

interface NeonBarProps {
  label: string;
  value: number;
  colorClass: string;
  /** Tooltip shown on hover over the stat label */
  tooltip?: string;
}

function NeonBar({ label, value, colorClass, tooltip }: NeonBarProps) {
  const pct = (Math.min(Math.max(value, 0), 10) / 10) * 100;
  return (
    <div className="skate-stat-bar">
      <span className="skate-stat-label" title={tooltip}>{label}</span>
      <div className={`neon-tube ${colorClass}`}>
        <div
          className="neon-filament"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="skate-stat-value">{value}</span>
    </div>
  );
}

export function SkateboardStatsPanel({ loadout }: SkateboardStatsPanelProps) {
  return (
    <div className="skate-stats-panel">
      <span className="skate-stats-title">BOARD STATS</span>

      <NeonBar label="Speed" value={loadout.speed}        colorClass="neon-tube--cyan"    tooltip="Board top speed" />
      <NeonBar label="Accel" value={loadout.acceleration} colorClass="neon-tube--magenta" tooltip="How quickly the board reaches top speed" />
      <NeonBar label="Range" value={loadout.range}        colorClass="neon-tube--green"   tooltip="Battery range before recharge is needed" />

      <div className="skate-text-stats">
        <div className="skate-text-row">
          <span className="skate-text-key">DISTRICT</span>
          <span className="skate-text-val neon-label--green">{loadout.district}</span>
        </div>
        <div className="skate-text-row">
          <span className="skate-text-key">STYLE</span>
          <span className="skate-text-val neon-label--cyan">{loadout.style}</span>
        </div>
      </div>
    </div>
  );
}
