/**
 * progression.ts — Player progression model for Punch Skater.
 *
 * Defines the four core progression axes and helper calculations:
 *
 *   XP         — what a card has done (earned through gameplay)
 *   Points     — what a card can do (individual stat numbers)
 *   Deck Power — how strong the active Crew is (sum of all stat points)
 *   Ozzies     — how valuable and respected the collection is
 *
 * All constants here are the single source of truth for upgrade thresholds,
 * reward ranges, and leaderboard scoring across client and server.
 */

import type { CardPayload, LeaderboardEntry, Rarity } from "./types";

// ── Crew size ─────────────────────────────────────────────────────────────────

/** An active Crew consists of exactly this many Punch Skater cards. */
export const CREW_SIZE = 6;

// ── XP ────────────────────────────────────────────────────────────────────────

/**
 * Maximum XP a single card can accumulate through gameplay.
 *
 * XP shows what you have done.  It represents how seasoned a card is — earned
 * through missions, battles, login streaks, and other gameplay.  XP does NOT
 * directly equal power; it unlocks upgrade eligibility thresholds alongside
 * Deck Power.
 */
export const MAX_CARD_XP = 100_000_000;

// ── Points (stats) ────────────────────────────────────────────────────────────

/**
 * Number of stat dimensions that contribute to Deck Power.
 * Currently: speed, range, stealth, grit.
 *
 * Points show what your cards can do.  They are the raw stat numbers on each
 * card.  Mission outcomes can increase or decrease points.
 */
export const DECK_POWER_STAT_COUNT = 4;

// ── Deck Power ────────────────────────────────────────────────────────────────

/**
 * Long-term design target for maximum Deck Power.
 *
 * Deck Power shows how strong your Crew is.  It is the combined points of all
 * stats across all 6 cards in the active Crew.
 *
 * NOTE: With the current stat scale (1–10 per stat, 4 stats, 6 cards) the
 * architectural ceiling is 240.  The 10,000 target is the long-term design
 * aspiration and balancing cap for future stat-scaling work.  It should be
 * referenced in documentation and UI copy but must not hard-break existing
 * cards.
 */
export const MAX_DECK_POWER_TARGET = 10_000;

/**
 * Deck Power upgrade-unlock thresholds.
 *
 * Once the active Crew reaches one of these Deck Power values, the player
 * becomes eligible to forge cards at the corresponding rarity tier.
 *
 * Thresholds are expressed as fractions of MAX_DECK_POWER_TARGET so that they
 * scale correctly when the stat ceiling is raised in a future sprint:
 *
 *   Apprentice  1,000 / 10,000 = 10 %
 *   Master      2,500 / 10,000 = 25 %
 *   Rare        5,000 / 10,000 = 50 %
 *   Legendary   8,500 / 10,000 = 85 %
 *
 * Legendary cannot be forged.  It can only be earned through gameplay, special
 * missions, achievements, events, or leaderboard rewards.
 */
export const DECK_POWER_UPGRADE_THRESHOLDS = {
  Apprentice: 1_000,
  Master:     2_500,
  Rare:       5_000,
  Legendary:  8_500,
} as const satisfies Partial<Record<Rarity, number>>;

// ── Ozzies ────────────────────────────────────────────────────────────────────

/**
 * Ozzies show how valuable and respected your collection is.
 *
 * Each card carries a randomly assigned base Ozzy value (assigned at forge
 * time, seeded for reproducibility).  Missions and achievements can add more
 * Ozzies to individual cards.
 *
 *   Account Ozzies = sum of Ozzy values across all cards in the collection
 *   Crew Ozzies    = sum of Ozzy values across the 6 active Crew cards
 */

/** Base Ozzy ranges per rarity tier (inclusive min / max). */
export const OZZY_BASE_RANGE: Record<Rarity, { min: number; max: number }> = {
  "Punch Skater": { min: 5,   max: 50   },
  Apprentice:     { min: 25,  max: 100  },
  Master:         { min: 75,  max: 200  },
  Rare:           { min: 150, max: 500  },
  Legendary:      { min: 500, max: 2000 },
};

/**
 * Deterministically assign a base Ozzy value for a newly forged card.
 *
 * @param rarity  — card rarity tier
 * @param normRng — a pre-seeded normalised RNG value in [0, 1)
 */
