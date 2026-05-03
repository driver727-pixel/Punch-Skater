export const DAILY_REWARD_STREAK_CAP = 7;
export const FREE_FORGE_COOLDOWN_MS = 8 * 60 * 60 * 1000;

export interface DailyRewardAmounts {
  xp: number;
  ozzies: number;
}

export function buildDailyReward(currentStreak: number): DailyRewardAmounts {
  const rewardTier = Math.max(1, Math.min(DAILY_REWARD_STREAK_CAP, Number(currentStreak) || 1));
  return {
    xp: 20 + rewardTier * 10,
    ozzies: 8 + rewardTier * 4,
  };
}

export function getNextDailyReward(currentStreak: number, claimedToday: boolean): DailyRewardAmounts {
  return buildDailyReward(claimedToday ? currentStreak + 1 : currentStreak);
}

export function formatDurationClock(totalMs: number): string {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Returns the remaining milliseconds until a future target.
 * Accepts either an epoch timestamp number or an ISO-8601 string.
 */
export function getRemainingDurationMs(targetAt?: string | number | null, nowMs: number = Date.now()): number {
  if (targetAt == null) return 0;
  const targetMs = typeof targetAt === "number" ? targetAt : new Date(targetAt).getTime();
  if (!Number.isFinite(targetMs)) return 0;
  return Math.max(0, targetMs - nowMs);
}
