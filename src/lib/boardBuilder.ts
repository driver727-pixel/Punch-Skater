/**
 * boardBuilder.ts
 *
 * Data structures and metadata for the electric-skateboard loadout builder.
 * The board acts as a "Weapon / Vehicle" loadout attached to the character.
 *
 * Categories:
 *   1. Board Type  — Street · AT · Mountain · Surf
 *   2. Drivetrain  — Belt · Hub · Gear · 4WD
 *   3. Wheels      — Urethane · Pneumatic · Rubber
 *   4. Battery     — SlimStealth · DoubleStack · TopPeli
 */

import { withBoardComponentAssetVersion } from "./boardAssetVersion";

export type BoardType = "Street" | "AT" | "Mountain" | "Surf" | "Slider";
export type Drivetrain = "Belt" | "Hub" | "Gear" | "4WD";
export type MotorType = "Micro" | "Standard" | "Torque" | "Outrunner";
export type WheelType = "Urethane" | "Pneumatic" | "Rubber" | "Cloud";
export type BatteryType = "SlimStealth" | "DoubleStack" | "TopPeli";

export interface BoardConfig {
  boardType: BoardType;
  drivetrain: Drivetrain;
  motor: MotorType;
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
  // NOTE: Slider is not yet publicly available — omitted from this array intentionally.
  // Add it back here when ready to reveal.
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
    label: "Hub Drive",
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
    value: "4WD",
    label: "4WD",
    icon: "🌀",
    tagline: "All four pushing",
    description: "Four-wheel drive obliterates loose terrain and wet surfaces. Heavy, but nothing stops it.",
    statBonuses: { grit: 2, speed: 1 },
  },
];

// ── Motor options ──────────────────────────────────────────────────────────────

export interface MotorOption {
  value: MotorType;
  label: string;
  icon: string;
  tagline: string;
  description: string;
  /** Acceleration rating 1–10. */
  acceleration: number;
  /** Additive stat bonuses applied when this option is chosen. */
  statBonuses: Partial<Record<BoardStatKey, number>>;
}

