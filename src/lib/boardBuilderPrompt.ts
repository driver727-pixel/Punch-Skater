import { enforceCompatibility, normalizeBoardConfig } from "./boardBuilderCompatibility";
import type { BatteryType, BoardConfig, BoardType, Drivetrain, WheelType } from "./boardBuilderTypes";

export const CRITICAL_SINGLE_ASSEMBLY_CONSTRAINT =
  "CRITICAL: Render one coherent, fully assembled skateboard product only — not a collage of separate parts or reference cutouts. It has exactly TWO trucks only: one front truck mounted under the NOSE and one rear truck mounted under the TAIL. Each truck has exactly ONE axle carrying exactly TWO wheels, for exactly four wheels total. Never duplicate, split, stack, offset, or graft extra trucks, axles, wheel pods, motors, or drivetrain assemblies anywhere on the board.";

export const CRITICAL_SINGLE_DRIVETRAIN_CONSTRAINT =
  "CRITICAL: The skateboard uses exactly ONE drivetrain system only. Belt drive boards may show exposed belts, pulleys, rear motor mounts, and external rear motors, but NEVER hub-motor wheel casings. Hub drive boards may show integrated rear hub motors, but NEVER belts, pulleys, external motor mounts, or external motors. Gear drive boards may show enclosed rear gearboxes, but NEVER belts or hub-motor casings. Never hybridize, combine, or mix multiple drivetrain systems on the same board.";

export const MOUNTAINBOARD_LORE_CONSTRAINT =
  "Mountainboards and Mountain Boards always use a true 4WD gear-drive drivetrain: all four wheels are powered through enclosed gearboxes, with no belts, no hub motors, and no separate belt-drive or hub-drive hardware. They always have foot straps or boot bindings on top of the deck plus a large box-shaped top-mounted battery pack that leaves room for an adult rider's feet while preserving off-road ground clearance. Mountainboards use solid rubber off-road wheels only — never vapor wheels, polyurethane wheels, or pneumatic wheels. They never use longboard geometry, drop-through layouts, or standard street-skate trucks; they use channel-style mountainboard trucks with visible channel arms and a tall off-road stance. Never omit the foot straps, boot bindings, top battery box, 4WD gear drives, channel-style mountainboard trucks, or solid rubber wheels.";

export const MOUNTAINBOARD_LOCK_CONSTRAINT =
  "CRITICAL for Mountain boards: preserve true mountainboard geometry and hardware — channel-style mountainboard trucks with visible channel arms, foot straps or boot bindings on top of the deck, a large box-shaped top-mounted battery, true 4WD enclosed gear-drive hardware on all four wheels, and solid rubber off-road wheels. If any instruction conflicts, keep these mountainboard features unchanged.";

const BOARD_IMAGE_BASE_CONCEPT =
  "An electric skateboard, high-detail product display in Gouache style painting on a neutral dark gray background. " +
  "CRITICAL: The image must contain exactly ONE skateboard. Never show two or more skateboards in the same image under any circumstances. " +
  `${CRITICAL_SINGLE_ASSEMBLY_CONSTRAINT} ` +
  "It has exactly four wheels mounted on front and rear trucks with fixed axles, the wheels aligned in matching pairs and pointing in the same direction as the deck. " +
  "Never show caster-style pivoting wheels, sideways wheels, or wheels perpendicular to the board. " +
  "The NOSE is the front tip of the board; the TAIL is the rear. " +
  `${CRITICAL_SINGLE_DRIVETRAIN_CONSTRAINT} ` +
  "Unless the drivetrain is explicitly 4WD, ALL drive hardware — motors, motor mounts, belts, pulleys, gearboxes, hub-motor casings — belongs exclusively at the TAIL (rear truck). " +
  "The NOSE truck must have NO motors, NO motor mounts, NO belts, NO pulleys, and NO gearboxes on any non-4WD board. " +
  "Placing any drive hardware at the nose on a non-4WD board is a critical error that must never happen.";

const BOARD_TYPE_IMAGE_DESCRIPTIONS: Record<BoardType, string> = {
  Street:
    "A Street style electric skateboard with a flat matte black carbon-fiber deck — no wood, no maple, no bamboo, no wood grain anywhere on the deck surface. " +
    "The deck has NO kicktail at the nose or the rear; instead it has a subtle drop-down camber between the front and rear axles for better handling and a lower center of gravity.",
  AT:
    "An all-terrain electric skateboard with a rugged top-mount deck. " +
    "The deck has NO kicktail at the nose or the rear; instead it has a subtle drop-down profile between the front and rear axles for improved handling.",
  Mountain:
    "A mountain-board style electric skateboard with an aggressive thick composite deck built for steep rough terrain, visible foot straps or boot bindings on top of the deck, a large box-shaped battery mounted on top of the deck, high ground clearance, and solid rubber off-road wheels. " +
    "The deck is flat with mild concave for stability — it is NOT a drop-down deck and NOT a longboard cutout, and it has NO kicktail at the nose or the rear. " +
    "It rides on wide channel-style mountainboard trucks where the four wheels extend out beyond the deck width on each side, giving the board a tall stance with plenty of clearance under the deck for off-road terrain. " +
    "CRITICAL for Mountain boards: never render standard longboard/skateboard trucks, never render a sleek commuter longboard silhouette, and never hide or remove the foot straps/boot bindings.",
  Surf: "A surf-skate inspired electric skateboard with a wide swallowtail cruiser deck, a prominent upward rear kicktail, and a flowing stance.",
  Slider: "A slider style electric skateboard built around a low, compact deck for tight technical movement.",
};

