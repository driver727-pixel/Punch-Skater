/**
 * server/test/boardBuilderPrompt.test.js
 *
 * Locks in the invariants that caused recurring board image regressions:
 *
 *   A. Drivetrain prompt invariants — buildBoardImagePrompt
 *   B. Reference-URL count contract — resolveReferenceUrlCategories + normalizeBoardReferenceUrls
 *   C. Cache-version sanity — BOARD_IMAGE_CACHE_VERSION is a non-empty string
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_IMAGE_REQUIRED_URL_COUNT,
  BOARD_IMAGE_CACHE_VERSION,
  CRITICAL_NOSE_CONSTRAINT,
  CRITICAL_SINGLE_ASSEMBLY_CONSTRAINT,
  DRIVETRAIN_IMAGE_DESCRIPTIONS,
  MOUNTAINBOARD_LORE_CONSTRAINT,
  WHEEL_IMAGE_DESCRIPTIONS,
  buildBoardImagePrompt,
  resolveReferenceUrlCategories,
} from '../lib/boardBuilderPrompt.js';

import { normalizeBoardReferenceUrls } from '../lib/fal.js';

// ─────────────────────────────────────────────────────────────────────────────
// A. Drivetrain prompt invariants
// ─────────────────────────────────────────────────────────────────────────────

// A minimal valid config used as the base for drivetrain-specific tests.
const BASE_CONFIG = {
  boardType: 'Street',
  motor: 'Standard',
  wheels: 'Urethane',
  battery: 'SlimStealth',
};

const ALL_DRIVETRAINS = ['Belt', 'Hub', 'Gear', '4WD'];

for (const drivetrain of ALL_DRIVETRAINS) {
  test(`buildBoardImagePrompt [${drivetrain}] — contains single-assembly anti-mutation constraint`, () => {
    const prompt = buildBoardImagePrompt({
      ...BASE_CONFIG,
      drivetrain,
      ...(drivetrain === '4WD'
        ? { boardType: 'Mountain', motor: 'Outrunner', wheels: 'Pneumatic', battery: 'TopPeli' }
        : {}),
    });

    assert.ok(
      prompt.includes(CRITICAL_SINGLE_ASSEMBLY_CONSTRAINT),
      `Prompt for [${drivetrain}] must contain the single-assembly anti-mutation constraint`,
    );
  });
}

// Non-4WD drivetrains must all satisfy the same three invariants.
const NON_4WD_DRIVETRAINS = ['Belt', 'Hub', 'Gear'];

for (const drivetrain of NON_4WD_DRIVETRAINS) {
  test(`buildBoardImagePrompt [${drivetrain}] — drive hardware described on tail/rear only`, () => {
    const prompt = buildBoardImagePrompt({ ...BASE_CONFIG, drivetrain });

    // Drivetrain description must name TAIL or REAR as the drive location.
    const desc = DRIVETRAIN_IMAGE_DESCRIPTIONS[drivetrain];
    assert.ok(
      /TAIL|REAR/i.test(desc),
      `Expected TAIL or REAR in [${drivetrain}] description: "${desc}"`,
    );
    assert.ok(
      prompt.includes(desc),
      `Prompt for [${drivetrain}] must include the drivetrain description`,
    );
  });

  test(`buildBoardImagePrompt [${drivetrain}] — nose/front truck explicitly bare or unpowered`, () => {
    const desc = DRIVETRAIN_IMAGE_DESCRIPTIONS[drivetrain];

    // Each non-4WD description must explicitly mention the bare/unpowered nose.
    assert.ok(
      /NOSE/i.test(desc),
      `Expected NOSE in [${drivetrain}] description: "${desc}"`,
    );
    // Belt: "bare axles", Hub: "plain unpowered urethane", Gear: "no drive hardware"
    assert.ok(
      /bare|unpowered|no drive hardware/i.test(desc),
      `Expected bare/unpowered nose language in [${drivetrain}] description: "${desc}"`,
    );
  });

  test(`buildBoardImagePrompt [${drivetrain}] — contains CRITICAL nose constraint (commit 4bae28a)`, () => {
    const prompt = buildBoardImagePrompt({ ...BASE_CONFIG, drivetrain });

    assert.ok(
      prompt.includes(CRITICAL_NOSE_CONSTRAINT),
      `Prompt for [${drivetrain}] must contain the CRITICAL nose constraint`,
    );
  });
}

// 4WD boards must drive both trucks and must NOT carry the bare-nose constraint.
test('buildBoardImagePrompt [4WD] — drive hardware described on both nose and tail', () => {
  // Mountain board is the canonical 4WD config.
  const prompt = buildBoardImagePrompt({
    boardType: 'Mountain',
    drivetrain: '4WD',
    motor: 'Outrunner',
    wheels: 'Pneumatic',
    battery: 'TopPeli',
  });

  const desc = DRIVETRAIN_IMAGE_DESCRIPTIONS['4WD'];
  // The 4WD description must mention both front and rear trucks.
  assert.ok(
    /front/i.test(desc) && /rear/i.test(desc),
    `4WD description must mention both front and rear: "${desc}"`,
  );
  assert.ok(
    prompt.includes(desc),
    '4WD prompt must include the 4WD drivetrain description',
  );
});

test('buildBoardImagePrompt [Mountain 4WD] — includes mountainboard lore constraints', () => {
  const prompt = buildBoardImagePrompt({
    boardType: 'Mountain',
    drivetrain: '4WD',
    motor: 'Outrunner',
    wheels: 'Pneumatic',
    battery: 'TopPeli',
  });

  assert.ok(
    prompt.includes(MOUNTAINBOARD_LORE_CONSTRAINT),
    'Mountain 4WD prompt must describe foot straps and compact top-mounted battery lore',
  );
});

const WHEEL_DIAMETERS = {
  Urethane: '97 mm',
  Cloud: '107 mm',
  Pneumatic: '150 mm',
  Rubber: '175 mm',
};

for (const [wheels, diameter] of Object.entries(WHEEL_DIAMETERS)) {
  test(`buildBoardImagePrompt [${wheels}] — includes real wheel diameter scale anchor`, () => {
    const prompt = buildBoardImagePrompt({
      ...BASE_CONFIG,
      drivetrain: wheels === 'Pneumatic' || wheels === 'Rubber' ? '4WD' : 'Belt',
      boardType: wheels === 'Pneumatic' || wheels === 'Rubber' ? 'Mountain' : 'Street',
      wheels,
    });

    assert.ok(
      WHEEL_IMAGE_DESCRIPTIONS[wheels].includes(diameter),
      `Expected ${wheels} description to include ${diameter}`,
    );
    assert.ok(
      prompt.includes(WHEEL_IMAGE_DESCRIPTIONS[wheels]),
      `Prompt for ${wheels} must include the diameter-bearing wheel description`,
    );
    assert.match(
      prompt,
      /wheel type and wheel diameter/,
      'Prompt must preserve wheel diameter as a generation requirement',
    );
  });
}

// TODO: buildBoardImagePrompt currently appends CRITICAL_NOSE_CONSTRAINT
// unconditionally, so 4WD prompts include "On non-4WD boards the nose truck
// must look identical to a plain unpowered truck".  While the text is
// conditionally phrased, it is cleaner to omit it for 4WD builds to avoid
// any ambiguity in the image model.  Fixing this requires a prompt change;
// track and resolve in a dedicated PR.
test.todo('buildBoardImagePrompt [4WD] — does not include bare-nose constraint');

// ─────────────────────────────────────────────────────────────────────────────
// B. Reference-URL count contract
// ─────────────────────────────────────────────────────────────────────────────

test('BOARD_IMAGE_REQUIRED_URL_COUNT equals 4', () => {
  assert.equal(BOARD_IMAGE_REQUIRED_URL_COUNT, 4);
});

// B.1 – Every battery option must produce exactly BOARD_IMAGE_REQUIRED_URL_COUNT
//        category entries (guards against the SlimStealth regression in PR #366).
const BATTERY_TYPES = ['SlimStealth', 'DoubleStack', 'TopPeli'];

for (const battery of BATTERY_TYPES) {
  test(`resolveReferenceUrlCategories [${battery}] — always returns ${BOARD_IMAGE_REQUIRED_URL_COUNT} entries`, () => {
    const categories = resolveReferenceUrlCategories({
      boardType: 'Street',
      drivetrain: 'Belt',
      motor: 'Standard',
      wheels: 'Urethane',
      battery,
    });

    assert.equal(
      categories.length,
      BOARD_IMAGE_REQUIRED_URL_COUNT,
      `Expected ${BOARD_IMAGE_REQUIRED_URL_COUNT} categories for battery "${battery}", got ${categories.length}`,
    );
  });
}

test('resolveReferenceUrlCategories [SlimStealth] — 4th category is motor, not battery', () => {
  const categories = resolveReferenceUrlCategories({
    boardType: 'Street',
    drivetrain: 'Belt',
    motor: 'Standard',
    wheels: 'Urethane',
    battery: 'SlimStealth',
  });

  assert.equal(categories[3], 'motor');
});

test('resolveReferenceUrlCategories [DoubleStack] — 4th category is battery', () => {
  const categories = resolveReferenceUrlCategories({
    boardType: 'Street',
    drivetrain: 'Belt',
    motor: 'Standard',
    wheels: 'Urethane',
    battery: 'DoubleStack',
  });

  assert.equal(categories[3], 'battery');
});

test('resolveReferenceUrlCategories [TopPeli] — 4th category is battery', () => {
  const categories = resolveReferenceUrlCategories({
    boardType: 'Mountain',
    drivetrain: '4WD',
    motor: 'Outrunner',
    wheels: 'Pneumatic',
    battery: 'TopPeli',
  });

  assert.equal(categories[3], 'battery');
});

// B.2 – The server's normalizeBoardReferenceUrls enforces the same count.
test('normalizeBoardReferenceUrls accepts exactly BOARD_IMAGE_REQUIRED_URL_COUNT URLs', () => {
  const validUrls = [
    'https://punchskater.com/assets/boards/deck/street.png',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.png',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.png',
    'https://punchskater.com/assets/boards/battery/slim-battery.png',
  ];

  assert.equal(validUrls.length, BOARD_IMAGE_REQUIRED_URL_COUNT);
  assert.notEqual(normalizeBoardReferenceUrls(validUrls), null, 'should accept exactly 4 URLs');
});

test('normalizeBoardReferenceUrls rejects URL arrays shorter than BOARD_IMAGE_REQUIRED_URL_COUNT', () => {
  const threeUrls = [
    'https://punchskater.com/assets/boards/deck/street.png',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.png',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.png',
  ];

  assert.equal(
    threeUrls.length,
    BOARD_IMAGE_REQUIRED_URL_COUNT - 1,
    'sanity: fixture has one fewer than the required count',
  );
  assert.equal(normalizeBoardReferenceUrls(threeUrls), null, 'should reject 3 URLs');
});

test('normalizeBoardReferenceUrls accepts motor URL as 4th reference (SlimStealth battery path)', () => {
  const urls = [
    'https://punchskater.com/assets/boards/deck/street.png',
    'https://punchskater.com/assets/boards/drivetrain/belt-drive.png',
    'https://punchskater.com/assets/boards/wheels/poly-wheels.png',
    'https://punchskater.com/assets/boards/motor/6354-motor.png',
  ];

  assert.equal(urls.length, BOARD_IMAGE_REQUIRED_URL_COUNT);
  assert.notEqual(normalizeBoardReferenceUrls(urls), null, 'should accept motor as 4th URL');
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Cache-version sanity
// ─────────────────────────────────────────────────────────────────────────────

test('BOARD_IMAGE_CACHE_VERSION is a non-empty string', () => {
  assert.equal(typeof BOARD_IMAGE_CACHE_VERSION, 'string');
  assert.ok(BOARD_IMAGE_CACHE_VERSION.length > 0, 'BOARD_IMAGE_CACHE_VERSION must not be empty');
});