export const MOTOR_OPTIONS: MotorOption[] = [
  {
    value: "Micro",
    label: "Micro 5055",
    icon: "🔌",
    tagline: "Lightweight starter",
    description: "Small 5055-class motor. Quiet, efficient, and easy to replace. Best for lightweight commuter setups.",
    acceleration: 3,
    statBonuses: { stealth: 1, tech: 1 },
  },
  {
    value: "Standard",
    label: "Standard 6354",
    icon: "⚡",
    tagline: "Balanced power",
    description: "Mid-range 6354-class motor delivers reliable acceleration for everyday runs and hill climbs.",
    acceleration: 5,
    statBonuses: { speed: 1, grit: 1 },
  },
  {
    value: "Torque",
    label: "Torque 6374",
    icon: "💪",
    tagline: "Maximum pull",
    description: "Heavy 6374-class motor built for instant torque. Launches hard off the line and eats steep grades.",
    acceleration: 8,
    statBonuses: { grit: 2, rep: 1 },
  },
  {
    value: "Outrunner",
    label: "Outrunner 6396",
    icon: "🚀",
    tagline: "Race-grade power",
    description: "Oversized 6396-class outrunner motor. Maximum acceleration for riders who need to disappear fast.",
    acceleration: 10,
    statBonuses: { speed: 2, rep: 1 },
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
  {
    value: "Cloud",
    label: "Cloud Wheels",
    icon: "⚪",
    tagline: "Smooth and floaty",
    description: "Semi-transparent foam-core wheels with a wide contact patch. Absorbs road buzz and flows through carves.",
    statBonuses: { stealth: 1, rep: 1 },
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
  category: "Deck" | "Wheel" | "Drivetrain" | "Motor" | "Battery" | "Truck";
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
  /** Terrain / district access profile (Wheels only). */
  accessProfile?: string;
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
    accessProfile: "Urban district access",
  },
  {
    category: "Wheel",
    name: "175mm Pneumatic AT",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A 7-inch pneumatic all-terrain rubber tire for a skateboard, deep knobby tread pattern, black nylon hub, 3-spoke design, industrial look.",
    seedKey: "wheel-175mm-pneumatic-at",
    icon: "🟢",
    accessProfile: "Off-grid forest access",
  },
  {
    category: "Wheel",
    name: "120mm Cloud Sliders",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. 120mm semi-transparent foamies skateboard wheels, honeycomb core pattern, curved contact patch, rubberized texture, teal color.",
    seedKey: "wheel-120mm-cloud-sliders",
    icon: "⚪",
    accessProfile: "Broken-corridor access",
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

  // ── Motors ──────────────────────────────────────────────────────────────────
  {
    category: "Motor",
    name: "Micro 5055",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A small 5055-class brushless outrunner motor for electric skateboards, compact cylindrical form, exposed stator windings, 8mm shaft, lightweight anodized aluminum housing.",
    seedKey: "motor-micro-5055",
    icon: "🔌",
    acceleration: 3,
  },
  {
    category: "Motor",
    name: "Standard 6354",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A mid-range 6354-class brushless motor for electric skateboards, black anodized cylindrical body, visible sensor wires, balanced size for commuter boards.",
    seedKey: "motor-standard-6354",
    icon: "⚡",
    acceleration: 5,
  },
  {
    category: "Motor",
    name: "Torque 6374",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A large 6374-class high-torque brushless motor, chunky cylindrical housing, heavy gauge phase wires, brass bullet connectors, industrial finish.",
    seedKey: "motor-torque-6374",
    icon: "💪",
    acceleration: 8,
  },
  {
    category: "Motor",
    name: "Outrunner 6396",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. An oversized 6396-class outrunner brushless motor, massive cylindrical housing with cooling fins, thick phase wires, race-grade engineering.",
    seedKey: "motor-outrunner-6396",
    icon: "🚀",
    acceleration: 10,
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
  "4WD": null, // no catalog asset yet
};

/** Maps each WheelType value to the seedKey of its representative asset. */
const WHEEL_SEED: Record<WheelType, string | null> = {
  Urethane:  "wheel-100mm-urethane-street",
  Pneumatic: "wheel-175mm-pneumatic-at",
  Rubber:    null,
  Cloud:     "wheel-120mm-cloud-sliders",
};

/** Maps each BatteryType value to the seedKey of its representative asset. */
const BATTERY_SEED: Record<BatteryType, string | null> = {
  SlimStealth: "battery-slim-stealth-pack",
  DoubleStack: "battery-double-stack-brick",
  TopPeli:     "battery-top-mounted-peli-case",
};

/** Maps each MotorType value to the seedKey of its representative asset. */
const MOTOR_SEED: Record<MotorType, string | null> = {
  Micro:     "motor-micro-5055",
  Standard:  "motor-standard-6354",
  Torque:    "motor-torque-6374",
  Outrunner: "motor-outrunner-6396",
};

/**
 * Returns the public asset URLs for all four board layers based on the active
 * `BoardConfig`. Assets live at `public/assets/boards/<seedKey>.png`.
 * Returns `null` for any component that has no catalog asset yet.
 */
export function getBoardAssetUrls(config: BoardConfig): {
  deckUrl: string | null;
  drivetrainUrl: string | null;
  motorUrl: string | null;
  wheelsUrl: string | null;
  batteryUrl: string | null;
  batteryIsTopMounted: boolean;
} {
  const normalizedConfig = normalizeBoardConfig(config);
  const deckSeed    = BOARD_TYPE_DECK_SEED[normalizedConfig.boardType];
  const driveSeed   = DRIVETRAIN_SEED[normalizedConfig.drivetrain];
  const motorSeed   = MOTOR_SEED[normalizedConfig.motor];
  const wheelSeed   = WHEEL_SEED[normalizedConfig.wheels];
  const batterySeed = BATTERY_SEED[normalizedConfig.battery];
  const batteryOpt  = BATTERY_OPTIONS.find((o) => o.value === normalizedConfig.battery);

  return {
    deckUrl:             deckSeed    ? `/assets/boards/${deckSeed}.png`    : null,
    drivetrainUrl:       driveSeed   ? `/assets/boards/${driveSeed}.png`   : null,
    motorUrl:            motorSeed   ? `/assets/boards/${motorSeed}.png`   : null,
    wheelsUrl:           wheelSeed   ? `/assets/boards/${wheelSeed}.png`   : null,
    batteryUrl:          batterySeed ? `/assets/boards/${batterySeed}.png` : null,
    batteryIsTopMounted: batteryOpt?.isTopMounted ?? false,
  };
}

// ── Component image folder URLs ────────────────────────────────────────────────

/**
 * Returns the image URL for each selected component from the per-category
 * folders under `public/assets/boards/<category>/<Value>.png`.
 *
 * The user uploads real product photos into these folders:
 *   deck/       — one PNG per BoardType   (e.g. Street.png, AT.png)
 *   drivetrain/ — one PNG per Drivetrain  (e.g. Belt.png, Hub.png)
 *   motor/      — one PNG per MotorType   (e.g. Standard.png, Torque.png)
 *   wheels/     — one PNG per WheelType   (e.g. Urethane.png, Pneumatic.png)
 *   battery/    — one PNG per BatteryType (e.g. SlimStealth.png, DoubleStack.png)
 */
export interface BoardComponentImageUrls {
  deckUrl: string;
  drivetrainUrl: string;
  motorUrl: string;
  wheelsUrl: string;
  batteryUrl: string;
}

export function getBoardComponentImageUrls(config: BoardConfig): BoardComponentImageUrls {
  const normalizedConfig = normalizeBoardConfig(config);
  return {
    deckUrl:       withBoardComponentAssetVersion(`/assets/boards/deck/${normalizedConfig.boardType}.png`),
    drivetrainUrl: withBoardComponentAssetVersion(`/assets/boards/drivetrain/${normalizedConfig.drivetrain}.png`),
    motorUrl:      withBoardComponentAssetVersion(`/assets/boards/motor/${normalizedConfig.motor}.png`),
    wheelsUrl:     withBoardComponentAssetVersion(`/assets/boards/wheels/${normalizedConfig.wheels}.png`),
    batteryUrl:    withBoardComponentAssetVersion(`/assets/boards/battery/${normalizedConfig.battery}.png`),
  };
}

// ── Board image prompt builder ─────────────────────────────────────────────────

function sanitizeBoardComponentPromptDescription(description: string): string {
  return description
    .replace(/^Isometric view 45 degree angle top down\.\s*/i, "")
    .replace(/^Product photography shot\.\s*/i, "")
    .replace(/^Art style of gouache painting\.\s*/i, "");
}

const FOUR_WHEEL_DRIVE_VISUAL =
  "A four-wheel-drive electric skateboard drivetrain with powered front and rear trucks, dual motor hardware on both axles, heavy-duty mounts, and visible off-road engineering.";

const RUBBER_WHEEL_VISUAL =
  "A set of four solid rubber all-terrain skateboard wheels, matte black, thick sidewalls, heavy-duty cores, and puncture-proof construction.";

function getBoardCatalogPromptDescription(seedKey: string | null | undefined): string | undefined {
  if (!seedKey) return undefined;
  const model = BOARD_COMPONENT_CATALOG.find((item) => item.seedKey === seedKey);
  return model ? sanitizeBoardComponentPromptDescription(model.description) : undefined;
}

/**
 * Builds a single AI-generation prompt describing the fully assembled electric
 * skateboard from the five chosen components. This prompt is used to generate
 * the skateboard image that appears on the player card.
 */
export function buildBoardImagePrompt(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);
  const deck  = BOARD_TYPE_OPTIONS.find((o) => o.value === normalizedConfig.boardType);
  const drive = DRIVETRAIN_OPTIONS.find((o) => o.value === normalizedConfig.drivetrain);
  const motor = MOTOR_OPTIONS.find((o) => o.value === normalizedConfig.motor);
  const wheel = WHEEL_OPTIONS.find((o) => o.value === normalizedConfig.wheels);
  const batt  = BATTERY_OPTIONS.find((o) => o.value === normalizedConfig.battery);

  const deckDesc  = deck?.description  ?? normalizedConfig.boardType;
  const driveDesc = drive?.description ?? normalizedConfig.drivetrain;
  const motorDesc = motor?.description ?? normalizedConfig.motor;
  const wheelDesc = wheel?.description ?? normalizedConfig.wheels;
  const battDesc  = batt?.description  ?? normalizedConfig.battery;
  const deckVisual = getBoardCatalogPromptDescription(BOARD_TYPE_DECK_SEED[normalizedConfig.boardType])
    ?? `${deckDesc} Deck shape and stance must clearly match a ${normalizedConfig.boardType} setup.`;
  const driveVisual = getBoardCatalogPromptDescription(DRIVETRAIN_SEED[normalizedConfig.drivetrain])
    ?? (
      normalizedConfig.drivetrain === "4WD"
        ? FOUR_WHEEL_DRIVE_VISUAL
        : driveDesc
    );
  const motorVisual = getBoardCatalogPromptDescription(MOTOR_SEED[normalizedConfig.motor]) ?? motorDesc;
  const wheelVisual = getBoardCatalogPromptDescription(WHEEL_SEED[normalizedConfig.wheels])
    ?? (
      normalizedConfig.wheels === "Rubber"
        ? RUBBER_WHEEL_VISUAL
        : wheelDesc
    );
  const battVisual = getBoardCatalogPromptDescription(BATTERY_SEED[normalizedConfig.battery]) ?? battDesc;
  const batteryPlacement = batt?.isTopMounted
    ? "The battery must be visibly mounted on top of the deck."
    : "The battery must be visibly mounted underneath the deck.";
  const drivetrainConstraint =
    normalizedConfig.drivetrain === "Hub"
      ? "No exposed belts, pulleys, chains, or external gearboxes anywhere on the board."
      : normalizedConfig.drivetrain === "Gear"
        ? "Show enclosed gear-drive housings instead of belts."
        : normalizedConfig.drivetrain === "Belt"
          ? "Show exposed belts, pulleys, and rear motor mounts."
          : "Show powered front and rear axles for a true 4WD setup.";

  return (
    `Isometric 45-degree hero illustration of a fully assembled ` +
    `DIY electric skateboard on a clean white studio background. ` +
    `Build one coherent board using exactly these selected parts with no substitutions: ` +
    `Deck — ${deckVisual} ` +
    `Drivetrain — ${driveVisual} ` +
    `Motor — ${motorVisual} ` +
    `Wheels — ${wheelVisual} ` +
    `Battery — ${battVisual} ` +
    `The assembled board must clearly preserve the selected deck shape, drivetrain hardware, motor size, wheel type, and battery form factor. ` +
    `${batteryPlacement} ` +
    `${drivetrainConstraint} ` +
    `Single complete skateboard only, no rider, no extra loose parts, no exploded diagram, no duplicate components. ` +
    `Bold non-photoreal 1990s X-Men-era superhero comic-book rendering with crisp inked outlines, halftone texture, painted highlights, graphic shadows, ` +
    `vibrant saturated colors, sharp detail, clearly illustrated not photographed, not a product photo, not live-action, not a 3D render, isolated on white background.`
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const LEGACY_FOUR_WHEEL_DRIVE = "A" + "WD";

function normalizeDrivetrain(drivetrain: string): Drivetrain {
  return drivetrain === LEGACY_FOUR_WHEEL_DRIVE ? "4WD" : drivetrain as Drivetrain;
}

export function normalizeBoardConfig(config: BoardConfig): BoardConfig {
  return {
    ...config,
    drivetrain: normalizeDrivetrain(config.drivetrain),
  };
}

/** Returns the total additive stat bonuses across all five board selections. */
export function getBoardStatBonuses(
  config: BoardConfig,
): Partial<Record<BoardStatKey, number>> {
  const normalizedConfig = normalizeBoardConfig(config);
  const totals: Partial<Record<BoardStatKey, number>> = {};
  const type    = BOARD_TYPE_OPTIONS.find((o) => o.value === normalizedConfig.boardType);
  const drive   = DRIVETRAIN_OPTIONS.find((o) => o.value === normalizedConfig.drivetrain);
  const motor   = MOTOR_OPTIONS.find((o) => o.value === normalizedConfig.motor);
  const wheel   = WHEEL_OPTIONS.find((o) => o.value === normalizedConfig.wheels);
  const battery = BATTERY_OPTIONS.find((o) => o.value === normalizedConfig.battery);

  for (const option of [type, drive, motor, wheel, battery]) {
    if (!option) continue;
    for (const [stat, bonus] of Object.entries(option.statBonuses) as [BoardStatKey, number][]) {
      totals[stat] = (totals[stat] ?? 0) + bonus;
    }
  }
  return totals;
}

/** Human-readable one-line summary of a completed board config. */
export function getBoardSummary(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);
  const type    = BOARD_TYPE_OPTIONS.find((o) => o.value === normalizedConfig.boardType);
  const drive   = DRIVETRAIN_OPTIONS.find((o) => o.value === normalizedConfig.drivetrain);
  const motor   = MOTOR_OPTIONS.find((o) => o.value === normalizedConfig.motor);
  const wheel   = WHEEL_OPTIONS.find((o) => o.value === normalizedConfig.wheels);
  const battery = BATTERY_OPTIONS.find((o) => o.value === normalizedConfig.battery);
  return [type?.icon, normalizedConfig.boardType, "·", drive?.label, "·", motor?.label, "·", wheel?.label, "Wheels", "·", battery?.label]
    .filter(Boolean)
    .join(" ");
}

/** Default board configuration applied when no selection has been made yet. */
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  boardType: "Street",
  drivetrain: "Belt",
  motor: "Standard",
  wheels: "Urethane",
  battery: "SlimStealth",
};

// ── Loadout stat defaults (used when a component has no catalog entry) ─────────

const DEFAULT_STYLE = "Custom";
const DEFAULT_SPEED = 5;
const DEFAULT_ACCEL = 5;
const DEFAULT_RANGE = 5;
const WHEEL_ACCESS_PROFILES: Record<WheelType, string> = {
  Urethane: "Urban district access",
  Pneumatic: "Off-grid district access",
  Rubber: "Heavy-duty district access",
  Cloud: "Corridor glide access",
};
const DEFAULT_ACCESS_PROFILE = "General district access";


/**
 * Combined stats derived from a fully assembled board.
 * Returned by `calculateBoardStats`.
 */
export interface BoardLoadout {
  /** Visual style of the selected deck (e.g. 'Aggressive', 'Sleek', 'Retro'). */
  style: string;
  /** Top-speed rating determined by the drivetrain (1–10). */
  speed: number;
  /** Acceleration rating determined by the motor (1–10). */
  acceleration: number;
  /** Wheel-driven district / corridor access profile. */
  accessProfile: string;
  /** Battery range rating (1–10). */
  range: number;
}

/**
 * Derives the combined `BoardLoadout` stats from the five chosen components.
 *
 * Stat mapping:
 *   Top Speed    ← Drivetrain
 *   Acceleration ← Motor
 *   Range        ← Battery
 *   Access       ← Wheels
 *   Style        ← Deck
 */
export function calculateBoardStats(config: BoardConfig): BoardLoadout {
  const normalizedConfig = normalizeBoardConfig(config);
  const deckSeed    = BOARD_TYPE_DECK_SEED[normalizedConfig.boardType];
  const driveSeed   = DRIVETRAIN_SEED[normalizedConfig.drivetrain];
  const motorSeed   = MOTOR_SEED[normalizedConfig.motor];
  const wheelSeed   = WHEEL_SEED[normalizedConfig.wheels];
  const batterySeed = BATTERY_SEED[normalizedConfig.battery];

  const deckModel    = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === deckSeed);
  const driveModel   = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === driveSeed);
  const motorModel   = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === motorSeed);
  const wheelModel   = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === wheelSeed);
  const batteryModel = BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === batterySeed);

  return {
    style:        deckModel?.style         ?? DEFAULT_STYLE,
    speed:        driveModel?.speed        ?? DEFAULT_SPEED,
    acceleration: motorModel?.acceleration ?? DEFAULT_ACCEL,
    accessProfile: wheelModel?.accessProfile ?? WHEEL_ACCESS_PROFILES[normalizedConfig.wheels] ?? DEFAULT_ACCESS_PROFILE,
    range:        batteryModel?.range      ?? DEFAULT_RANGE,
  };
}