export function assignBaseOzzies(rarity: Rarity, normRng: number): number {
  const { min, max } = OZZY_BASE_RANGE[rarity] ?? OZZY_BASE_RANGE["Punch Skater"];
  return Math.round(min + normRng * (max - min));
}

/**
 * Return the Ozzy value of a single card.
 *
 * If the card was forged with the new progression model it will carry an
 * explicit `ozzies` field; otherwise we fall back to the legacy stat-sum
 * heuristic so that older saved cards remain usable.
 */
export function computeCardOzzies(card: CardPayload): number {
  if (typeof card.ozzies === "number" && card.ozzies >= 0) {
    return card.ozzies;
  }
  // Fallback: derive an approximation from the card's stat total
  const { speed = 0, range = 0, stealth = 0, grit = 0 } = card.stats;
  return speed + range + stealth + grit;
}

/** Crew Ozzies = sum of Ozzy values across the active 6-card deck. */
export function computeCrewOzzies(cards: CardPayload[]): number {
  return cards.reduce((sum, card) => sum + computeCardOzzies(card), 0);
}

/** Return the XP value for a single card (defaults to 0). */
export function getCardXp(card: CardPayload): number {
  return typeof card.xp === "number" ? Math.max(0, Math.min(card.xp, MAX_CARD_XP)) : 0;
}

/** Crew XP = sum of XP across all cards in the active 6-card deck. */
export function computeCrewXp(cards: CardPayload[]): number {
  return cards.reduce((sum, card) => sum + getCardXp(card), 0);
}

// ── Leaderboard scoring ───────────────────────────────────────────────────────

/**
 * Combined leaderboard score formula.
 *
 *   Score = Deck Power + Crew Ozzies + (Crew XP / 10,000) + district reputation
 *
 * Crew XP is divided by 10,000 so that a maxed-out card at 100,000,000 XP
 * contributes 10,000 points — the same order of magnitude as Deck Power and
 * Crew Ozzies — preventing XP from dominating the score.
 *
 * District reputation is a placeholder (0) until the district rep system is
 * implemented.
 */
export function computeLeaderboardScore(
  deckPower: number,
  crewOzzies: number,
  crewXp: number,
  districtReputation: number = 0,
): number {
  return Math.round(deckPower + crewOzzies + crewXp / 10_000 + districtReputation);
}

/** Compute a full leaderboard score from a LeaderboardEntry snapshot. */
export function computeLeaderboardScoreFromEntry(entry: LeaderboardEntry): number {
  return computeLeaderboardScore(
    entry.deckPower,
    entry.crewOzzies ?? 0,
    entry.crewXp ?? 0,
  );
}

// ── District risk/reward reference ────────────────────────────────────────────

/**
 * Reference data for district-specific mission risk and reward design.
 *
 * These are authoritative design constants used to populate UI copy, seed new
 * mission definitions, and document the expected risk/reward profile for each
 * district.  They do NOT drive live gameplay logic directly — the mission board
 * server uses these as authoring guidance.
 */
export interface DistrictRiskRewardProfile {
  district: string;
  theme: string;
  rewards: string[];
  risks: string[];
  primaryStat: string;
}

