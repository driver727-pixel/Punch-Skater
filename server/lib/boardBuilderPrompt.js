/**
 * server/lib/boardBuilderPrompt.js
 *
 * Server-side JS mirror of src/lib/boardBuilderPrompt.ts.
 * Used by server/test/boardBuilderPrompt.test.js to lock in the drivetrain
 * prompt invariants, URL-assembly rules, and cache-version sanity without
 * requiring a TypeScript runtime in the test environment.
 *
 * IMPORTANT: If you change prompt strings in src/lib/boardBuilderPrompt.ts,
 * update the matching constants here so the server tests continue to catch
 * regressions in CI.
 */

import { createRequire } from 'module';
import { BOARD_IMAGE_REQUIRED_URL_COUNT } from './fal.js';

const require = createRequire(import.meta.url);

// Single source of truth: src/lib/boardImageVersion.json.
// Both this file and src/services/boardImageGen.ts import from there so
// bumping the version only requires editing the JSON.
const boardImageVersionJson = require('../../src/lib/boardImageVersion.json');

export { BOARD_IMAGE_REQUIRED_URL_COUNT };

export const BOARD_IMAGE_CACHE_VERSION = boardImageVersionJson.BOARD_IMAGE_CACHE_VERSION;

// Older saved cards used "AWD" before the UI and prompt stack standardized on
// "4WD"; keep normalizing it until legacy saved board configs disappear.
const LEGACY_FOUR_WHEEL_DRIVE = 'AWD';

function normalizeDrivetrain(drivetrain) {
  return drivetrain === LEGACY_FOUR_WHEEL_DRIVE ? '4WD' : drivetrain;
}

function normalizeCompatibleBoardConfig(config) {
  const normalizedConfig = {
    ...config,
    drivetrain: normalizeDrivetrain(config.drivetrain),
  };

  switch (normalizedConfig.boardType) {
    case 'Mountain':
      return {
        ...normalizedConfig,
        drivetrain: '4WD',
        motor: 'Outrunner',
        wheels: 'Rubber',
        battery: 'TopPeli',
      };
    case 'Street':
      return {
        ...normalizedConfig,
        battery: normalizedConfig.battery === 'TopPeli' ? 'SlimStealth' : normalizedConfig.battery,
        drivetrain: normalizedConfig.drivetrain === '4WD' ? 'Belt' : normalizedConfig.drivetrain,
      };
    case 'AT':
      return {
        ...normalizedConfig,
        battery: normalizedConfig.battery === 'TopPeli' ? 'SlimStealth' : normalizedConfig.battery,
        drivetrain: normalizedConfig.drivetrain === '4WD' ? 'Belt' : normalizedConfig.drivetrain,
        motor: normalizedConfig.motor === 'Micro' ? 'Standard' : normalizedConfig.motor,
      };
    case 'Surf':
      return {
        ...normalizedConfig,
        battery: normalizedConfig.battery === 'TopPeli' || normalizedConfig.battery === 'DoubleStack' ? 'SlimStealth' : normalizedConfig.battery,
        drivetrain: 'Hub',
        motor: normalizedConfig.motor === 'Torque' || normalizedConfig.motor === 'Outrunner' ? 'Micro' : normalizedConfig.motor,
        wheels: normalizedConfig.wheels === 'Pneumatic' || normalizedConfig.wheels === 'Rubber' ? 'Urethane' : normalizedConfig.wheels,
      };
    default:
      return normalizedConfig;
  }
}

// Exported so tests can assert its presence directly without re-typing the string.
export const CRITICAL_NOSE_CONSTRAINT =
  'CRITICAL: On non-4WD boards the nose truck must look identical to a plain ' +
  'unpowered truck — no motors, no belts, no pulleys, no gearboxes.';

export const CRITICAL_SINGLE_ASSEMBLY_CONSTRAINT =
  'CRITICAL: Render one coherent, fully assembled skateboard product only — ' +
  'not a collage of separate parts or reference cutouts. It has exactly TWO ' +
  'trucks only: one front truck mounted under the NOSE and one rear truck ' +
  'mounted under the TAIL. Each truck has exactly ONE axle carrying exactly ' +
  'TWO wheels, for exactly four wheels total. Never duplicate, split, stack, ' +
  'offset, or graft extra trucks, axles, wheel pods, motors, or drivetrain ' +
  'assemblies anywhere on the board.';

