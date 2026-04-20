import { withBoardComponentAssetVersion } from "./boardAssetVersion";
import { BATTERY_OPTIONS } from "./boardBuilderOptions";
import type {
  BatteryType,
  BoardComponentImageUrls,
  BoardComponentModel,
  BoardConfig,
  BoardType,
  Drivetrain,
  MotorType,
  WheelType,
} from "./boardBuilderTypes";
import { normalizeBoardConfig } from "./boardBuilderCompatibility";

export const BOARD_COMPONENT_CATALOG: BoardComponentModel[] = [
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
  {
    category: "Truck",
    name: "Front Truck",
    description:
      "Isometric view 45 degree angle top down. Product photography shot. Art style of gouache painting. A standalone electric skateboard front truck: anodized aluminum hanger and baseplate, precision kingpin and bushings, no motors or belts, clean machined finish, isolated on white background.",
    seedKey: "front-truck",
    icon: "🔧",
  },
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

export const BOARD_TYPE_DECK_SEED: Record<BoardType, string | null> = {
  Street: "deck-carbon-street-drop-through",
  AT: "deck-bamboo-at-top-mount",
  Mountain: "deck-off-grid-mountain-board",
  Surf: "deck-swallowtail-surf-skate",
  Slider: null,
};

export const DRIVETRAIN_SEED: Record<Drivetrain, string | null> = {
  Belt: "drivetrain-dual-belt-drive",
  Hub: "drivetrain-stealth-hub-motors",
  Gear: "drivetrain-sealed-gear-drive",
  "4WD": null,
};

export const MOTOR_SEED: Record<MotorType, string | null> = {
  Micro: "motor-micro-5055",
  Standard: "motor-standard-6354",
  Torque: "motor-torque-6374",
  Outrunner: "motor-outrunner-6396",
};

export const WHEEL_SEED: Record<WheelType, string | null> = {
  Urethane: "wheel-100mm-urethane-street",
  Pneumatic: "wheel-175mm-pneumatic-at",
  Rubber: null,
  Cloud: "wheel-120mm-cloud-sliders",
};

export const BATTERY_SEED: Record<BatteryType, string | null> = {
  SlimStealth: "battery-slim-stealth-pack",
  DoubleStack: "battery-double-stack-brick",
  TopPeli: "battery-top-mounted-peli-case",
};

export function getBoardAssetUrls(config: BoardConfig): {
  deckUrl: string | null;
  drivetrainUrl: string | null;
  motorUrl: string | null;
  wheelsUrl: string | null;
  batteryUrl: string | null;
  batteryIsTopMounted: boolean;
} {
  const normalizedConfig = normalizeBoardConfig(config);
  const deckSeed = BOARD_TYPE_DECK_SEED[normalizedConfig.boardType];
  const driveSeed = DRIVETRAIN_SEED[normalizedConfig.drivetrain];
  const motorSeed = MOTOR_SEED[normalizedConfig.motor];
  const wheelSeed = WHEEL_SEED[normalizedConfig.wheels];
  const batterySeed = BATTERY_SEED[normalizedConfig.battery];
  const batteryOpt = BATTERY_OPTIONS.find((option) => option.value === normalizedConfig.battery);

  return {
    deckUrl: deckSeed ? `/assets/boards/${deckSeed}.webp` : null,
    drivetrainUrl: driveSeed ? `/assets/boards/${driveSeed}.webp` : null,
    motorUrl: motorSeed ? `/assets/boards/${motorSeed}.webp` : null,
    wheelsUrl: wheelSeed ? `/assets/boards/${wheelSeed}.webp` : null,
    batteryUrl: batterySeed ? `/assets/boards/${batterySeed}.webp` : null,
    batteryIsTopMounted: batteryOpt?.isTopMounted ?? false,
  };
}

export function getBoardComponentImageUrls(config: BoardConfig): BoardComponentImageUrls {
  const normalizedConfig = normalizeBoardConfig(config);
  return {
    deckUrl: withBoardComponentAssetVersion(`/assets/boards/deck/${normalizedConfig.boardType}.webp`),
    drivetrainUrl: withBoardComponentAssetVersion(`/assets/boards/drivetrain/${normalizedConfig.drivetrain}.webp`),
    motorUrl: withBoardComponentAssetVersion(`/assets/boards/motor/${normalizedConfig.motor}.webp`),
    wheelsUrl: withBoardComponentAssetVersion(`/assets/boards/wheels/${normalizedConfig.wheels}.webp`),
    batteryUrl: withBoardComponentAssetVersion(`/assets/boards/battery/${normalizedConfig.battery}.webp`),
  };
}
