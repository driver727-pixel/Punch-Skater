/**
 * server/battlePass.js — Battle pass progression handlers.
 * Stubbed as no-op handlers so routes can be wired without errors.
 */

export function getBattlePassState(_req, res) {
  res.json({ ok: true, data: null });
}

export function claimBattlePassReward(_req, res) {
  res.json({ ok: true, data: null });
}

export function advanceBattlePassTier(_req, res) {
  res.json({ ok: true, data: null });
}