export const DISTRICT_RISK_REWARD_PROFILES: readonly DistrictRiskRewardProfile[] = [
  {
    district: "Airaway",
    theme: "Aerial movement, stealth routes, hidden paths",
    rewards: [
      "Better stealth cards and stealth stat boosts",
      "Lightweight board components",
      "Air-route mission bonuses",
      "Ozzies from high-altitude deliveries",
    ],
    risks: [
      "Fall damage — temporary Speed reduction",
      "Card lockout due to injury",
      "Component damage on rough landings",
    ],
    primaryStat: "stealth",
  },
  {
    district: "Batteryville",
    theme: "Energy, gear, batteries, and tech",
    rewards: [
      "Battery components and tech boosts",
      "Energy-related mission buffs",
      "Ozzies from salvaged parts",
      "Tech stat increases",
    ],
    risks: [
      "Component burnout — repair cooldown required",
      "Tech stat damage from overload",
      "Temporary card lockout for repairs",
    ],
    primaryStat: "grit",
  },
  {
    district: "The Roads",
    theme: "Street travel, danger, territory",
    rewards: [
      "Range and Speed boosts",
      "Street reputation Ozzies",
      "Travel-based mission unlocks",
      "District standing rewards",
    ],
    risks: [
      "-10 Range on one or two included Crew cards on mission failure",
      "Jail time — temporary card lockout",
      "Deck component damage",
    ],
    primaryStat: "range",
  },
  {
    district: "Nightshade",
    theme: "Stealth, shadow routes, covert operations",
    rewards: [
      "Stealth stat bonuses",
      "Shadow-route access unlocks",
      "Ozzies from covert deliveries",
    ],
    risks: [
      "Temporary Stealth reduction if caught",
      "Card impound event",
      "Component corrosion",
    ],
    primaryStat: "stealth",
  },
  {
    district: "The Grid",
    theme: "Surveillance, tech, corporate territory",
    rewards: [
      "Tech boosts and component upgrades",
      "High-value Ozzy rewards",
      "Speed bonuses from optimised routes",
    ],
    risks: [
      "Trace event — temporary lockout",
      "Speed reduction from grid interference",
      "Component burnout",
    ],
    primaryStat: "speed",
  },
  {
    district: "The Forest",
    theme: "Rough terrain, salvage, endurance",
    rewards: [
      "Grit stat bonuses",
      "Salvage components and repair parts",
      "Durability-related Ozzies",
    ],
    risks: [
      "Grit damage from rough routes",
      "Equipment corrosion",
      "Failed repair events",
    ],
    primaryStat: "grit",
  },
] as const;

// ── Component upgrade rules ───────────────────────────────────────────────────

/**
 * Component upgrade principle: components can only be upgraded within their
 * rarity class.
 *
 * Example allowed upgrades:
 *   Common Battery → Common Battery +1 → Common Battery +2
 *
 * Cross-class promotion is NOT allowed via upgrades.  A Rare Battery must be
 * earned, traded, or rewarded — not forged from a Common Battery.
 *
 * This rule prevents infinite power escalation and protects the no-pay-to-win
 * philosophy.
 */
export const COMPONENT_UPGRADE_RULES = {
  allowCrossClassUpgrade: false,
  maxUpgradeStepsWithinClass: 3,
  description:
    "Components can only be upgraded within their rarity class. " +
    "To obtain a higher-class component, earn or trade for it — never forge up from a lower class.",
} as const;

// ── Progression terminology ───────────────────────────────────────────────────

/**
 * Concise canonical definitions for the four progression axes.
 * Used in help text, tooltips, and onboarding copy.
 */
export const PROGRESSION_TERMINOLOGY = {
  XP:
    "XP shows what you have done. Earned through missions, battles, login streaks, and gameplay. Starts at 0 and can reach 100,000,000 per card.",
  Points:
    "Points show what your cards can do. The individual stat numbers on each card (Speed, Range, Stealth, Grit). Mission outcomes can raise or lower these.",
  DeckPower:
    "Deck Power shows how strong your Crew is. The combined Points of all stats on all 6 cards in your active Crew. Reaching certain thresholds unlocks higher rarity forges.",
  Ozzies:
    "Ozzies show how valuable and respected your collection is. Each card carries an Ozzy value. Crew Ozzies = sum across your active 6-card deck. Account Ozzies = sum across your entire collection.",
} as const;

// ── Signup bonus ──────────────────────────────────────────────────────────────

/**
 * Rarity of the card rewarded to players upon first signup / account creation.
 *
 * Rare was chosen as the starting bonus tier to give new players a meaningful
 * head start — meaningful enough to feel exciting, but not so powerful that it
 * trivialises early progression.  Players still need to build their collection
 * through play to unlock Master and Legendary tiers.
 *
 * Defined here so the onboarding flow, server, and tests reference a single
 * constant rather than a magic string.
 */
export const SIGNUP_BONUS_RARITY: Rarity = "Rare";

// ── Legendary forge restriction ───────────────────────────────────────────────

/**
 * Legendary cards cannot be forged.  They can only be earned through:
 *   - Gameplay milestones
 *   - Special missions
 *   - Achievements
 *   - Events
 *   - Leaderboard rewards
 *
 * No pay-to-win path exists to Legendary status.
 */
export const LEGENDARY_EARN_ONLY_NOTICE =
  "Legendary cannot be forged. It can only be earned through gameplay, special missions, achievements, events, or leaderboard rewards.";
