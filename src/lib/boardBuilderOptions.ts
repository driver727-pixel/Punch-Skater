import type {
  BatteryOption,
  BoardConfig,
  BoardOption,
  BoardType,
  Drivetrain,
  MotorOption,
  WheelType,
} from "./boardBuilderTypes";

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
];

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

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  boardType: "Street",
  drivetrain: "Belt",
  motor: "Standard",
  wheels: "Urethane",
  battery: "SlimStealth",
};
