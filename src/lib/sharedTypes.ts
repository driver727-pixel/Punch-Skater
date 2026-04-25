/**
 * sharedTypes.ts — Append-only contract file shared between Gamma and Charlie agents.
 *
 * Rules:
 *  1. Never remove or rename an existing type.
 *  2. New fields on existing interfaces must be optional (?:).
 *  3. Add new types at the bottom of the relevant section.
 *  4. Every addition must include a JSDoc comment with the sprint and owner.
 */

import type { Archetype, CardPayload, District, Faction, ForgedCardStats } from "./types";

// ── Daily Streaks (Gamma) ────────────────────────────────────────────────────

/** @sprint 0 @owner gamma — Per-user daily login streak. Doc ID = uid. */
export interface DailyStreak {
  uid: string;
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string;
  totalClaims: number;
  updatedAt: string;
}

// ── Missions (Gamma) ─────────────────────────────────────────────────────────

/** @sprint 0 @owner gamma */
export type MissionStatus = "active" | "completed" | "expired";

/**
 * Stat keys that missions may target. Excludes `rangeNm` (internal display
 * unit) so mission descriptions remain human-readable.
 * @sprint 1 @owner gamma
 */
export type MissionStat = Exclude<keyof ForgedCardStats, "rangeNm">;

/**
 * Typed union of all mission types. Replaces the old `type: string` field.
 * @sprint 1 @owner gamma
 */
export type MissionType =
  | "forge_card"             // forge any card
  | "forge_archetype"        // forge a card of a specific archetype
  | "win_battle"             // win N battles
  | "complete_district_run"  // complete a courier run in a specific district
  | "achieve_stat_threshold" // have a newly-forged card with a stat ≥ target
  | "daily_login"            // log in N days in a row
  | "trade_card"             // complete a trade
  | "build_deck";            // assemble a valid deck

/** @sprint 0 @owner gamma */
export interface Mission {
  id: string;
  uid: string;
  title: string;
  description: string;
  /** @sprint 0 @deprecated Use the typed `missionType` field instead. */
  type: string;
  target: number;
  progress: number;
  status: MissionStatus;
  rewardXp: number;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
  /** @sprint 1 @owner gamma — Typed mission kind, supersedes the legacy `type: string` field. */
  missionType?: MissionType;
  /** @sprint 1 @owner gamma — District context for district-specific missions. */
  district?: District;
  /** @sprint 1 @owner gamma — Archetype context for archetype-specific missions. */
  archetype?: Archetype;
  /** @sprint 1 @owner gamma — Faction context for faction-specific missions. */
  faction?: Faction;
  /** @sprint 1 @owner gamma — Stat targeted by `achieve_stat_threshold` missions. */
  stat?: MissionStat;
  /** @sprint 1 @owner gamma — Ozzies (in-world currency) awarded on completion. */
  rewardOzzies?: number;
}

/**
 * Discriminated union for events that can advance mission progress.
 * Emit one of these events after the matching user action completes.
 * @sprint 1 @owner gamma
 */
export type MissionEvent =
  | { type: "forge_card"; archetype: Archetype }
  | { type: "forge_archetype"; archetype: Archetype }
  | { type: "win_battle" }
  | { type: "complete_district_run"; district: District }
  | { type: "achieve_stat_threshold"; stat: MissionStat; value: number }
  | { type: "daily_login" }
  | { type: "trade_card" }
  | { type: "build_deck" };

// ── Battle Pass (Gamma) ──────────────────────────────────────────────────────

/** @sprint 0 @owner gamma */
export interface BattlePassState {
  uid: string;
  seasonId: string;
  tier: number;
  xp: number;
  xpToNextTier: number;
  isPremium: boolean;
  claimedRewards: number[];
  updatedAt: string;
}

// ── Crews (Charlie) ──────────────────────────────────────────────────────────

/** @sprint 0 @owner charlie */
export interface Crew {
  id: string;
  name: string;
  tag: string;
  leaderUid: string;
  memberUids: string[];
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

// ── Ranked Seasons (Charlie) ─────────────────────────────────────────────────

/** @sprint 0 @owner charlie */
export interface RankedSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

/** @sprint 0 @owner charlie */
export interface RankedEntry {
  uid: string;
  seasonId: string;
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  rank: number;
  updatedAt: string;
}

// ── Share Links (Charlie) ────────────────────────────────────────────────────

/** @sprint 0 @owner charlie */
export type ShareLinkType = "card" | "deck";

/** @sprint 0 @owner charlie */
export interface ShareLink {
  id: string;
  ownerUid: string;
  type: ShareLinkType;
  /** ID of the card or deck being shared. */
  targetId: string;
  /** Snapshot of the shared content at link-creation time. */
  snapshot: Partial<CardPayload> | Record<string, unknown>;
  views: number;
  createdAt: string;
  expiresAt?: string;
}

// ── Shared enums / constants ─────────────────────────────────────────────────

/** @sprint 0 @owner gamma — XP reward tiers used across battle pass, missions, and daily rewards. */
export const XP_REWARD = {
  DAILY_LOGIN: 50,
  MISSION_COMPLETE: 100,
  BATTLE_WIN: 75,
  BATTLE_LOSS: 25,
} as const;

export type XpRewardKey = keyof typeof XP_REWARD;
