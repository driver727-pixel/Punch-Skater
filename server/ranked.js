/**
 * server/ranked.js — Ranked season handlers.
 * Stubbed as no-op handlers so routes can be wired without errors.
 */

export function getCurrentSeason(_req, res) {
  res.json({ ok: true, data: null });
}

export function getSeasonStandings(_req, res) {
  res.json({ ok: true, data: [] });
}

export function submitRankedResult(_req, res) {
  res.json({ ok: true, data: null });
}