export const CRITICAL_SINGLE_DRIVETRAIN_CONSTRAINT =
  'CRITICAL: The skateboard uses exactly ONE drivetrain system only. Belt drive boards may show exposed belts, pulleys, rear motor mounts, and external rear motors, but NEVER hub-motor wheel casings. Hub drive boards may show integrated rear hub motors, but NEVER belts, pulleys, external motor mounts, or external motors. Gear drive boards may show enclosed rear gearboxes, but NEVER belts or hub-motor casings. Never hybridize, combine, or mix multiple drivetrain systems on the same board.';

export const MOUNTAINBOARD_LORE_CONSTRAINT =
  'Mountainboards and Mountain Boards always use a true 4WD gear-drive drivetrain: ' +
  'all four wheels are powered through enclosed gearboxes, with no belts, no hub ' +
  'motors, and no separate belt-drive or hub-drive hardware. They always have foot ' +
  'straps or boot bindings on top of the deck plus a large box-shaped top-mounted ' +
  "battery pack that leaves room for an adult rider's feet while preserving off-road " +
  'ground clearance. Mountainboards use solid rubber off-road wheels only — never ' +
  'vapor wheels, polyurethane wheels, or pneumatic wheels. Never omit the foot ' +
  'straps, boot bindings, top battery box, 4WD gear drives, or solid rubber wheels.';

const BOARD_IMAGE_BASE_CONCEPT =
  'An electric skateboard, high-detail product display in Gouache style painting on a neutral dark gray background. ' +
  'CRITICAL: The image must contain exactly ONE skateboard. Never show two or more skateboards in the same image under any circumstances. ' +
  `${CRITICAL_SINGLE_ASSEMBLY_CONSTRAINT} ` +
  'It has exactly four wheels mounted on front and rear trucks with fixed axles, the wheels aligned in matching pairs and pointing in the same direction as the deck. ' +
  'Never show caster-style pivoting wheels, sideways wheels, or wheels perpendicular to the board. ' +
  'The NOSE is the front tip of the board; the TAIL is the rear. ' +
  `${CRITICAL_SINGLE_DRIVETRAIN_CONSTRAINT} ` +
  'Unless the drivetrain is explicitly 4WD, ALL drive hardware — motors, motor mounts, belts, pulleys, gearboxes, hub-motor casings — belongs exclusively at the TAIL (rear truck). ' +
  'The NOSE truck must have NO motors, NO motor mounts, NO belts, NO pulleys, and NO gearboxes on any non-4WD board. ' +
  'Placing any drive hardware at the nose on a non-4WD board is a critical error that must never happen.';

const BOARD_TYPE_IMAGE_DESCRIPTIONS = {
  Street:
    'A Street style electric skateboard with a flat matte black carbon-fiber deck — no wood, no maple, no bamboo, no wood grain anywhere on the deck surface. ' +
    'The deck has NO kicktail at the nose or the rear; instead it has a subtle drop-down camber between the front and rear axles for better handling and a lower center of gravity.',
  AT:
    'An all-terrain electric skateboard with a rugged top-mount deck. ' +
    'The deck has NO kicktail at the nose or the rear; instead it has a subtle drop-down profile between the front and rear axles for improved handling.',
  Mountain:
    'A mountain-board style electric skateboard with an aggressive thick composite deck built for steep rough terrain, visible foot straps or boot bindings on top of the deck, a large box-shaped battery mounted on top of the deck, high ground clearance, and solid rubber off-road wheels. ' +
    'The deck is flat with mild concave for stability — it is NOT a drop-down deck and NOT a longboard cutout, and it has NO kicktail at the nose or the rear. ' +
    'It rides on wide channel-style mountainboard trucks where the four wheels extend out beyond the deck width on each side, giving the board a tall stance with plenty of clearance under the deck for off-road terrain.',
  Surf: 'A surf-skate inspired electric skateboard with a wide swallowtail cruiser deck, a prominent upward rear kicktail, and a flowing stance.',
  Slider: 'A slider style electric skateboard built around a low, compact deck for tight technical movement.',
};