// ── Compatibility rules ──────────────────────────────────────────────────────
//
// Deck-specific restrictions on which components can be paired:
//   Street  (Carbon Fiber) — any wheels, but NOT top-mount battery, NOT 4WD drivetrain
//   Mountain               — Pneumatic or Solid Rubber wheels; MUST use top-mount battery (TopPeli); MUST use 4WD; no Micro motor
//   Surf                   — no top-mount battery; no Double-Stack Brick battery; no Pneumatic or Solid Rubber wheels; no Belt drive; no 4WD drivetrain; no Torque 6374 or Outrunner 6396 motors
//   AT (Bamboo)            — no top-mount battery; no 4WD; no Micro motor; Belt drive allowed
//   Slider                 — no restrictions

export interface CompatibilityError {
  component: "drivetrain" | "motor" | "wheels" | "battery";
  message: string;
}

/** Returns a list of compatibility errors for the given board config. An empty array means the config is valid. */
export function validateBoardCompatibility(config: BoardConfig): CompatibilityError[] {
  const normalizedConfig = normalizeBoardConfig(config);
  const errors: CompatibilityError[] = [];
  const batteryOpt = BATTERY_OPTIONS.find((o) => o.value === normalizedConfig.battery);
  const isTopMount = batteryOpt?.isTopMounted ?? false;

  switch (normalizedConfig.boardType) {
    case "Street":
      // Carbon Fiber deck can use any wheels, but NOT top mount battery or 4WD
      if (isTopMount) {
        errors.push({ component: "battery", message: "Carbon Fiber deck cannot use a top-mounted battery." });
      }
      if (normalizedConfig.drivetrain === "4WD") {
        errors.push({ component: "drivetrain", message: "Street board cannot use 4WD drivetrain." });
      }
      break;
    case "Mountain":
      // Mountain board cannot use Urethane or Cloud wheels; must use Pneumatic or Solid Rubber
      if (normalizedConfig.wheels === "Urethane") {
        errors.push({ component: "wheels", message: "Mountain board cannot use Poly (Urethane) wheels." });
      }
      if (normalizedConfig.wheels === "Cloud") {
        errors.push({ component: "wheels", message: "Mountain board cannot use Cloud wheels." });
      }
      // Mountain board MUST use top mount battery
      if (!isTopMount) {
        errors.push({ component: "battery", message: "Mountain board must use a top-mounted battery." });
      }
      // Mountain board MUST use 4WD
      if (normalizedConfig.drivetrain !== "4WD") {
        errors.push({ component: "drivetrain", message: "Mountain board must use 4WD drivetrain." });
      }
      // Mountain board cannot use Micro motor
      if (normalizedConfig.motor === "Micro") {
        errors.push({ component: "motor", message: "Mountain board cannot use the Micro 5055 motor." });
      }
      break;
    case "Surf":
      // Surf cannot use top mount battery
      if (isTopMount) {
        errors.push({ component: "battery", message: "Surf skateboard cannot use a top-mounted battery." });
      }
      // Surf cannot use Double-Stack Brick battery
      if (normalizedConfig.battery === "DoubleStack") {
        errors.push({ component: "battery", message: "Surf skateboard cannot use the Double-Stack Brick battery." });
      }
      // Surf cannot use Pneumatic or Solid Rubber wheels
      if (normalizedConfig.wheels === "Pneumatic") {
        errors.push({ component: "wheels", message: "Surf skateboard cannot use Pneumatic wheels." });
      }
      if (normalizedConfig.wheels === "Rubber") {
        errors.push({ component: "wheels", message: "Surf skateboard cannot use Solid Rubber wheels." });
      }
      // Surf cannot use Belt drive
      if (normalizedConfig.drivetrain === "Belt") {
        errors.push({ component: "drivetrain", message: "Surf skateboard cannot use Belt drive." });
      }
      // Surf cannot use 4WD drivetrain
      if (normalizedConfig.drivetrain === "4WD") {
        errors.push({ component: "drivetrain", message: "Surf skateboard cannot use 4WD drivetrain." });
      }
      // Surf cannot use Torque 6374 or Outrunner 6396 motors
      if (normalizedConfig.motor === "Torque") {
        errors.push({ component: "motor", message: "Surf skateboard cannot use the Torque 6374 motor." });
      }
      if (normalizedConfig.motor === "Outrunner") {
        errors.push({ component: "motor", message: "Surf skateboard cannot use the Outrunner 6396 motor." });
      }
      break;
    case "AT":
      // Bamboo deck cannot use top mounted battery
      if (isTopMount) {
        errors.push({ component: "battery", message: "Bamboo deck cannot use a top-mounted battery." });
      }
      // AT cannot use 4WD drivetrain
      if (normalizedConfig.drivetrain === "4WD") {
        errors.push({ component: "drivetrain", message: "All-Terrain board cannot use 4WD drivetrain." });
      }
      // AT cannot use Micro motor
      if (normalizedConfig.motor === "Micro") {
        errors.push({ component: "motor", message: "All-Terrain board cannot use the Micro 5055 motor." });
      }
      break;
    // Slider — no restrictions
  }

  return errors;
}