const DRIVETRAIN_IMAGE_DESCRIPTIONS: Record<Drivetrain, string> = {
  Belt:
    "It has belt driven rear wheels only, with exposed belts, pulleys, rear motor mounts, and one external electric motor mounted behind each rear wheel on the TAIL truck only. " +
    "There are NO hub-motor casings inside any wheel — all motors are external. " +
    "The NOSE truck has bare axles with no belts, no pulleys, and no motor mounts.",
  Hub:
    "It has hub driven rear wheels only, with the motors hidden inside the REAR wheel cores only. " +
    "There are NO external belts, NO exposed pulleys, NO external motor mounts, and NO external motors anywhere on the board — this is NOT a belt drive. " +
    "The NOSE wheels match the selected wheel type but remain plain unpowered wheels with no hub-motor casings and no internal motors.",
  Gear: "It has gear driven rear wheels only, with sealed enclosed gearboxes on the TAIL truck only; the NOSE truck has no gearboxes and no drive hardware.",
  "4WD": "It has powered front and rear trucks in a true four-wheel-drive gear-drive setup, with all four wheels driven through sealed enclosed gearboxes. There are NO belts, NO hub-motor wheel casings, and NO unpowered wheels.",
};

const WHEEL_IMAGE_DESCRIPTIONS: Record<WheelType, string> = {
  Urethane: "It has 4 poly-urethane wheels, each 97 mm in diameter, the smallest wheel option and a scale anchor for the skateboard beside an adult rider.",
  Pneumatic:
    "It has 4 oversized pneumatic all-terrain tires, each 150 mm in diameter, with thick air-filled rubber construction, chunky knobby tread, and tall visible sidewalls. " +
    "These tires are clearly inflated rubber — NOT polyurethane and NOT hard plastic. The taller stance is clearly visible compared to polyurethane wheels.",
  Rubber: "It has 4 solid rubber all-terrain wheels, each 175 mm in diameter, with thick puncture-proof sidewalls and deep off-road tread; these are not air-filled pneumatic tires, not polyurethane wheels, and not vapor wheels. These are the largest wheel option and make the board visibly taller beside an adult rider.",
  Cloud: "It has 4 oversized vapor wheels, each 107 mm in diameter, with a soft semi-transparent cushioned look; they are slightly larger than 97 mm polyurethane wheels but much smaller than 150 mm pneumatic tires.",
};

const BATTERY_IMAGE_DESCRIPTIONS: Record<BatteryType, string> = {
  SlimStealth: "",
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

function getMountainboardLoreDescription(config: BoardConfig): string {
  return config.boardType === "Mountain"
    ? `${MOUNTAINBOARD_LORE_CONSTRAINT} ${MOUNTAINBOARD_LOCK_CONSTRAINT}`
    : "";
}

function getWheelDrivetrainCompatibilityDescription(config: BoardConfig): string {
  const selectedWheelType = config.wheels.toLowerCase();

  switch (config.drivetrain) {
    case "Belt":
      return `The selected ${selectedWheelType} wheels belong to a belt-drive board, so the rear drive comes only from exposed belts and external rear motors and never from hub-motor wheel casings.`;
    case "Hub":
      return `The selected ${selectedWheelType} wheels belong to a hub-drive board, so only the REAR pair contains integrated hub motors while the FRONT pair stays unpowered, and there are no belts, pulleys, or external motors anywhere.`;
    case "Gear":
      return `The selected ${selectedWheelType} wheels belong to a gear-drive board, so the rear drive comes only from enclosed rear gearboxes and never from belts or hub-motor wheel casings.`;
    case "4WD":
      return `The selected ${selectedWheelType} wheels belong to a true 4WD gear-drive board, so all four wheels participate in the single enclosed gearbox drivetrain without adding any belts, hub motors, or separate hub-drive-only hardware package.`;
    default:
      return "";
  }
}

export function buildBoardImagePrompt(config: BoardConfig): string {
  const normalizedConfig = enforceCompatibility(normalizeBoardConfig(config));
  const batteryPreservationClause =
    normalizedConfig.battery === "SlimStealth"
      ? ""
      : " and battery form factor";
  const noseConstraint = normalizedConfig.drivetrain === "4WD"
    ? ""
    : "CRITICAL: On non-4WD boards the nose truck must look identical to a plain unpowered truck — no motors, no belts, no pulleys, no gearboxes. ";

  return (
    `${BOARD_IMAGE_BASE_CONCEPT} ` +
    `${BOARD_TYPE_IMAGE_DESCRIPTIONS[normalizedConfig.boardType]} ` +
    `${DRIVETRAIN_IMAGE_DESCRIPTIONS[normalizedConfig.drivetrain]} ` +
    `${getMotorImageDescription(normalizedConfig)} ` +
    `${WHEEL_IMAGE_DESCRIPTIONS[normalizedConfig.wheels]} ` +
    `${getWheelDrivetrainCompatibilityDescription(normalizedConfig)} ` +
    `${BATTERY_IMAGE_DESCRIPTIONS[normalizedConfig.battery]} ` +
    `${getMountainboardLoreDescription(normalizedConfig)} ` +
    `Show one fully assembled complete skateboard only. ` +
    `The final board must clearly preserve the selected deck shape, drivetrain hardware, motor size, wheel type and wheel diameter${batteryPreservationClause} with no substitutions. ` +
    `${noseConstraint}` +
    `Three-quarter product display view, centered composition, crisp painted detail, clearly illustrated gouache texture, not photoreal, no rider, no extra parts, no exploded view, exactly one skateboard in the image. ` +
    `CRITICAL: Absolutely no text, words, letters, numbers, labels, captions, annotations, callout lines, dimension lines, part names, diagrams, watermarks, or any written characters anywhere in the image or on the skateboard itself.`
  );
}
