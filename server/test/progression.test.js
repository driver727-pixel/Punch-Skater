import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREW_SIZE,
  MAX_CARD_XP,
  MAX_DECK_POWER_TARGET,
  DECK_POWER_UPGRADE_THRESHOLDS,
  OZZY_BASE_RANGE,
  assignBaseOzzies,
  computeCardOzzies,
  computeCrewOzzies,
  getCardXp,
  computeCrewXp,
  computeLeaderboardScore,
} from '../lib/progression.js';

// ── Constants ─────────────────────────────────────────────────────────────────

test('CREW_SIZE is 6', () => {
  assert.equal(CREW_SIZE, 6);
});

test('MAX_CARD_XP is 100,000,000', () => {
  assert.equal(MAX_CARD_XP, 100_000_000);
});

test('MAX_DECK_POWER_TARGET is 10,000', () => {
  assert.equal(MAX_DECK_POWER_TARGET, 10_000);
});

test('DECK_POWER_UPGRADE_THRESHOLDS defines Apprentice/Master/Rare/Legendary', () => {
  assert.equal(DECK_POWER_UPGRADE_THRESHOLDS.Apprentice, 1_000);
  assert.equal(DECK_POWER_UPGRADE_THRESHOLDS.Master,     2_500);
  assert.equal(DECK_POWER_UPGRADE_THRESHOLDS.Rare,       5_000);
  assert.equal(DECK_POWER_UPGRADE_THRESHOLDS.Legendary,  8_500);
});

// ── assignBaseOzzies ──────────────────────────────────────────────────────────

test('assignBaseOzzies returns value within rarity range', () => {
  const rarities = Object.keys(OZZY_BASE_RANGE);
  for (const rarity of rarities) {
    const { min, max } = OZZY_BASE_RANGE[rarity];
    const result = assignBaseOzzies(rarity, 0.5);
    assert.ok(result >= min && result <= max, `${rarity}: ${result} not in [${min}, ${max}]`);
  }
});

test('assignBaseOzzies returns min when normRng is 0', () => {
  assert.equal(assignBaseOzzies('Punch Skater', 0), OZZY_BASE_RANGE['Punch Skater'].min);
});

test('assignBaseOzzies returns max when normRng is ~1', () => {
  const { min, max } = OZZY_BASE_RANGE['Rare'];
  const result = assignBaseOzzies('Rare', 0.9999);
  assert.ok(result >= min && result <= max);
});

test('assignBaseOzzies falls back to Punch Skater range for unknown rarity', () => {
  const { min, max } = OZZY_BASE_RANGE['Punch Skater'];
  const result = assignBaseOzzies('Unknown', 0.5);
  assert.ok(result >= min && result <= max);
});

// ── computeCardOzzies ─────────────────────────────────────────────────────────

test('computeCardOzzies uses explicit ozzies field when present', () => {
  const card = { stats: { speed: 5, range: 5, stealth: 5, grit: 5 }, ozzies: 99 };
  assert.equal(computeCardOzzies(card), 99);
});

test('computeCardOzzies falls back to stat sum when ozzies is absent', () => {
  const card = { stats: { speed: 5, range: 3, stealth: 4, grit: 6 } };
  assert.equal(computeCardOzzies(card), 18);
});

test('computeCardOzzies treats ozzies=0 as valid (no fallback)', () => {
  const card = { stats: { speed: 10, range: 10, stealth: 10, grit: 10 }, ozzies: 0 };
  assert.equal(computeCardOzzies(card), 0);
});

// ── computeCrewOzzies ─────────────────────────────────────────────────────────

test('computeCrewOzzies sums Ozzy values across cards', () => {
  const cards = [
    { stats: {}, ozzies: 100 },
    { stats: {}, ozzies: 200 },
    { stats: {}, ozzies: 50  },
  ];
  assert.equal(computeCrewOzzies(cards), 350);
});

test('computeCrewOzzies returns 0 for empty array', () => {
  assert.equal(computeCrewOzzies([]), 0);
});

// ── getCardXp ─────────────────────────────────────────────────────────────────

test('getCardXp returns 0 when xp is absent', () => {
  assert.equal(getCardXp({}), 0);
});

test('getCardXp clamps at 0 for negative values', () => {
  assert.equal(getCardXp({ xp: -500 }), 0);
});

test('getCardXp clamps at MAX_CARD_XP', () => {
  assert.equal(getCardXp({ xp: MAX_CARD_XP + 1 }), MAX_CARD_XP);
});

test('getCardXp returns the value for normal XP', () => {
  assert.equal(getCardXp({ xp: 24_500 }), 24_500);
});

// ── computeCrewXp ─────────────────────────────────────────────────────────────

test('computeCrewXp sums XP across cards', () => {
  const cards = [{ xp: 1_000 }, { xp: 2_000 }, { xp: 500 }];
  assert.equal(computeCrewXp(cards), 3_500);
});

test('computeCrewXp treats missing xp as 0', () => {
  const cards = [{ xp: 1_000 }, {}, { xp: 500 }];
  assert.equal(computeCrewXp(cards), 1_500);
});

// ── computeLeaderboardScore ───────────────────────────────────────────────────

test('computeLeaderboardScore combines deck power, crew ozzies, crew xp', () => {
  // Deck Power: 4800, Crew Ozzies: 1200, Crew XP: 2,000,000 → 200, rep: 350
  const score = computeLeaderboardScore(4800, 1200, 2_000_000, 350);
  assert.equal(score, 4800 + 1200 + 200 + 350); // 6550
});

test('computeLeaderboardScore defaults district reputation to 0', () => {
  const score = computeLeaderboardScore(100, 50, 10_000);
  assert.equal(score, 100 + 50 + 1); // 151
});

test('computeLeaderboardScore does not let XP dominate (maxed card)', () => {
  // One maxed card: 100,000,000 XP → contributes only 10,000 to score
  const score = computeLeaderboardScore(0, 0, MAX_CARD_XP);
  assert.equal(score, MAX_CARD_XP / 10_000); // 10,000
});
