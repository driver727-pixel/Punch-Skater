import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEASONAL_SUBMISSION_COOLDOWN_HOURS,
  buildLeaderboardDeckSummary,
  computeLifetimeLeaderboardScore,
  computeSeasonalRankScore,
  resolveSeasonalRewardTierIds,
  validateSeasonalDeck,
} from '../lib/seasonalLeaderboard.js';

function makeCard(id, archetype = 'Courier', stats = { speed: 10, range: 10, stealth: 10, grit: 10 }) {
  return {
    id,
    prompts: { archetype },
    stats,
    ozzies: 100,
    xp: 50_000,
  };
}

test('seasonal score excludes lifetime XP and Ozzies', () => {
  const deckPower = 240;
  assert.equal(computeSeasonalRankScore(deckPower), 240);
  assert.equal(computeLifetimeLeaderboardScore({ deckPower, crewOzzies: 600, crewXp: 300_000 }), 870);
});

test('seasonal reward tiers are fair placement bands', () => {
  assert.deepEqual(resolveSeasonalRewardTierIds(80, 100), ['participation']);
  assert.deepEqual(resolveSeasonalRewardTierIds(50, 100), ['participation', 'top_half']);
  assert.deepEqual(resolveSeasonalRewardTierIds(10, 100), ['participation', 'top_half', 'top_ten_percent']);
  assert.deepEqual(resolveSeasonalRewardTierIds(1, 100), ['participation', 'top_half', 'top_ten_percent', 'champion']);
});

test('seasonal deck validation requires exactly 6 unique cards', () => {
  assert.equal(validateSeasonalDeck([makeCard('a')]).ok, false);
  assert.equal(validateSeasonalDeck(['a', 'b', 'c', 'd', 'e', 'e'].map((id) => makeCard(id))).ok, false);
  assert.equal(validateSeasonalDeck(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => makeCard(id))).ok, true);
});

test('leaderboard deck summary applies capped synergy', () => {
  const cards = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => makeCard(id));
  const summary = buildLeaderboardDeckSummary(cards);
  assert.equal(summary.deckPower, 276);
  assert.equal(summary.synergyBonusPct, 15);
  assert.equal(summary.archetypeHint, 'Courier core (6/6)');
});

test('seasonal cooldown is four hours', () => {
  assert.equal(SEASONAL_SUBMISSION_COOLDOWN_HOURS, 4);
});
