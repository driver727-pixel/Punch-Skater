import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyReward,
  diffDateKeys,
  resolveDailyRewardState,
  toDateKey,
} from '../dailyRewards.js';

test('toDateKey normalizes to YYYY-MM-DD', () => {
  assert.equal(toDateKey('2026-04-27T14:22:18.000Z'), '2026-04-27');
});

test('diffDateKeys returns calendar-day deltas', () => {
  assert.equal(diffDateKeys('2026-04-26', '2026-04-27'), 1);
  assert.equal(diffDateKeys('2026-04-24', '2026-04-27'), 3);
});

test('buildDailyReward scales with streak and caps at the configured maximum', () => {
  assert.deepEqual(buildDailyReward(1), { xp: 30, ozzies: 12 });
  assert.deepEqual(buildDailyReward(99), { xp: 90, ozzies: 36 });
});

test('resolveDailyRewardState increments a continuing streak', () => {
  assert.deepEqual(
    resolveDailyRewardState({
      currentStreak: 3,
      longestStreak: 4,
      totalClaims: 8,
      lastClaimDate: '2026-04-26',
    }, '2026-04-27'),
    {
      claimedToday: false,
      currentStreak: 4,
      longestStreak: 4,
      totalClaims: 9,
      lastClaimDate: '2026-04-27',
      reward: { xp: 60, ozzies: 24 },
    },
  );
});

test('resolveDailyRewardState resets streaks after a skipped day', () => {
  assert.deepEqual(
    resolveDailyRewardState({
      currentStreak: 5,
      longestStreak: 5,
      totalClaims: 10,
      lastClaimDate: '2026-04-24',
    }, '2026-04-27'),
    {
      claimedToday: false,
      currentStreak: 1,
      longestStreak: 5,
      totalClaims: 11,
      lastClaimDate: '2026-04-27',
      reward: { xp: 30, ozzies: 12 },
    },
  );
});

test('resolveDailyRewardState does not double-claim the same day', () => {
  assert.deepEqual(
    resolveDailyRewardState({
      currentStreak: 2,
      longestStreak: 3,
      totalClaims: 7,
      lastClaimDate: '2026-04-27',
    }, '2026-04-27'),
    {
      claimedToday: true,
      currentStreak: 2,
      longestStreak: 3,
      totalClaims: 7,
      lastClaimDate: '2026-04-27',
      reward: { xp: 0, ozzies: 0 },
    },
  );
});
