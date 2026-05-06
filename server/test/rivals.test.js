import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRICT_RIVALS,
  getDistrictRival,
  getDistrictRivalsByDistrict,
} from '../lib/rivals.js';
import { JOUST_DIFFICULTIES, resolveJoust } from '../lib/joust.js';

const VALID_TACTICS = new Set(['charge', 'guard', 'feint', 'counter', 'boost', 'trickStrike']);
const VALID_DIFFICULTIES = new Set(Object.keys(JOUST_DIFFICULTIES));
const VALID_RARITIES = new Set(['Rare', 'Legendary']);
const VALID_DISTRICTS = new Set([
  'Airaway',
  'Batteryville',
  'The Grid',
  'Nightshade',
  'The Forest',
  'Glass City',
]);
const VALID_FACTIONS = new Set([
  'United Corporations of America (UCA)',
  'Qu111s (Quills)',
  'Ne0n Legion',
  'Iron Curtains',
  'D4rk $pider',
  'The Asclepians',
  'The Mesopotamian Society',
  'The Knights Technarchy',
  "Hermes' Squirmies",
  'UCPS Workers',
  'The Team',
  'Moonrisers',
  'The Wooders',
  'Punch Skaters',
]);
const KNOWN_JOUST_TRAITS = new Set([
  'Boost Charge',
  'Street Parry',
  'Magnetic Guard',
  'Heavy Lance',
  'Riot Shield',
  'Neon Flourish',
]);

test('first five district rivals catalogue ships exactly five named rivals', () => {
  assert.equal(DISTRICT_RIVALS.length, 5);
  const names = DISTRICT_RIVALS.map((rival) => rival.name);
  assert.deepEqual(
    [...names].sort(),
    ['Jax Voltage', 'Mina Chrome', 'Nova Saint', 'Rook Wraith', 'Vex Static'],
  );
});

test('rival ids, card reward ids and codex unlock ids are all unique', () => {
  const ids = DISTRICT_RIVALS.map((rival) => rival.id);
  const rewardIds = DISTRICT_RIVALS.map((rival) => rival.cardReward.id);
  const codexIds = DISTRICT_RIVALS.map((rival) => rival.codexUnlock.id);
  const cardIds = DISTRICT_RIVALS.map((rival) => rival.signatureCard.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(rewardIds).size, rewardIds.length);
  assert.equal(new Set(codexIds).size, codexIds.length);
  assert.equal(new Set(cardIds).size, cardIds.length);
});

test('every rival entry is well-formed and uses canonical enums', () => {
  for (const rival of DISTRICT_RIVALS) {
    assert.equal(typeof rival.id, 'string');
    assert.ok(rival.id.length > 0, `rival ${rival.name} needs an id`);
    assert.ok(VALID_DISTRICTS.has(rival.district), `unexpected district ${rival.district}`);
    assert.ok(VALID_FACTIONS.has(rival.faction), `unexpected faction ${rival.faction}`);
    assert.ok(VALID_TACTICS.has(rival.signatureTactic), `unexpected tactic ${rival.signatureTactic}`);
    assert.ok(VALID_DIFFICULTIES.has(rival.difficulty), `unexpected difficulty ${rival.difficulty}`);
    assert.ok(KNOWN_JOUST_TRAITS.has(rival.signatureTrait), `unknown trait ${rival.signatureTrait}`);
    assert.ok(rival.personality.length > 40, 'personality dossier should be a real sentence');
    assert.ok(rival.tagline.length > 0);

    const card = rival.signatureCard;
    assert.equal(card.name, rival.name);
    assert.equal(card.district, rival.district);
    for (const stat of ['speed', 'range', 'rangeNm', 'stealth', 'grit']) {
      const value = card.stats[stat];
      assert.ok(value >= 1 && value <= 10, `${rival.name} stat ${stat} out of range`);
    }
    for (const stat of ['lance', 'shield', 'hype']) {
      const value = card.joust[stat];
      assert.ok(value >= 1 && value <= 10, `${rival.name} joust stat ${stat} out of range`);
    }
    for (const trait of card.joust.traits) {
      assert.ok(KNOWN_JOUST_TRAITS.has(trait), `${rival.name} card trait ${trait} not known`);
    }

    assert.equal(typeof rival.cardReward.id, 'string');
    assert.ok(VALID_RARITIES.has(rival.cardReward.rarity));
    assert.equal(typeof rival.codexUnlock.title, 'string');
    assert.ok(rival.codexUnlock.summary.length > 40);

    for (const line of [
      rival.dialogue.intro,
      rival.dialogue.win,
      rival.dialogue.loss,
      rival.dialogue.draw,
    ]) {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    }
  }
});

test('every signature card is statted to win its rival\'s signature tactic head-on', () => {
  // A boss-tier rival fed a baseline player and forced into its signature tactic
  // should have at least a fighting (non-strictly-losing) line. Otherwise the
  // signature tactic isn't really a signature.
  const baselinePlayer = {
    id: 'baseline-player',
    name: 'Baseline Skater',
    stats: { speed: 5, range: 5, rangeNm: 5, stealth: 5, grit: 5 },
    joust: {
      lance: 5,
      shield: 5,
      hype: 5,
      gear: { boardType: 'Street', lanceType: 'kinetic', shieldType: 'riot', armorTag: 'street shell' },
      traits: [],
    },
  };

  for (const rival of DISTRICT_RIVALS) {
    const result = resolveJoust(baselinePlayer, rival.signatureCard, {
      playerTactic: 'charge',
      rivalTactic: rival.signatureTactic,
      seed: `signature::${rival.id}`,
      difficulty: rival.difficulty,
    });
    assert.equal(result.rivalTactic, rival.signatureTactic, `${rival.name} should ride their signature tactic`);
    assert.ok(result.strike <= 0, `${rival.name} should not get auto-cracked by a baseline rider`);
  }
});

test('lookups by id and by district return the expected rivals', () => {
  assert.equal(getDistrictRival('grid-vex-static').name, 'Vex Static');
  assert.equal(getDistrictRival('does-not-exist'), undefined);

  const nightshade = getDistrictRivalsByDistrict('Nightshade');
  assert.equal(nightshade.length, 1);
  assert.equal(nightshade[0].name, 'Rook Wraith');

  // The Forest is intentionally a future expansion slot in this batch.
  assert.equal(getDistrictRivalsByDistrict('The Forest').length, 0);
});
