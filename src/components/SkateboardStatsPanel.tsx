import type { BoardLoadout } from "../lib/boardBuilder";

// Inline stat labels since BOARD_STAT_LABELS and SKATE_STAT_LABELS were removed
const BOARD_STATS = {
  speed:        { label: "Speed",  tooltip: "Board top speed" },
  acceleration: { label: "Accel",  tooltip: "How quickly the board reaches top speed" },
  range:        { label: "Range",  tooltip: "Battery range before recharge is needed" },
} as const;

const SKATE_STATS = {
  spd: { label: "SPD", tooltip: "Speed — penalised by total component weight" },
  rng: { label: "RNG", tooltip: "Range — distance covered before battery is depleted" },
  stl: { label: "STL", tooltip: "Stealth — penalised by total component weight" },
  grt: { label: "GRT", tooltip: "Grit — toughness and off-road resilience" },
} as const;

interface SkateboardStatsPanelProps {
  loadout: BoardLoadout;
}

interface NeonBarProps {
  label: string;
  value: number;
  max: number;
  colorClass: string;
  /** Tooltip shown on hover over the stat label */
  tooltip?: string;
}

function NeonBar({ label, value, max, colorClass, tooltip }: NeonBarProps) {
  const pct = max > 0 ? (Math.min(Math.max(value, 0), max) / max) * 100 : 0;
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

/**
 * Maximum raw value used to scale Stat Envelope bars in the UI.
 * Derived from the highest theoretical single-stat total across all components:
 * e.g. GRT on a max-GRT build (Mountain + 4WD + Mtn Runner 10000 + Rubber + TopPeli)
 * yields 55 + 55 + 50 + 45 + 25 = 230. 220 is used as a slightly conservative
 * ceiling so the heaviest builds still show a visible bar.
 */
const SKATE_STAT_MAX = 220;

export function SkateboardStatsPanel({ loadout }: SkateboardStatsPanelProps) {
  const { skateStats } = loadout;

  return (
    <div className="skate-stats-panel">
      <span className="skate-stats-title">BOARD STATS</span>

      <NeonBar label={BOARD_STATS.speed.label}        value={loadout.speed}        max={10} colorClass="neon-tube--cyan"    tooltip={BOARD_STATS.speed.tooltip} />
      <NeonBar label={BOARD_STATS.acceleration.label} value={loadout.acceleration} max={10} colorClass="neon-tube--magenta" tooltip={BOARD_STATS.acceleration.tooltip} />
      <NeonBar label={BOARD_STATS.range.label}        value={loadout.range}        max={10} colorClass="neon-tube--green"   tooltip={BOARD_STATS.range.tooltip} />

      {skateStats && (
        <>
          <div className="skate-stats-divider" aria-hidden="true" />
          {skateStats.isTuned && (
            <span className="skate-stats-tuned-badge" title="Critical Forge — weight reduced 15 %">
              ⚡ TUNED
            </span>
          )}
          <NeonBar label={SKATE_STATS.spd.label} value={skateStats.spd} max={SKATE_STAT_MAX} colorClass="neon-tube--cyan"    tooltip={SKATE_STATS.spd.tooltip} />
          <NeonBar label={SKATE_STATS.rng.label} value={skateStats.rng} max={SKATE_STAT_MAX} colorClass="neon-tube--green"   tooltip={SKATE_STATS.rng.tooltip} />
          <NeonBar label={SKATE_STATS.stl.label} value={skateStats.stl} max={SKATE_STAT_MAX} colorClass="neon-tube--magenta" tooltip={SKATE_STATS.stl.tooltip} />
          <NeonBar label={SKATE_STATS.grt.label} value={skateStats.grt} max={SKATE_STAT_MAX} colorClass="neon-tube--yellow"  tooltip={SKATE_STATS.grt.tooltip} />
          <div className="skate-text-stats">
            <div className="skate-text-row">
              <span className="skate-text-key">WEIGHT</span>
              <span className="skate-text-val neon-label--cyan">{skateStats.totalWeight}</span>
            </div>
          </div>
        </>
      )}

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
