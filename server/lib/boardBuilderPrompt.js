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

// Exported so tests can assert its presence directly without re-typing the string.
export const CRITICAL_NOSE_CONSTRAINT =
  'CRITICAL: On non-4WD boards the nose truck must look identical to a plain ' +
  'unpowered truck — no motors, no belts, no pulleys, no gearboxes.';

const BOARD_IMAGE_BASE_CONCEPT =
  'An electric skateboard, high-detail product display in Gouache style painting on a neutral dark gray background. ' +
  'CRITICAL: The image must contain exactly ONE skateboard. Never show two or more skateboards in the same image under any circumstances. ' +
  'It has exactly four wheels mounted on front and rear trucks with fixed axles, the wheels aligned in matching pairs and pointing in the same direction as the deck. ' +
  'Never show caster-style pivoting wheels, sideways wheels, or wheels perpendicular to the board. ' +
  'The NOSE is the front tip of the board; the TAIL is the rear. ' +
  'Unless the drivetrain is explicitly 4WD, ALL drive hardware — motors, motor mounts, belts, pulleys, gearboxes, hub-motor casings — belongs exclusively at the TAIL (rear truck). ' +
  'The NOSE truck must have NO motors, NO motor mounts, NO belts, NO pulleys, and NO gearboxes on any non-4WD board. ' +
  'Placing any drive hardware at the nose on a non-4WD board is a critical error that must never happen.';

const BOARD_TYPE_IMAGE_DESCRIPTIONS = {
  Street: 'A Street style electric skateboard with a low-profile urban deck built for pavement.',
  AT: 'An all-terrain electric skateboard with a rugged top-mount deck and extra ground clearance.',
  Mountain: 'A mountain-board style electric skateboard with an aggressive deck built for steep rough terrain.',
  Surf: 'A surf-skate inspired electric skateboard with a wide swallowtail cruiser deck and flowing stance.',
  Slider: 'A slider style electric skateboard built around a low, compact deck for tight technical movement.',
};

// Exported so tests can inspect individual drivetrain description strings.
export const DRIVETRAIN_IMAGE_DESCRIPTIONS = {
  Belt: 'It has belt driven rear wheels only, with exposed belts, pulleys, and rear motor mounts on the TAIL truck only; the NOSE truck has bare axles with no belts, no pulleys, and no motor mounts.',
  Hub: 'It has hub driven rear wheels only, with the motors hidden inside the REAR wheel cores only; the NOSE wheels are plain unpowered urethane with no hub-motor casings and no internal motors.',
  Gear: 'It has gear driven rear wheels only, with sealed enclosed gearboxes on the TAIL truck only; the NOSE truck has no gearboxes and no drive hardware.',
  '4WD': 'It has powered front and rear trucks in a true four-wheel-drive setup with all four wheels driven.',
};

const WHEEL_IMAGE_DESCRIPTIONS = {
  Urethane: 'It has 4 poly-urethane wheels.',
  Pneumatic: 'It has 4 large pneumatic all-terrain tires with visible tread.',
  Rubber: 'It has 4 solid rubber all-terrain wheels with thick puncture-proof sidewalls.',
  Cloud: 'It has 4 oversized vapor wheels with a soft semi-transparent cushioned look.',
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

/**
 * Builds the image-generation prompt for the given BoardConfig.
 * Mirrors src/lib/boardBuilderPrompt.ts#buildBoardImagePrompt.
 *
 * @param {{ boardType: string, drivetrain: string, motor: string, wheels: string, battery: string }} config
 * @returns {string}
 */
export function buildBoardImagePrompt(config) {
  const battery = config.battery ?? 'SlimStealth';
  const batteryPreservationClause =
    battery === 'SlimStealth' ? '' : ' and battery form factor';

  return (
    `${BOARD_IMAGE_BASE_CONCEPT} ` +
    `${BOARD_TYPE_IMAGE_DESCRIPTIONS[config.boardType] ?? ''} ` +
    `${DRIVETRAIN_IMAGE_DESCRIPTIONS[config.drivetrain] ?? ''} ` +
    `${getMotorImageDescription(config)} ` +
    `${WHEEL_IMAGE_DESCRIPTIONS[config.wheels] ?? ''} ` +
    `${BATTERY_IMAGE_DESCRIPTIONS[battery] ?? ''} ` +
    `Show one fully assembled complete skateboard only. ` +
    `The final board must clearly preserve the selected deck shape, drivetrain hardware, motor size, wheel type${batteryPreservationClause} with no substitutions. ` +
    `For Belt, Hub, and Gear builds, keep all drive hardware on the rear truck and rear wheels only; do not add any front drive hardware unless the selected drivetrain is 4WD. ` +
    `${CRITICAL_NOSE_CONSTRAINT} ` +
    `Three-quarter product display view, centered composition, crisp painted detail, clearly illustrated gouache texture, not photoreal, no rider, no extra parts, no exploded view, no text, no watermark, exactly one skateboard in the image.`
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
  const battery = config.battery ?? 'SlimStealth';
  const categories = ['deck', 'drivetrain', 'wheels'];
  // SlimStealth is an integrated battery that is not visually prominent;
  // use the motor image as the fourth reference to keep the required count.
  categories.push(battery === 'SlimStealth' ? 'motor' : 'battery');
  return categories;
}
