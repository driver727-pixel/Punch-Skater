export const ACTIVE_LEADERBOARD_SEASON = {
  id: "season-2026-neon-thaw",
  label: "Neon Thaw",
  startsAt: "2026-03-01T00:00:00.000Z",
  endsAt: "2026-05-31T23:59:59.999Z",
} as const;

export const SEASONAL_SUBMISSION_COOLDOWN_HOURS = 4;
export const SEASONAL_SUBMISSION_COOLDOWN_MS = SEASONAL_SUBMISSION_COOLDOWN_HOURS * 60 * 60 * 1000;

export const SEASONAL_REWARD_TIERS = [
  {
    id: "participation",
    label: "Season Crew",
    description: "Valid 6-card seasonal entry; cosmetic badge only.",
  },
  {
    id: "top_half",
    label: "Top Half",
    description: "Top 50% of eligible seasonal entrants; profile title.",
  },
  {
    id: "top_ten_percent",
    label: "Top 10%",
    description: "Top 10% of eligible seasonal entrants; cosmetic frame.",
  },
  {
    id: "champion",
    label: "Season Champion",
    description: "Rank #1 among eligible entrants; legendary cosmetic title.",
  },
] as const;

export type SeasonalRewardTierId = (typeof SEASONAL_REWARD_TIERS)[number]["id"];

export const SEASONAL_FAIR_PLAY_RULES = [
  "Seasonal rank ignores lifetime Crew XP and lifetime Ozzies.",
  "The server recomputes rank from the owner’s saved deck; client-submitted scores are ignored.",
  "A seasonal entry must use exactly 6 unique cards.",
  `Entries can be refreshed once every ${SEASONAL_SUBMISSION_COOLDOWN_HOURS} hours.`,
  "Rewards are cosmetic/status-first so seasonal rank does not become pay-to-win power.",
] as const;

export function computeSeasonalRankScore(deckPower: number): number {
  if (!Number.isFinite(deckPower)) return 0;
  return Math.max(0, Math.round(deckPower));
}

export function resolveSeasonalRewardTierIds(rank: number, entrantCount: number): SeasonalRewardTierId[] {
  if (rank < 1 || entrantCount < 1) return [];

  const tiers: SeasonalRewardTierId[] = ["participation"];
  if (rank <= Math.ceil(entrantCount * 0.5)) tiers.push("top_half");
  if (rank <= Math.ceil(entrantCount * 0.1)) tiers.push("top_ten_percent");
  if (rank === 1) tiers.push("champion");
  return tiers;
}

export function isSeasonActive(now: Date = new Date()): boolean {
  const time = now.getTime();
  return time >= Date.parse(ACTIVE_LEADERBOARD_SEASON.startsAt)
    && time <= Date.parse(ACTIVE_LEADERBOARD_SEASON.endsAt);
}