// Exported so tests can inspect individual drivetrain description strings.
export const DRIVETRAIN_IMAGE_DESCRIPTIONS = {
  Belt:
    'It has belt driven rear wheels only, with exposed belts, pulleys, rear motor mounts, and one external electric motor mounted behind each rear wheel on the TAIL truck only. ' +
    'There are NO hub-motor casings inside any wheel — all motors are external. ' +
    'The NOSE truck has bare axles with no belts, no pulleys, and no motor mounts.',
  Hub:
    'It has hub driven rear wheels only, with the motors hidden inside the REAR wheel cores only. ' +
    'There are NO external belts, NO exposed pulleys, NO external motor mounts, and NO external motors anywhere on the board — this is NOT a belt drive. ' +
    'The NOSE wheels match the selected wheel type but remain plain unpowered wheels with no hub-motor casings and no internal motors.',
  Gear: 'It has gear driven rear wheels only, with sealed enclosed gearboxes on the TAIL truck only; the NOSE truck has no gearboxes and no drive hardware.',
  '4WD': 'It has powered front and rear trucks in a true four-wheel-drive gear-drive setup, with all four wheels driven through sealed enclosed gearboxes. There are NO belts, NO hub-motor wheel casings, and NO unpowered wheels.',
};

export const WHEEL_IMAGE_DESCRIPTIONS = {
  Urethane: 'It has 4 poly-urethane wheels, each 97 mm in diameter, the smallest wheel option and a scale anchor for the skateboard beside an adult rider.',
  Pneumatic:
    'It has 4 oversized pneumatic all-terrain tires, each 150 mm in diameter, with thick air-filled rubber construction, chunky knobby tread, and tall visible sidewalls. ' +
    'These tires are clearly inflated rubber — NOT polyurethane and NOT hard plastic. The taller stance is clearly visible compared to polyurethane wheels.',
  Rubber: 'It has 4 solid rubber all-terrain wheels, each 175 mm in diameter, with thick puncture-proof sidewalls and deep off-road tread; these are not air-filled pneumatic tires, not polyurethane wheels, and not vapor wheels. These are the largest wheel option and make the board visibly taller beside an adult rider.',
  Cloud: 'It has 4 oversized vapor wheels, each 107 mm in diameter, with a soft semi-transparent cushioned look; they are slightly larger than 97 mm polyurethane wheels but much smaller than 150 mm pneumatic tires.',
};

const BATTERY_IMAGE_DESCRIPTIONS = {
  SlimStealth: '',
  DoubleStack: 'It has a thick double-stack battery enclosure mounted underneath the deck.',
  TopPeli: 'It has a rugged top-mounted Peli-style battery case strapped above the deck.',
};

function getMotorImageDescription(config) {
  const motorCount = config.drivetrain === '4WD' ? 4 : 2;

  if (config.drivetrain === 'Hub') {
    switch (config.motor) {
      case 'Micro': return `The ${motorCount} hub motors are compact micro-sized drive units integrated into the rear wheels.`;
      case 'Standard': return `The ${motorCount} hub motors are medium-sized integrated drive units built for a balanced commuter setup.`;
      case 'Torque': return `The ${motorCount} hub motors are large high-torque integrated drive units.`;
      case 'Outrunner': return `The ${motorCount} hub motors are oversized high-output integrated drive units.`;
      default: return `The ${motorCount} hub motors are sized to match the selected performance setup.`;
    }
  }

  switch (config.motor) {
    case 'Micro': return `It has ${motorCount} small barrel shaped electric motors.`;
    case 'Standard': return `It has ${motorCount} medium-sized electric motors for a balanced commuter setup.`;
    case 'Torque': return `It has ${motorCount} large high-torque electric motors.`;
    case 'Outrunner': return `It has ${motorCount} oversized race-grade outrunner electric motors.`;
    default: return `It has ${motorCount} electric motors sized to match the selected performance setup.`;
  }
}

