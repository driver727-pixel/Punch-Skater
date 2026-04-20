import { normalizeBoardConfig } from "./boardBuilderCompatibility";
import type { BatteryType, BoardConfig, BoardType, Drivetrain, WheelType } from "./boardBuilderTypes";

const BOARD_IMAGE_BASE_CONCEPT =
  "An electric skateboard, high-detail product display in Gouache style painting on a neutral dark gray background. " +
  "It has exactly four wheels mounted on front and rear trucks with fixed axles, the wheels aligned in matching pairs and pointing in the same direction as the deck. " +
  "Never show caster-style pivoting wheels, sideways wheels, or wheels perpendicular to the board.";

const BOARD_TYPE_IMAGE_DESCRIPTIONS: Record<BoardType, string> = {
  Street: "A Street style electric skateboard with a low-profile urban deck built for pavement.",
  AT: "An all-terrain electric skateboard with a rugged top-mount deck and extra ground clearance.",
  Mountain: "A mountain-board style electric skateboard with an aggressive deck built for steep rough terrain.",
  Surf: "A surf-skate inspired electric skateboard with a wide swallowtail cruiser deck and flowing stance.",
  Slider: "A slider style electric skateboard built around a low, compact deck for tight technical movement.",
};

const DRIVETRAIN_IMAGE_DESCRIPTIONS: Record<Drivetrain, string> = {
  Belt: "It has belt driven rear wheels with exposed belts, pulleys, and rear motor mounts.",
  Hub: "It has hub driven rear wheels with the motors hidden inside the rear wheel cores and no exposed belts.",
  Gear: "It has gear driven rear wheels with sealed enclosed gearboxes instead of belts.",
  "4WD": "It has powered front and rear trucks in a true four-wheel-drive setup.",
};

const WHEEL_IMAGE_DESCRIPTIONS: Record<WheelType, string> = {
  Urethane: "It has 4 poly-urethane wheels.",
  Pneumatic: "It has 4 large pneumatic all-terrain tires with visible tread.",
  Rubber: "It has 4 solid rubber all-terrain wheels with thick puncture-proof sidewalls.",
  Cloud: "It has 4 oversized cloud wheels with a soft semi-transparent cushioned look.",
};

const BATTERY_IMAGE_DESCRIPTIONS: Record<BatteryType, string> = {
  SlimStealth: "It has a hidden built in battery pack mounted underneath the deck.",
  DoubleStack: "It has a thick double-stack battery enclosure mounted underneath the deck.",
  TopPeli: "It has a rugged top-mounted Peli-style battery case strapped above the deck.",
};

function getMotorImageDescription(config: BoardConfig): string {
  const motorCount = config.drivetrain === "4WD" ? 4 : 2;

  if (config.drivetrain === "Hub") {
    switch (config.motor) {
      case "Micro":
        return `The ${motorCount} hub motors are compact micro-sized drive units integrated into the rear wheels.`;
      case "Standard":
        return `The ${motorCount} hub motors are medium-sized integrated drive units built for a balanced commuter setup.`;
      case "Torque":
        return `The ${motorCount} hub motors are large high-torque integrated drive units.`;
      case "Outrunner":
        return `The ${motorCount} hub motors are oversized high-output integrated drive units.`;
      default:
        return `The ${motorCount} hub motors are sized to match the selected performance setup.`;
    }
  }

  switch (config.motor) {
    case "Micro":
      return `It has ${motorCount} small barrel shaped electric motors.`;
    case "Standard":
      return `It has ${motorCount} medium-sized electric motors for a balanced commuter setup.`;
    case "Torque":
      return `It has ${motorCount} large high-torque electric motors.`;
    case "Outrunner":
      return `It has ${motorCount} oversized race-grade outrunner electric motors.`;
    default:
      return `It has ${motorCount} electric motors sized to match the selected performance setup.`;
  }
}

export function buildBoardImagePrompt(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);

  return (
    `${BOARD_IMAGE_BASE_CONCEPT} ` +
    `${BOARD_TYPE_IMAGE_DESCRIPTIONS[normalizedConfig.boardType]} ` +
    `${DRIVETRAIN_IMAGE_DESCRIPTIONS[normalizedConfig.drivetrain]} ` +
    `${getMotorImageDescription(normalizedConfig)} ` +
    `${WHEEL_IMAGE_DESCRIPTIONS[normalizedConfig.wheels]} ` +
    `${BATTERY_IMAGE_DESCRIPTIONS[normalizedConfig.battery]} ` +
    `Show one fully assembled complete skateboard only. ` +
    `The final board must clearly preserve the selected deck shape, drivetrain hardware, motor size, wheel type, and battery form factor with no substitutions. ` +
    `Three-quarter product display view, centered composition, crisp painted detail, clearly illustrated gouache texture, not photoreal, no rider, no extra parts, no exploded view, no text, no watermark.`
  );
}
