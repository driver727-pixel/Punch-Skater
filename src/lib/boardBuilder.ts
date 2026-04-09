/**
 * boardBuilder.ts
 *
 * Data structures and metadata for the electric-skateboard loadout builder.
 * The board acts as a "Weapon / Vehicle" loadout attached to the character.
 *
 * Categories:
 *   1. Board Type  — Street · AT · Mountain · Surf · Slider
 *   2. Drivetrain  — Belt · Hub · Gear · AWD
 *   3. Wheels      — Urethane · Pneumatic · Rubber
 */

export type BoardType = "Street" | "AT" | "Mountain" | "Surf" | "Slider";
export type Drivetrain = "Belt" | "Hub" | "Gear" | "AWD";
export type WheelType = "Urethane" | "Pneumatic" | "Rubber";

export interface BoardConfig {
  boardType: BoardType;
  drivetrain: Drivetrain;
  wheels: WheelType;
}

/** Stat keys that board bonuses can affect (mirrors CardPayload.stats). */
type BoardStatKey = "speed" | "stealth" | "tech" | "grit" | "rep";

export interface BoardOption<T extends string> {
  value: T;
  label: string;
  icon: string;
  tagline: string;
  description: string;
  /** Additive stat bonuses applied when this option is chosen. */
  statBonuses: Partial<Record<BoardStatKey, number>>;
}

// ── Board Type options ─────────────────────────────────────────────────────────

export const BOARD_TYPE_OPTIONS: BoardOption<BoardType>[] = [
  {
    value: "Street",
    label: "Street",
    icon: "🛹",
    tagline: "Built for the grid",
    description: "Low-profile deck tuned for urban pavement, tight alleyways, and short-range blitzes.",
    statBonuses: { speed: 2, stealth: 1 },
  },
  {
    value: "AT",
    label: "All-Terrain",
    icon: "🏕️",
    tagline: "No road required",
    description: "Elevated clearance and reinforced trucks handle cracked concrete, dirt, and debris with ease.",
    statBonuses: { grit: 2, rep: 1 },
  },
  {
    value: "Mountain",
    label: "Mountain",
    icon: "⛰️",
    tagline: "Downhill specialist",
    description: "Wide deck and aggressive stance for steep descents, off-camber trails, and high-G carves.",
    statBonuses: { speed: 1, grit: 2 },
  },
  {
    value: "Surf",
    label: "Surf",
    icon: "🏄",
    tagline: "Flow state activated",
    description: "Spring-loaded trucks simulate the pump of a wave. Smooth roads become infinite barrels.",
    statBonuses: { stealth: 2, rep: 1 },
  },
  {
    value: "Slider",
    label: "Slider",
    icon: "🎯",
    tagline: "Precision over power",
    description: "Short stiff deck optimized for technical footwork, gaps, and micro-adjustments under pressure.",
    statBonuses: { tech: 2, stealth: 1 },
  },
];

// ── Drivetrain options ─────────────────────────────────────────────────────────

export const DRIVETRAIN_OPTIONS: BoardOption<Drivetrain>[] = [
  {
    value: "Belt",
    label: "Belt Drive",
    icon: "⚙️",
    tagline: "Classic torque",
    description: "Exposed belt transfers maximum torque. Higher top speed, loud, and serviceable in the field.",
    statBonuses: { speed: 2, tech: 1 },
  },
  {
    value: "Hub",
    label: "Hub Motor",
    icon: "🔇",
    tagline: "Silent operator",
    description: "Motors live inside the wheels. Near-silent operation is perfect for ghost runs and surveillance.",
    statBonuses: { stealth: 3 },
  },
  {
    value: "Gear",
    label: "Gear Drive",
    icon: "🔩",
    tagline: "Built to last",
    description: "Helical gears deliver smooth consistent torque with no belt to snap during critical drops.",
    statBonuses: { grit: 2, tech: 1 },
  },
  {
    value: "AWD",
    label: "AWD",
    icon: "🌀",
    tagline: "All four pushing",
    description: "Four-wheel drive obliterates loose terrain and wet surfaces. Heavy, but nothing stops it.",
    statBonuses: { grit: 2, speed: 1 },
  },
];

// ── Wheel options ──────────────────────────────────────────────────────────────

export const WHEEL_OPTIONS: BoardOption<WheelType>[] = [
  {
    value: "Urethane",
    label: "Urethane",
    icon: "🟡",
    tagline: "Grip and carve",
    description: "High-rebound urethane bites into asphalt and holds a line through high-speed corners.",
    statBonuses: { speed: 1, rep: 1 },
  },
  {
    value: "Pneumatic",
    label: "Pneumatic",
    icon: "🟢",
    tagline: "Air-cushioned",
    description: "Inflatable tires absorb punishment from rough roads, curbs, and gravel with natural suspension.",
    statBonuses: { grit: 1, stealth: 1 },
  },
  {
    value: "Rubber",
    label: "Solid Rubber",
    icon: "⚫",
    tagline: "Puncture proof",
    description: "Solid rubber core never flats. Heavier ride, but ideal for debris-strewn industrial zones.",
    statBonuses: { grit: 2 },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the total additive stat bonuses across all three board selections. */
export function getBoardStatBonuses(
  config: BoardConfig,
): Partial<Record<BoardStatKey, number>> {
  const totals: Partial<Record<BoardStatKey, number>> = {};
  const type = BOARD_TYPE_OPTIONS.find((o) => o.value === config.boardType);
  const drive = DRIVETRAIN_OPTIONS.find((o) => o.value === config.drivetrain);
  const wheel = WHEEL_OPTIONS.find((o) => o.value === config.wheels);

  for (const option of [type, drive, wheel]) {
    if (!option) continue;
    for (const [stat, bonus] of Object.entries(option.statBonuses) as [BoardStatKey, number][]) {
      totals[stat] = (totals[stat] ?? 0) + bonus;
    }
  }
  return totals;
}

/** Human-readable one-line summary of a completed board config. */
export function getBoardSummary(config: BoardConfig): string {
  const type = BOARD_TYPE_OPTIONS.find((o) => o.value === config.boardType);
  const drive = DRIVETRAIN_OPTIONS.find((o) => o.value === config.drivetrain);
  const wheel = WHEEL_OPTIONS.find((o) => o.value === config.wheels);
  return [type?.icon, config.boardType, "·", drive?.label, "·", wheel?.label, "Wheels"]
    .filter(Boolean)
    .join(" ");
}

/** Default board configuration applied when no selection has been made yet. */
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  boardType: "Street",
  drivetrain: "Belt",
  wheels: "Urethane",
};
