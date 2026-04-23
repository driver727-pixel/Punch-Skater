/**
 * sharedTypes.ts — Append-only contract file shared between Gamma and Charlie agents.
 *
 * Rules:
 *  1. Never remove or rename an existing type.
 *  2. New fields on existing interfaces must be optional (?:).
 *  3. Add new types at the bottom of the relevant section.
 *  4. Every addition must include a JSDoc comment with the sprint and owner.
 */

import type { CardPayload } from "./types";

// ── Charge Up (Gamma) ────────────────────────────────────────────────────────

/** @sprint 1 @owner gamma — Charge Up forge event persisted per-user. Doc ID = uid. */
export interface ChargeUpState {
  uid: string;
  lastUsedAt: string;
  totalChargesUsed: number;
  updatedAt: string;
}

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

/** @sprint 0 @owner gamma */
export interface Mission {
  id: string;
  uid: string;
  title: string;
  description: string;
  type: string;
  target: number;
  progress: number;
  status: MissionStatus;
  rewardXp: number;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
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
