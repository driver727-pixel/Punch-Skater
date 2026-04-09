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

// ── Named component catalog ────────────────────────────────────────────────────

/**
 * A specific named product used as a source asset for fal.ai image generation.
 * These are distinct from the abstract `BoardOption` gameplay categories —
 * they carry a rich visual description so the asset generator can produce
 * accurate product imagery for each component.
 */
export interface BoardComponentModel {
  /** Top-level category label shown in the Asset Generator UI. */
  category: "Deck" | "Wheel" | "Drivetrain";
  /** Human-readable product name. */
  name: string;
  /** Detailed visual description fed to the fal.ai prompt. */
  description: string;
  /** Stable slug used as the image cache / seed key. */
  seedKey: string;
  /** Display icon. */
  icon: string;
}

export const BOARD_COMPONENT_CATALOG: BoardComponentModel[] = [
  // ── Decks ──────────────────────────────────────────────────────────────────
  {
    category: "Deck",
    name: "Carbon Street Drop-Through",
    description:
      "A sleek, low-profile carbon fiber drop-through longboard deck with geometric grip tape.",
    seedKey: "deck-carbon-street-drop-through",
    icon: "🛹",
  },
  {
    category: "Deck",
    name: "Bamboo AT Top-Mount",
    description:
      "A wide, sturdy bamboo top-mount deck with aggressive, heavy-duty grip tape.",
    seedKey: "deck-bamboo-at-top-mount",
    icon: "🏕️",
  },
  {
    category: "Deck",
    name: "Off-Grid Mountain Board",
    description:
      "A flexible composite mountain board deck equipped with rugged foot bindings.",
    seedKey: "deck-off-grid-mountain-board",
    icon: "⛰️",
  },
  {
    category: "Deck",
    name: "Swallowtail Surf-Skate",
    description:
      "A short, wide cruiser deck with a distinct swallowtail shape and vibrant retro grip art.",
    seedKey: "deck-swallowtail-surf-skate",
    icon: "🏄",
  },

  // ── Wheels ─────────────────────────────────────────────────────────────────
  {
    category: "Wheel",
    name: "100mm Urethane Street",
    description:
      "A set of smooth, translucent neon-green 100mm polyurethane street wheels.",
    seedKey: "wheel-100mm-urethane-street",
    icon: "🟡",
  },
  {
    category: "Wheel",
    name: "175mm Pneumatic AT",
    description:
      "A set of chunky, knobby 175mm rubber pneumatic all-terrain tires on metallic hubs.",
    seedKey: "wheel-175mm-pneumatic-at",
    icon: "🟢",
  },
  {
    category: "Wheel",
    name: "120mm Cloud Sliders",
    description:
      "Oversized, shock-absorbing 120mm foam-core urethane slider wheels.",
    seedKey: "wheel-120mm-cloud-sliders",
    icon: "⚪",
  },

  // ── Drivetrains ────────────────────────────────────────────────────────────
  {
    category: "Drivetrain",
    name: "Dual Belt Drive",
    description:
      "Heavy-duty dual rear belt-drive motors with exposed mechanical pulleys and wide trucks.",
    seedKey: "drivetrain-dual-belt-drive",
    icon: "⚙️",
  },
  {
    category: "Drivetrain",
    name: "Sealed Gear Drive",
    description:
      "Rugged, fully enclosed gear-drive trucks built for high torque and off-road abuse.",
    seedKey: "drivetrain-sealed-gear-drive",
    icon: "🔩",
  },
  {
    category: "Drivetrain",
    name: "Stealth Hub Motors",
    description:
      "Sleek, minimalist in-wheel hub motors attached to precision carving trucks.",
    seedKey: "drivetrain-stealth-hub-motors",
    icon: "🔇",
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
