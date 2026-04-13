import type { BoardLoadout } from "../lib/boardBuilder";
import { BOARD_STAT_LABELS } from "../lib/statLabels";

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

      <NeonBar label={BOARD_STAT_LABELS.speed.label}        value={loadout.speed}        colorClass="neon-tube--cyan"    tooltip={BOARD_STAT_LABELS.speed.tooltip} />
      <NeonBar label={BOARD_STAT_LABELS.acceleration.label} value={loadout.acceleration} colorClass="neon-tube--magenta" tooltip={BOARD_STAT_LABELS.acceleration.tooltip} />
      <NeonBar label={BOARD_STAT_LABELS.range.label}        value={loadout.range}        colorClass="neon-tube--green"   tooltip={BOARD_STAT_LABELS.range.tooltip} />

      <div className="skate-text-stats">
        <div className="skate-text-row">
          <span className="skate-text-key">ACCESS</span>
          <span className="skate-text-val neon-label--green">{loadout.accessProfile}</span>
        </div>
        <div className="skate-text-row">
          <span className="skate-text-key">STYLE</span>
          <span className="skate-text-val neon-label--cyan">{loadout.style}</span>
        </div>
      </div>
    </div>
  );
}
