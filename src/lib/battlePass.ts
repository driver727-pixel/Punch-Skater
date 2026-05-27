/**
 * battlePass.ts — Seasonal Battle Pass progression system.
 *
 * Each season lasts 6 weeks. Players earn XP from daily missions, battles,
 * streaks, and activities. XP advances them through tiers, each unlocking
 * rewards. Premium track offers bonus rewards.
 *
 * Tier 0 is the starting state (no XP needed). Max tier is 30.
 */

export const BATTLE_PASS_MAX_TIER = 30;
export const SEASON_DURATION_WEEKS = 6;
export const XP_PER_TIER_BASE = 100;
export const XP_SCALING_FACTOR = 1.15;

export interface BattlePassReward {
  tier: number;
  name: string;
  description: string;
  type: "ozzies" | "frame" | "forge_credit" | "cosmetic" | "title";
  value: number | string;
  premium: boolean;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  cumulativeXp: number;
  freeReward: BattlePassReward | null;
  premiumReward: BattlePassReward | null;
}

export interface BattlePassSeason {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  tiers: BattlePassTier[];
}

export interface LocalBattlePassState {
  seasonId: string;
  tier: number;
  xp: number;
  isPremium: boolean;
  claimedFreeRewards: number[];
  claimedPremiumRewards: number[];
}

function xpForTier(tier: number): number {
  if (tier <= 0) return 0;
  return Math.floor(XP_PER_TIER_BASE * Math.pow(XP_SCALING_FACTOR, tier - 1));
}

function buildTiers(): BattlePassTier[] {
  const tiers: BattlePassTier[] = [];
  let cumulative = 0;

  for (let t = 0; t <= BATTLE_PASS_MAX_TIER; t++) {
    const xpRequired = xpForTier(t);
    cumulative += xpRequired;

    const freeReward = buildFreeReward(t);
    const premiumReward = buildPremiumReward(t);

    tiers.push({ tier: t, xpRequired, cumulativeXp: cumulative, freeReward, premiumReward });
  }

  return tiers;
}

function buildFreeReward(tier: number): BattlePassReward | null {
  if (tier === 0) return null;

  if (tier % 5 === 0) {
    return { tier, name: `${tier * 10} Ozzies`, description: `Milestone: ${tier * 10} Ozzies bonus`, type: "ozzies", value: tier * 10, premium: false };
  }
  if (tier % 3 === 0) {
    return { tier, name: "Forge Credit", description: "One free forge attempt", type: "forge_credit", value: 1, premium: false };
  }
  if (tier % 2 === 0) {
    return { tier, name: `${tier * 3} Ozzies`, description: `${tier * 3} Ozzies reward`, type: "ozzies", value: tier * 3, premium: false };
  }

  return null;
}

function buildPremiumReward(tier: number): BattlePassReward | null {
  if (tier === 0) return null;

  if (tier === BATTLE_PASS_MAX_TIER) {
    return { tier, name: "Season Champion Frame", description: "Exclusive frame for completing the battle pass", type: "frame", value: "season-champion", premium: true };
  }
  if (tier % 10 === 0) {
    return { tier, name: `Legendary ${tier === 10 ? "Neon" : tier === 20 ? "Chrome" : "Holo"} Frame`, description: "Premium Legendary card frame", type: "frame", value: `legendary-bp-${tier}`, premium: true };
  }
  if (tier % 5 === 0) {
    return { tier, name: `Season Title: Tier ${tier}`, description: `Display title for reaching Tier ${tier}`, type: "title", value: `tier-${tier}`, premium: true };
  }
  if (tier % 3 === 0) {
    return { tier, name: `${tier * 5} Premium Ozzies`, description: `${tier * 5} bonus Ozzies`, type: "ozzies", value: tier * 5, premium: true };
  }

  return null;
}

export const BATTLE_PASS_TIERS = buildTiers();

export function getCurrentSeasonId(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const weekOfYear = Math.ceil(
    ((date.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / (24 * 60 * 60 * 1000) + 1) / 7,
  );
  const seasonNum = Math.ceil(weekOfYear / SEASON_DURATION_WEEKS);
  return `S${year}-${String(seasonNum).padStart(2, "0")}`;
}

export function getSeasonBounds(seasonId: string): { startsAt: string; endsAt: string } {
  const match = seasonId.match(/^S(\d{4})-(\d{2})$/);
  if (!match) {
    const now = new Date();
    return { startsAt: now.toISOString(), endsAt: new Date(now.getTime() + SEASON_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString() };
  }
  const year = parseInt(match[1]);
  const seasonNum = parseInt(match[2]);
  const startWeek = (seasonNum - 1) * SEASON_DURATION_WEEKS;
  const startDate = new Date(Date.UTC(year, 0, 1 + startWeek * 7));
  const endDate = new Date(startDate.getTime() + SEASON_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000);
  return { startsAt: startDate.toISOString(), endsAt: endDate.toISOString() };
}

const BP_STORAGE_KEY = "skpd_battle_pass";

export function loadBattlePassState(): LocalBattlePassState {
  const seasonId = getCurrentSeasonId();
  try {
    const raw = localStorage.getItem(BP_STORAGE_KEY);
    if (!raw) return defaultState(seasonId);
    const parsed = JSON.parse(raw) as LocalBattlePassState;
    if (parsed.seasonId !== seasonId) return defaultState(seasonId);
    return parsed;
  } catch {
    return defaultState(seasonId);
  }
}

function defaultState(seasonId: string): LocalBattlePassState {
  return { seasonId, tier: 0, xp: 0, isPremium: false, claimedFreeRewards: [], claimedPremiumRewards: [] };
}

export function saveBattlePassState(state: LocalBattlePassState): void {
  localStorage.setItem(BP_STORAGE_KEY, JSON.stringify(state));
}

export function addXpToPass(state: LocalBattlePassState, xpGain: number): LocalBattlePassState {
  let xp = state.xp + xpGain;
  let tier = state.tier;

  while (tier < BATTLE_PASS_MAX_TIER) {
    const nextTierXp = BATTLE_PASS_TIERS[tier + 1]?.xpRequired ?? Infinity;
    if (xp >= nextTierXp) {
      xp -= nextTierXp;
      tier++;
    } else {
      break;
    }
  }

  if (tier >= BATTLE_PASS_MAX_TIER) {
    tier = BATTLE_PASS_MAX_TIER;
  }

  const next = { ...state, tier, xp };
  saveBattlePassState(next);
  return next;
}

export function claimReward(
  state: LocalBattlePassState,
  tier: number,
  premium: boolean,
): LocalBattlePassState {
  if (tier > state.tier) return state;
  if (premium && !state.isPremium) return state;

  const claimed = premium ? [...state.claimedPremiumRewards] : [...state.claimedFreeRewards];
  if (claimed.includes(tier)) return state;
  claimed.push(tier);

  const next = premium
    ? { ...state, claimedPremiumRewards: claimed }
    : { ...state, claimedFreeRewards: claimed };
  saveBattlePassState(next);
  return next;
}

export function getXpProgress(state: LocalBattlePassState): {
  currentXp: number;
  xpToNext: number;
  percentage: number;
} {
  if (state.tier >= BATTLE_PASS_MAX_TIER) {
    return { currentXp: state.xp, xpToNext: 0, percentage: 100 };
  }
  const xpToNext = BATTLE_PASS_TIERS[state.tier + 1]?.xpRequired ?? 0;
  const percentage = xpToNext > 0 ? Math.min((state.xp / xpToNext) * 100, 100) : 100;
  return { currentXp: state.xp, xpToNext, percentage };
}