function getMountainboardLoreDescription(config) {
  return config.boardType === 'Mountain'
    ? MOUNTAINBOARD_LORE_CONSTRAINT
    : '';
}

function getWheelDrivetrainCompatibilityDescription(config) {
  const selectedWheelType = config.wheels.toLowerCase();

  switch (config.drivetrain) {
    case 'Belt':
      return `The selected ${selectedWheelType} wheels belong to a belt-drive board, so the rear drive comes only from exposed belts and external rear motors and never from hub-motor wheel casings.`;
    case 'Hub':
      return `The selected ${selectedWheelType} wheels belong to a hub-drive board, so only the REAR pair contains integrated hub motors while the FRONT pair stays unpowered, and there are no belts, pulleys, or external motors anywhere.`;
    case 'Gear':
      return `The selected ${selectedWheelType} wheels belong to a gear-drive board, so the rear drive comes only from enclosed rear gearboxes and never from belts or hub-motor wheel casings.`;
    case '4WD':
      return `The selected ${selectedWheelType} wheels belong to a true 4WD gear-drive board, so all four wheels participate in the single enclosed gearbox drivetrain without adding any belts, hub motors, or separate hub-drive-only hardware package.`;
    default:
      return '';
  }
}

/**
 * Builds the image-generation prompt for the given BoardConfig.
 * Mirrors src/lib/boardBuilderPrompt.ts#buildBoardImagePrompt.
 *
 * @param {{ boardType: string, drivetrain: string, motor: string, wheels: string, battery: string }} config
 * @returns {string}
 */
export function buildBoardImagePrompt(config) {
  const normalizedConfig = normalizeCompatibleBoardConfig(config);
  const battery = normalizedConfig.battery ?? 'SlimStealth';
  const batteryPreservationClause =
    battery === 'SlimStealth' ? '' : ' and battery form factor';
  const noseConstraint = normalizedConfig.drivetrain === '4WD'
    ? ''
    : `${CRITICAL_NOSE_CONSTRAINT} `;

  return (
    `${BOARD_IMAGE_BASE_CONCEPT} ` +
    `${BOARD_TYPE_IMAGE_DESCRIPTIONS[normalizedConfig.boardType] ?? ''} ` +
    `${DRIVETRAIN_IMAGE_DESCRIPTIONS[normalizedConfig.drivetrain] ?? ''} ` +
    `${getMotorImageDescription(normalizedConfig)} ` +
    `${WHEEL_IMAGE_DESCRIPTIONS[normalizedConfig.wheels] ?? ''} ` +
    `${getWheelDrivetrainCompatibilityDescription(normalizedConfig)} ` +
    `${BATTERY_IMAGE_DESCRIPTIONS[battery] ?? ''} ` +
    `${getMountainboardLoreDescription(normalizedConfig)} ` +
    `Show one fully assembled complete skateboard only. ` +
    `The final board must clearly preserve the selected deck shape, drivetrain hardware, motor size, wheel type and wheel diameter${batteryPreservationClause} with no substitutions. ` +
    `For Belt, Hub, and Gear builds, keep all drive hardware on the rear truck and rear wheels only; do not add any front drive hardware unless the selected drivetrain is 4WD. ` +
    `${noseConstraint}` +
    `Three-quarter product display view, centered composition, crisp painted detail, clearly illustrated gouache texture, not photoreal, no rider, no extra parts, no exploded view, exactly one skateboard in the image. ` +
    `CRITICAL: Absolutely no text, words, letters, numbers, labels, captions, annotations, callout lines, dimension lines, part names, diagrams, watermarks, or any written characters anywhere in the image or on the skateboard itself.`
  );
}

/**
 * Returns the ordered list of board-component categories that the client's
 * getResolvedBoardReferenceUrls() would select for the given config.
 *
 * Always returns exactly BOARD_IMAGE_REQUIRED_URL_COUNT entries.
 * Mirrors the SlimStealth branch in src/services/boardImageGen.ts.
 *
 * @param {{ battery: string, [key: string]: string }} config
 * @returns {string[]}
 */
export function resolveReferenceUrlCategories(config) {
  return [
    'deck',
    'drivetrain',
    'wheels',
    'battery',
    'motor',
  ];
}