/** Returns the set of allowed values for each component given the current board type. */
export function getAllowedComponents(boardType: BoardType): {
  drivetrains: Drivetrain[];
  motors: MotorType[];
  wheels: WheelType[];
  batteries: BatteryType[];
} {
  const allDrivetrains: Drivetrain[] = DRIVETRAIN_OPTIONS.map((o) => o.value);
  const allMotors: MotorType[]       = MOTOR_OPTIONS.map((o) => o.value);
  const allWheels: WheelType[]       = WHEEL_OPTIONS.map((o) => o.value);
  const allBatteries: BatteryType[]  = BATTERY_OPTIONS.map((o) => o.value);
  const nonTopMountBatteries         = BATTERY_OPTIONS.filter((o) => !o.isTopMounted).map((o) => o.value);
  const topMountBatteries            = BATTERY_OPTIONS.filter((o) => o.isTopMounted).map((o) => o.value);
  const no4WD                        = allDrivetrains.filter((d) => d !== "4WD");

  switch (boardType) {
    case "Street":
      return { drivetrains: no4WD, motors: allMotors, wheels: allWheels, batteries: nonTopMountBatteries };
    case "Mountain":
      return {
        drivetrains: ["4WD"],
        motors: allMotors.filter((m) => m !== "Micro"),
        wheels: ["Pneumatic", "Rubber"],
        batteries: topMountBatteries,
      };
    case "Surf":
      return {
        drivetrains: allDrivetrains.filter((d) => d !== "Belt" && d !== "4WD"),
        motors: allMotors.filter((m) => m !== "Torque" && m !== "Outrunner"),
        wheels: allWheels.filter((w) => w !== "Pneumatic" && w !== "Rubber"),
        batteries: nonTopMountBatteries.filter((b) => b !== "DoubleStack"),
      };
    case "AT":
      return {
        drivetrains: no4WD,
        motors: allMotors.filter((m) => m !== "Micro"),
        wheels: allWheels,
        batteries: nonTopMountBatteries,
      };
    case "Slider":
    default:
      return { drivetrains: allDrivetrains, motors: allMotors, wheels: allWheels, batteries: allBatteries };
  }
}

/**
 * Auto-corrects a board config to be compatible with the selected deck type.
 * When a component falls outside the allowed set, it snaps to the first allowed value.
 */
export function enforceCompatibility(config: BoardConfig): BoardConfig {
  const normalizedConfig = normalizeBoardConfig(config);
  const allowed = getAllowedComponents(normalizedConfig.boardType);
  return {
    boardType:  normalizedConfig.boardType,
    drivetrain: allowed.drivetrains.includes(normalizedConfig.drivetrain) ? normalizedConfig.drivetrain : allowed.drivetrains[0],
    motor:      allowed.motors.includes(normalizedConfig.motor)           ? normalizedConfig.motor      : allowed.motors[0],
    wheels:     allowed.wheels.includes(normalizedConfig.wheels)           ? normalizedConfig.wheels     : allowed.wheels[0],
    battery:    allowed.batteries.includes(normalizedConfig.battery)       ? normalizedConfig.battery    : allowed.batteries[0],
  };
}
