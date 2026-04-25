/**
 * server/dailyRewards.js — Daily login reward / streak handlers.
 * Stubbed as no-op handlers so routes can be wired without errors.
 *
 * TODO (Sprint 2): When this handler processes a successful claim, the client
 * should call `trackMissionEvent(uid, { type: "daily_login" })` from
 * `src/services/missions.ts` after receiving the successful HTTP response.
 * The call should be gated behind `isEnabled("MISSIONS")` (featureFlags.ts).
 */

export function getDailyStreak(_req, res) {
  res.json({ ok: true, data: null });
}

export function claimDailyReward(_req, res) {
  res.json({ ok: true, data: null });
}
