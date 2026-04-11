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
 *   4. Battery     — SlimStealth · DoubleStack · TopPeli
 */

export type BoardType = "Street" | "AT" | "Mountain" | "Surf" | "Slider";
export type Drivetrain = "Belt" | "Hub" | "Gear" | "AWD";
export type WheelType = "Urethane" | "Pneumatic" | "Rubber";
export type BatteryType = "SlimStealth" | "DoubleStack" | "TopPeli";

export interface BoardConfig {
  boardType: BoardType;
  drivetrain: Drivetrain;
  wheels: WheelType;
  battery: BatteryType;
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

// ── Battery options ────────────────────────────────────────────────────────────

export interface BatteryOption {
  value: BatteryType;
  label: string;
  icon: string;
  tagline: string;
  description: string;
  /** Integer range 1–10. */
  range: number;
  /** When true the battery mounts on top of the deck. */
  isTopMounted: boolean;
  /** Additive stat bonuses applied when this option is chosen. */
  statBonuses: Partial<Record<BoardStatKey, number>>;
}

export const BATTERY_OPTIONS: BatteryOption[] = [
  {
    value: "SlimStealth",
    label: "Slim Stealth Pack",
    icon: "🔋",
    tagline: "Low profile, out of sight",
    description: "Low profile, standard range, hidden carbon enclosure.",
    range: 4,
    isTopMounted: false,
    statBonuses: { stealth: 2 },
  },
  {
    value: "DoubleStack",
    label: "Double-Stack Brick",
    icon: "🧱",
    tagline: "Built for the long haul",
    description: "Heavy, thick enclosure meant for long journeys.",
    range: 8,
    isTopMounted: false,
    statBonuses: { grit: 1, rep: 1 },
  },
  {
    value: "TopPeli",
    label: "Top-Mounted Peli Case",
    icon: "📦",
    tagline: "Rugged and waterproof",
    description: "A rugged, waterproof utility box strapped to the top of the deck.",
    range: 10,
    isTopMounted: true,
    statBonuses: { tech: 1, rep: 2 },
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
  category: "Deck" | "Wheel" | "Drivetrain" | "Battery" | "Truck";
  /** Human-readable product name. */
  name: string;
  /** Detailed visual description fed to the fal.ai prompt. */
  description: string;
  /** Stable slug used as the image cache / seed key. */
  seedKey: string;
  /** Display icon. */
  icon: string;
  /** Deck style descriptor (Decks only). */
  style?: string;
  /** Speed rating 1–10 (Drivetrains only). */
  speed?: number;
  /** Acceleration rating 1–10 (Drivetrains only). */
  acceleration?: number;
  /** Ideal terrain district (Wheels only). */
  district?: string;
  /** Range rating 1–10 (Batteries only). */
  range?: number;
  /** Whether the battery mounts on top of the deck (Batteries only). */
  isTopMounted?: boolean;
}

export const BOARD_COMPONENT_CATALOG: BoardComponentModel[] = [
  // ── Decks ──────────────────────────────────────────────────────────────────
  {
    category: "Deck",
    name: "Carbon Street Drop-Through",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A sleek, matte black carbon fiber longboard deck, drop-through mounting holes, symmetrical cutouts, ultra-thin profile, weave texture visible under studio lighting, isolated on white background.",
    seedKey: "deck-carbon-street-drop-through",
    icon: "🛹",
    style: "Sleek",
  },
  {
    category: "Deck",
    name: "Bamboo AT Top-Mount",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A light-grain bamboo electric skateboard deck, top-mount concave shape, clear grip tape showing wood grain, rugged aesthetic, thick enough for an enclosure.",
    seedKey: "deck-bamboo-at-top-mount",
    icon: "🏕️",
    style: "Aggressive",
  },
  {
    category: "Deck",
    name: "Off-Grid Mountain Board",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A heavy-duty composite mountainboard deck, extreme concave, foot strap mounting points, thick and rugged construction, matte tactical finish.",
    seedKey: "deck-off-grid-mountain-board",
    icon: "⛰️",
    style: "Aggressive",
  },
  {
    category: "Deck",
    name: "Swallowtail Surf-Skate",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A short, wide cruiser deck with a distinct swallowtail shape and vibrant retro grip art.",
    seedKey: "deck-swallowtail-surf-skate",
    icon: "🏄",
    style: "Retro",
  },

  // ── Wheels ─────────────────────────────────────────────────────────────────
  {
    category: "Wheel",
    name: "100mm Urethane Street",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A 100mm electric skateboard wheel, high-rebound translucent orange urethane, smooth surface, precision bearing seat, 80A durometer texture, realistic lighting.",
    seedKey: "wheel-100mm-urethane-street",
    icon: "🟡",
    district: "Electropolis",
  },
  {
    category: "Wheel",
    name: "175mm Pneumatic AT",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A 7-inch pneumatic all-terrain rubber tire for a skateboard, deep knobby tread pattern, black nylon hub, 3-spoke design, industrial look.",
    seedKey: "wheel-175mm-pneumatic-at",
    icon: "🟢",
    district: "The Forest",
  },
  {
    category: "Wheel",
    name: "120mm Cloud Sliders",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. 120mm semi-transparent foamies skateboard wheels, honeycomb core pattern, curved contact patch, rubberized texture, teal color.",
    seedKey: "wheel-120mm-cloud-sliders",
    icon: "⚪",
    district: "The Roads",
  },

  // ── Drivetrains ────────────────────────────────────────────────────────────
  {
    category: "Drivetrain",
    name: "Dual Belt Drive",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. An electric skateboard rear truck, dual 6374 brushless motors, heavy-duty rubber belts, aluminum motor mounts, CNC machined pulleys, mechanical engineering aesthetic.",
    seedKey: "drivetrain-dual-belt-drive",
    icon: "⚙️",
    speed: 8,
    acceleration: 6,
  },
  {
    category: "Drivetrain",
    name: "Sealed Gear Drive",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A professional electric skateboard gear drive system, fully enclosed CNC aluminum housing, oil-slick finish, precision bolts, rugged drivetrain mounted on 300mm trucks.",
    seedKey: "drivetrain-sealed-gear-drive",
    icon: "🔩",
    speed: 6,
    acceleration: 8,
  },
  {
    category: "Drivetrain",
    name: "Stealth Hub Motors",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. Minimalist electric skateboard hub motor wheels, brushless motor integrated into the wheel core, no visible belts or gears, sleek stealthy black finish, futuristic design.",
    seedKey: "drivetrain-stealth-hub-motors",
    icon: "🔇",
    speed: 7,
    acceleration: 5,
  },

  // ── Trucks ─────────────────────────────────────────────────────────────────
  {
    category: "Truck",
    name: "Front Truck",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A standalone electric skateboard front truck: anodized aluminum hanger and baseplate, precision kingpin and bushings, no motors or belts, clean machined finish, isolated on white background.",
    seedKey: "front-truck",
    icon: "🔧",
  },

  // ── Batteries ──────────────────────────────────────────────────────────────
  {
    category: "Battery",
    name: "Slim Stealth Pack",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. Ultra-low profile electric skateboard battery enclosure, flexible segmented plastic, matte black finish, charging port and power button visible, mounted to the underside of a deck.",
    seedKey: "battery-slim-stealth-pack",
    icon: "🔋",
    range: 4,
    isTopMounted: false,
  },
  {
    category: "Battery",
    name: "Double-Stack Brick",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. Large capacity double-stack 12s4p battery enclosure for DIY electric skateboard, rugged ABS plastic, thick profile, industrial heat-sink fins, heavy-duty aesthetic.",
    seedKey: "battery-double-stack-brick",
    icon: "🧱",
    range: 8,
    isTopMounted: false,
  },
  {
    category: "Battery",
    name: "Top-Mounted Peli Case",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A rugged, waterproof utility box strapped to the top of the deck.",
    seedKey: "battery-top-mounted-peli-case",
    icon: "📦",
    range: 10,
    isTopMounted: true,
  },
];

// ── Asset URL helpers ──────────────────────────────────────────────────────────

/** Maps each BoardType to the seedKey of its representative deck asset. */
const BOARD_TYPE_DECK_SEED: Record<BoardType, string | null> = {
  Street:   "deck-carbon-street-drop-through",
  AT:       "deck-bamboo-at-top-mount",
  Mountain: "deck-off-grid-mountain-board",
  Surf:     "deck-swallowtail-surf-skate",
  Slider:   null, // no catalog asset yet
};

/** Maps each Drivetrain value to the seedKey of its representative asset. */
const DRIVETRAIN_SEED: Record<Drivetrain, string | null> = {
  Belt: "drivetrain-dual-belt-drive",
  Hub:  "drivetrain-stealth-hub-motors",
  Gear: "drivetrain-sealed-gear-drive",
  AWD:  null, // no catalog asset yet
};

/** Maps each WheelType value to the seedKey of its representative asset. */
const WHEEL_SEED: Record<WheelType, string | null> = {
  Urethane:  "wheel-100mm-urethane-street",
  Pneumatic: "wheel-175mm-pneumatic-at",
  Rubber:    "wheel-120mm-cloud-sliders",
};

/** Maps each BatteryType value to the seedKey of its representative asset. */
const BATTERY_SEED: Record<BatteryType, string | null> = {
  SlimStealth: "battery-slim-stealth-pack",
  DoubleStack: "battery-double-stack-brick",
  TopPeli:     "battery-top-mounted-peli-case",
};

/**
 * Returns the public asset URLs for all four board layers based on the active
 * `BoardConfig`. Assets live at `public/assets/boards/<seedKey>.png`.
 * Returns `null` for any component that has no catalog asset yet.
 */
export function getBoardAssetUrls(config: BoardConfig): {
  deckUrl: string | null;
  drivetrainUrl: string | null;
  wheelsUrl: string | null;
  batteryUrl: string | null;
  batteryIsTopMounted: boolean;
} {
  const deckSeed    = BOARD_TYPE_DECK_SEED[config.boardType];
  const driveSeed   = DRIVETRAIN_SEED[config.drivetrain];
  const wheelSeed   = WHEEL_SEED[config.wheels];
  const batterySeed = BATTERY_SEED[config.battery];
  const batteryOpt  = BATTERY_OPTIONS.find((o) => o.value === config.battery);

  return {
    deckUrl:             deckSeed    ? `/assets/boards/${deckSeed}.png`    : null,
    drivetrainUrl:       driveSeed   ? `/assets/boards/${driveSeed}.png`   : null,
    wheelsUrl:           wheelSeed   ? `/assets/boards/${wheelSeed}.png`   : null,
    batteryUrl:          batterySeed ? `/assets/boards/${batterySeed}.png` : null,
    batteryIsTopMounted: batteryOpt?.isTopMounted ?? false,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the total additive stat bonuses across all four board selections. */
export function getBoardStatBonuses(
  config: BoardConfig,
): Partial<Record<BoardStatKey, number>> {
  const totals: Partial<Record<BoardStatKey, number>> = {};
  const type    = BOARD_TYPE_OPTIONS.find((o) => o.value === config.boardType);
  const drive   = DRIVETRAIN_OPTIONS.find((o) => o.value === config.drivetrain);
  const wheel   = WHEEL_OPTIONS.find((o) => o.value === config.wheels);
  const battery = BATTERY_OPTIONS.find((o) => o.value === config.battery);

  for (const option of [type, drive, wheel, battery]) {
    if (!option) continue;
    for (const [stat, bonus] of Object.entries(option.statBonuses) as [BoardStatKey, number][]) {
      totals[stat] = (totals[stat] ?? 0) + bonus;
    }
  }
  return totals;
}

/** Human-readable one-line summary of a completed board config. */
export function getBoardSummary(config: BoardConfig): string {
  const type    = BOARD_TYPE_OPTIONS.find((o) => o.value === config.boardType);
  const drive   = DRIVETRAIN_OPTIONS.find((o) => o.value === config.drivetrain);
  const wheel   = WHEEL_OPTIONS.find((o) => o.value === config.wheels);
  const battery = BATTERY_OPTIONS.find((o) => o.value === config.battery);
  return [type?.icon, config.boardType, "·", drive?.label, "·", wheel?.label, "Wheels", "·", battery?.label]
    .filter(Boolean)
    .join(" ");
}

/** Default board configuration applied when no selection has been made yet. */
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  boardType: "Street",
  drivetrain: "Belt",
  wheels: "Urethane",
  battery: "SlimStealth",
};

// ── Loadout stat defaults (used when a component has no catalog entry) ─────────

const DEFAULT_STYLE    = "Custom";
const DEFAULT_SPEED    = 5;
const DEFAULT_ACCEL    = 5;
const DEFAULT_DISTRICT = "The Roads";
const DEFAULT_RANGE    = 5;


/**
 * Combined stats derived from a fully assembled board.
 * Returned by `calculateBoardStats`.
 */
export interface BoardLoadout {
  /** Visual style of the selected deck (e.g. 'Aggressive', 'Sleek', 'Retro'). */
  style: string;
  /** Drivetrain top-speed rating (1–10). */
  speed: number;
  /** Drivetrain acceleration rating (1–10). */
  acceleration: number;
  /** Ideal terrain district from the selected wheel. */
  district: string;
  /** Battery range rating (1–10). */
  range: number;
}

/**
 * Derives the combined `BoardLoadout` stats from the four chosen components.
 * Values are sourced from the `BOARD_COMPONENT_CATALOG` entries that correspond
 * to the active `BoardConfig` selections.
 */
export function calculateBoardStats(config: BoardConfig): BoardLoadout {
  const deckSeed    = BOARD_TYPE_DECK_SEED[config.boardType];
  const driveSeed   = DRIVETRAIN_SEED[config.drivetrain];
  const wheelSeed   = WHEEL_SEED[config.wheels];
  const batterySeed = BATTERY_SEED[config.battery];

  const deckModel    = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === deckSeed);
  const driveModel   = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === driveSeed);
  const wheelModel   = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === wheelSeed);
  const batteryModel = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === batterySeed);

  return {
    style:        deckModel?.style         ?? DEFAULT_STYLE,
    speed:        driveModel?.speed        ?? DEFAULT_SPEED,
    acceleration: driveModel?.acceleration ?? DEFAULT_ACCEL,
    district:     wheelModel?.district     ?? DEFAULT_DISTRICT,
    range:        batteryModel?.range      ?? DEFAULT_RANGE,
  };
}
