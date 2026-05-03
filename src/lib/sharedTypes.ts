/**
 * sharedTypes.ts — Append-only contract file shared between Gamma and Charlie agents.
 *
 * Rules:
 *  1. Never remove or rename an existing type.
 *  2. New fields on existing interfaces must be optional (?:).
 *  3. Add new types at the bottom of the relevant section.
 *  4. Every addition must include a JSDoc comment with the sprint and owner.
 */

import type { Archetype, CardPayload, District, Faction, ForgedCardStats, WheelType } from "./types";

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

/**
 * Requirement kinds used by the restored mission board.
 * @sprint 2 @owner gamma
 */
export type MissionRequirementType =
  | "min_cards"
  | "district_access"
  | "wheel_type"
  | "archetype"
  | "faction"
  | "stat_total"
  | "district_card";

/**
 * Deck-building requirement for a mission board contract.
 * @sprint 2 @owner gamma
 */
export interface MissionRequirement {
  type: MissionRequirementType;
  label: string;
  count?: number;
  district?: District;
  wheelTypes?: WheelType[];
  archetype?: Archetype;
  faction?: Faction;
  stat?: MissionStat;
}

/**
 * Per-requirement deck evaluation result for a mission board contract.
 * @sprint 2 @owner gamma
 */
export interface MissionRequirementResult {
  requirement: MissionRequirement;
  met: boolean;
  current: number;
  needed: number;
  detail: string;
}

/**
 * Restored fork-path option on a mission board contract.
 * @sprint 3 @owner gamma
 */
export interface MissionForkOption {
  id: string;
  label: string;
  description: string;
  requirements?: MissionRequirement[];
  rewardXpDelta?: number;
  rewardOzziesDelta?: number;
}

/**
 * Fork-path prompt shown before launching a mission run.
 * @sprint 3 @owner gamma
 */
export interface MissionFork {
  badge: string;
  prompt: string;
  options: MissionForkOption[];
}

/**
 * Restored server-authored mission board entry.
 * @sprint 2 @owner gamma
 */
export interface MissionBoardEntry {
  id: string;
  uid: string;
  system: "mission_board";
  schemaVersion: 2;
  definitionId: string;
  sortOrder: number;
  title: string;
  tagline: string;
  description: string;
  district: District;
  rewardXp: number;
  rewardOzzies: number;
  requirements: MissionRequirement[];
  status: MissionStatus;
  progress: number;
  target: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /** @sprint 3 @owner gamma — Optional fork prompt that changes requirements and rewards. */
  fork?: MissionFork;
  selectedDeckId?: string;
  selectedDeckName?: string;
  /** @sprint 3 @owner gamma — Selected fork option used for evaluation and rewards. */
  selectedForkOptionId?: string;
  lastRunAt?: string;
  lastRunSucceeded?: boolean;
  lastRunSummary?: string;
  lastRunFailureReasons?: string[];
}

/**
 * Persistent mission-board progression totals stored on the user profile.
 * @sprint 2 @owner gamma
 */
export interface MissionBoardProgression {
  missionXp: number;
  missionOzzies: number;
}

/**
 * API payload returned when loading the mission board.
 * @sprint 2 @owner gamma
 */
export interface MissionBoardPayload {
  missions: MissionBoardEntry[];
  progression: MissionBoardProgression;
}

/**
 * Evaluation of a chosen deck against one mission board contract.
 * @sprint 2 @owner gamma
 */
export interface MissionDeckEvaluation {
  deckId: string;
  deckName: string;
  eligible: boolean;
  eligibleCardCount: number;
  summary: string;
  results: MissionRequirementResult[];
}

/**
 * API payload returned after attempting a mission run.
 * @sprint 2 @owner gamma
 */
export interface MissionRunResponse {
  mission: MissionBoardEntry;
  evaluation: MissionDeckEvaluation;
  progression: MissionBoardProgression;
  rewardGranted: boolean;
}

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

// ── Mission risk/reward types (progression overhaul) ─────────────────────────

/**
 * Types of rewards a mission can grant to a card, Crew, or account.
 * @sprint 3 @owner gamma
 */
export type MissionRewardKind =
  | "xp"               // card XP
  | "stat_increase"    // increase a card's stat Points
  | "ozzies"           // Ozzy value for a card / the Crew / the account
  | "card"             // add a card to the player's collection
  | "component"        // add or upgrade a board component
  | "district_rep";    // district reputation standing

/**
 * Types of risks / penalties a mission can apply on failure.
 * @sprint 3 @owner gamma
 */
export type MissionRiskKind =
  | "stat_damage"       // decrease a card's stat Points (e.g. -10 Range)
  | "component_damage"  // damage a board component, requiring repair
  | "card_lockout"      // temporarily lock a card out of play
  | "repair_cooldown"   // add a repair cooldown to one or more cards
  | "jail_time"         // narrative lockout event (district-specific)
  | "event_lockout";    // generic time-based lockout

/**
 * A single reward item awarded by a mission run.
 * @sprint 3 @owner gamma
 */
export interface MissionReward {
  kind: MissionRewardKind;
  /** Human-readable label shown in the mission UI. */
  label: string;
  /** Numeric magnitude (e.g. XP amount, stat delta, Ozzy value). */
  amount?: number;
  /** Target stat key for stat_increase rewards. */
  stat?: MissionStat;
}

/**
 * A single risk item that may be applied on mission failure.
 * @sprint 3 @owner gamma
 */
export interface MissionRisk {
  kind: MissionRiskKind;
  /** Human-readable label shown in the mission UI. */
  label: string;
  /** Numeric magnitude (e.g. stat delta, lockout duration in minutes). */
  amount?: number;
  /** Target stat key for stat_damage risks. */
  stat?: MissionStat;
  /** Number of cards that may be affected (for multi-card risks). */
  cardCount?: number;
}
