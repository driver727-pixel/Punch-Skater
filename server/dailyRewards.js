/**
 * server/dailyRewards.js — Daily login reward / streak handlers.
 * Stubbed as no-op handlers so routes can be wired without errors.
 */

export function getDailyStreak(_req, res) {
  res.json({ ok: true, data: null });
}

export function claimDailyReward(_req, res) {
  res.json({ ok: true, data: null });
}
