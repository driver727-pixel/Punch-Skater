/**
 * sharedTypes.ts — Append-only contract file shared between Gamma and Charlie agents.
 *
 * Rules:
 *  1. Never remove or rename an existing type.
 *  2. New fields on existing interfaces must be optional (?:).
 *  3. Add new types at the bottom of the relevant section.
 *  4. Every addition must include a JSDoc comment with the sprint and owner.
 */

import type {
  Archetype,
  CardPayload,
  District,
  Faction,
  ForgedCardStats,
  JoustDifficulty,
  JoustOutcome,
  JoustTactic,
  WheelType,
} from "./types";

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
 * Counter tags used by live mission encounters and deck synergies.
 * @sprint 5 @owner gamma
 */
export type MissionCounterTag =
  | "mainline_speed"
  | "rough_route"
  | "shockproof"
  | "camera_blind"
  | "quiet_line"
  | "long_range"
  | "heavy_push"
  | "local_knowledge"
  | "regen_brake";

/**
 * Temporary deck modifier generated while a live mission run is active.
 * @sprint 5 @owner gamma
 */
export interface MissionStatusEffect {
  id: string;
  label: string;
  summary: string;
  kind?: "bonus" | "penalty" | "synergy";
  stat?: MissionStat;
  powerDelta?: number;
  source?: string;
}

/**
 * Live counter option shown when a mission encounter interrupts a run.
 * @sprint 5 @owner gamma
 */
export interface MissionEncounterOption {
  id: string;
  label: string;
  description: string;
  /** @sprint 6 @owner gamma — `counter` uses tag/power checks, while `joust` resolves through jousting-lite with a tactic pick. */
  encounterType?: "counter" | "joust";
  requirements?: MissionRequirement[];
  requiredTags?: MissionCounterTag[];
  minimumCounterPower?: number;
  rewardXpDelta?: number;
  rewardOzziesDelta?: number;
  joustDifficulty?: JoustDifficulty;
  joustPrompt?: string;
  available?: boolean;
  currentPower?: number;
  successSummary?: string;
  failureSummary?: string;
}

/**
 * Stored jousting-lite resolution for a mission encounter.
 * @sprint 6 @owner gamma
 */
export interface MissionJoustResult {
  playerCardId: string;
  playerName: string;
  rivalName: string;
  /** @sprint 6 @owner gamma — Optional named district rival id when the duel maps to the rival catalogue. */
  rivalId?: string;
  playerTactic: JoustTactic;
  rivalTactic: JoustTactic;
  difficulty: JoustDifficulty;
  outcome: JoustOutcome;
  strike: number;
  narration: string;
  rewardXpBonus: number;
  rewardOzziesBonus: number;
  /** @sprint 6 @owner gamma — Codex unlock ids emitted by a named-rival win. */
  loreUnlockIds?: string[];
  /** @sprint 6 @owner gamma — Stable card reward id emitted by a named-rival win. */
  cardRewardId?: string;
  /** @sprint 6 @owner gamma — Named-rival district reputation gained on victory. */
  districtReputationDelta?: number;
  /** @sprint 7 @owner gamma — Expressive bonus signals attached to this joust resolution. */
  rewardSignals?: MissionRewardSignal[];
  /** @sprint 7 @owner gamma — Rival pressure snapshot that framed this joust. */
  rivalPressure?: MissionRivalPressure | null;
}

/**
 * Persisted per-card maintenance fallout emitted when a mission resolves.
 * @sprint 6 @owner gamma
 */
export interface MissionCardOutcome {
  cardId: string;
  cardName: string;
  outcomeKind: "repair" | "impound" | "offline";
  maintenanceState: "in_shop" | "impounded";
  recapDisposition: "lag" | "drop" | "offline";
  label: string;
  summary: string;
  detail: string;
  repairEndsAt?: string;
}

/**
 * Mid-run encounter that replaces the old pre-launch blind route pick.
 * @sprint 5 @owner gamma
 */
export interface MissionEncounter {
  id: string;
  badge: string;
  prompt: string;
  threat: string;
  options: MissionEncounterOption[];
}

/**
 * Phase marker for staged mission runs.
 * @sprint 5 @owner gamma
 */
export type MissionRunPhase = "idle" | "event" | "resolved";

/**
 * Temporary live state persisted while a mission run waits for a counter choice.
 * @sprint 5 @owner gamma
 */
