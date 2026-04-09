import type { BoardLoadout } from "../lib/boardBuilder";

interface SkateboardStatsPanelProps {
  loadout: BoardLoadout;
}

interface NeonBarProps {
  label: string;
  value: number;
  colorClass: string;
}

function NeonBar({ label, value, colorClass }: NeonBarProps) {
  const pct = (Math.min(Math.max(value, 0), 10) / 10) * 100;
  return (
    <div className="skate-stat-bar">
      <span className="skate-stat-label">{label}</span>
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

      <NeonBar label="SPD" value={loadout.speed}        colorClass="neon-tube--cyan"    />
      <NeonBar label="ACC" value={loadout.acceleration} colorClass="neon-tube--magenta" />
      <NeonBar label="RNG" value={loadout.range}        colorClass="neon-tube--green"   />

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
