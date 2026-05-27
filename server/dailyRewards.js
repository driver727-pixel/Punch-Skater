/**
 * server/dailyRewards.js — shared daily reward helpers.
 */

export const DAILY_STREAK_COLLECTION = 'dailyStreaks';
export const DAILY_REWARD_STREAK_CAP = 7;
const DAY_MS = 86_400_000;

export function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function diffDateKeys(previousDateKey, nextDateKey) {
  const previous = parseDateKey(previousDateKey);
  const next = parseDateKey(nextDateKey);
  if (previous == null || next == null) {
    return Number.NaN;
  }
  return Math.round((next - previous) / DAY_MS);
}

export function buildDailyReward(currentStreak) {
  const rewardTier = Math.max(1, Math.min(DAILY_REWARD_STREAK_CAP, Number(currentStreak) || 1));
  return {
    xp: 20 + rewardTier * 10,
    ozzies: 8 + rewardTier * 4,
  };
}

export function resolveDailyRewardState(streakDoc, todayDateKey = toDateKey()) {
  const previousCurrentStreak = Math.max(0, Number(streakDoc?.currentStreak) || 0);
  const previousLongestStreak = Math.max(0, Number(streakDoc?.longestStreak) || 0);
  const previousTotalClaims = Math.max(0, Number(streakDoc?.totalClaims) || 0);
  const lastClaimDate = typeof streakDoc?.lastClaimDate === 'string' ? streakDoc.lastClaimDate : '';

  if (lastClaimDate === todayDateKey) {
    return {
      claimedToday: true,
      currentStreak: previousCurrentStreak,
      longestStreak: previousLongestStreak,
      totalClaims: previousTotalClaims,
      lastClaimDate,
      reward: { xp: 0, ozzies: 0 },
    };
  }

  const dayDelta = diffDateKeys(lastClaimDate, todayDateKey);
  const nextCurrentStreak = dayDelta === 1 ? previousCurrentStreak + 1 : 1;
  const nextLongestStreak = Math.max(previousLongestStreak, nextCurrentStreak);
  const nextTotalClaims = previousTotalClaims + 1;

  return {
    claimedToday: false,
    currentStreak: nextCurrentStreak,
    longestStreak: nextLongestStreak,
    totalClaims: nextTotalClaims,
    lastClaimDate: todayDateKey,
    reward: buildDailyReward(nextCurrentStreak),
  };
}