export interface MissionActiveRunState {
  phase: MissionRunPhase;
  launchedAt: string;
  resolvedAt?: string;
  deckId: string;
  deckName: string;
  encounterId?: string;
  activeCardIds?: string[];
  synergyTags?: MissionCounterTag[];
  statusEffects?: MissionStatusEffect[];
  availableCounterOptionIds?: string[];
  selectedCounterOptionId?: string;
  selectedJoustTactic?: JoustTactic | null;
  counterPower?: number;
  summary?: string;
  /** @sprint 7 @owner gamma — Route-story beats generated for the live run. */
  storyBeats?: MissionStoryBeat[];
  /** @sprint 7 @owner gamma — Board-derived crew identities active on this run. */
  boardPlaystyles?: MissionBoardPlaystyle[];
  /** @sprint 7 @owner gamma — Rival memory and heat level for named district jousts. */
  rivalPressure?: MissionRivalPressure | null;
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
  /** @sprint 5 @owner gamma — Optional live encounter that fires after launch. */
  encounter?: MissionEncounter;
  selectedDeckId?: string;
  selectedDeckName?: string;
  /** @sprint 3 @owner gamma — Selected fork option used for evaluation and rewards. */
  selectedForkOptionId?: string;
  /** @sprint 5 @owner gamma — Selected live counter option used to resolve encounter rewards. */
  selectedCounterOptionId?: string;
  /** @sprint 5 @owner gamma — Temporary live run state while the mission waits for player agency. */
  activeRun?: MissionActiveRunState;
  lastRunAt?: string;
  lastRunSucceeded?: boolean;
  lastRunSummary?: string;
  lastRunFailureReasons?: string[];
  /** @sprint 5 @owner gamma — Dynamic hardware and synergy effects observed during the last run. */
  lastRunEffects?: MissionStatusEffect[];
  /** @sprint 6 @owner gamma — Locked mission XP actually awarded on the last resolved run. */
  lastRunRewardXp?: number;
  /** @sprint 6 @owner gamma — Locked Ozzy payout actually awarded on the last resolved run. */
  lastRunRewardOzzies?: number;
  /** @sprint 6 @owner gamma — Optional jousting-lite result for runs that escalated into a duel. */
  lastRunJoustResult?: MissionJoustResult | null;
  /** @sprint 6 @owner gamma — Persisted card-level maintenance fallout from the last resolved run. */
  lastRunCardOutcomes?: MissionCardOutcome[];
  /** @sprint 7 @owner gamma — Route-story beats captured for the last launch or resolution. */
  lastRunStoryBeats?: MissionStoryBeat[];
  /** @sprint 7 @owner gamma — Expressive reward signals earned on the last resolved run. */
  lastRunRewardSignals?: MissionRewardSignal[];
  /** @sprint 7 @owner gamma — Board-derived crew identities captured on the last run. */
  lastRunBoardPlaystyles?: MissionBoardPlaystyle[];
  /** @sprint 7 @owner gamma — Rival memory snapshot attached to the last run. */
  lastRunRivalPressure?: MissionRivalPressure | null;
  /** @sprint 8 @owner gamma — Grid coordinates for this mission entry on the board. */
  coordinates?: { x: number; y: number };
  /** @sprint 8 @owner gamma — Point of interest type for this location. */
  poiType?: string;
  /** @sprint 8 @owner gamma — Whether this location has been scanned. */
  isScanned?: boolean;
  /** @sprint 8 @owner gamma — Threat level indicator for this location. */
  threatLevel?: number;
}

/**
 * Persistent mission-board progression totals stored on the user profile.
 * @sprint 2 @owner gamma
 */
export interface MissionBoardProgression {
  missionXp: number;
  missionOzzies: number;
  /** @sprint 6 @owner gamma — Total district reputation banked from named rival wins. */
  districtReputation?: number;
  /** @sprint 6 @owner gamma — Stable rival ids already defeated by this account. */
  defeatedRivalIds?: string[];
  /** @sprint 6 @owner gamma — Stable Codex ids unlocked through rival progression. */
  codexUnlockIds?: string[];
  /** @sprint 7 @owner gamma — Per-rival memory used to surface rematches and grudges. */
  rivalRecords?: Record<string, MissionRivalRecord>;
}

/**
 * Weekly mission-board flavor and soft reward modifier.
 * @sprint 4 @owner gamma
 */
export interface MissionBoardTheme {
  id: string;
  label: string;
  summary: string;
  featuredDistricts?: District[];
  rewardXpBonus?: number;
  rewardOzziesBonus?: number;
}

/**
 * API payload returned when loading the mission board.
 * @sprint 2 @owner gamma
 */
export interface MissionBoardPayload {
  missions: MissionBoardEntry[];
  progression: MissionBoardProgression;
  /** @sprint 4 @owner gamma — Stable YYYY-MM-DD key for today's mission board. */
  boardDateKey?: string;
  /** @sprint 4 @owner gamma — ISO timestamp for the next daily mission reset. */
  dailyResetAt?: string;
  /** @sprint 4 @owner gamma — Weekly layer that flavors the current mission cycle. */
  weeklyTheme?: MissionBoardTheme;
  /** @sprint 8 @owner gamma — ID of the active courier card being tracked on the board. */
  activeCourierCardId?: string;
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
  statusEffects?: MissionStatusEffect[];
  synergyTags?: MissionCounterTag[];
  activeCardIds?: string[];
  counterPower?: number;
  /** @sprint 7 @owner gamma — Board-derived crew identities inferred during preflight. */
  boardPlaystyles?: MissionBoardPlaystyle[];
}

/**
 * Board-driven crew identity surfaced during mission prep and live runs.
 * @sprint 7 @owner gamma
 */
export interface MissionBoardPlaystyle {
  id: string;
  label: string;
  summary: string;
  powerDelta?: number;
}

/**
 * Structured route beat used to turn a mission run into a short story.
 * @sprint 7 @owner gamma
 */
export interface MissionStoryBeat {
  id: string;
  stage: "launch" | "pressure" | "finish";
  label: string;
  summary: string;
  tone?: "neutral" | "risk" | "reward";
}

/**
 * Expressive bonus signal that adds texture to mission rewards.
 * @sprint 7 @owner gamma
 */
export interface MissionRewardSignal {
  id: string;
  label: string;
  summary: string;
  rewardXpDelta?: number;
  rewardOzziesDelta?: number;
}

/**
 * Per-rival history stored on the user profile for rematches and grudges.
 * @sprint 7 @owner gamma
 */
export interface MissionRivalRecord {
  rivalId: string;
  wins: number;
  losses: number;
  draws: number;
  seenCount: number;
  lastOutcome?: JoustOutcome;
  streak?: number;
  lastSeenAt?: string;
}

/**
 * Snapshot of the current named-rival heat carried into a mission run.
 * @sprint 7 @owner gamma
 */
export interface MissionRivalPressure {
  rivalId: string;
  rivalName: string;
  heat: number;
  status: "fresh" | "known" | "grudge";
  summary: string;
  taunt?: string;
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
  awaitingChoice?: boolean;
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
