/**
 * jousturTypes.ts — Shared TypeScript types for Joustur Skatur™.
 *
 * These types mirror the server-side JavaScript structures in
 * server/lib/jousturRules.js exactly so the client can consume match state
 * without any casting.
 *
 * Board layout (tile-path based):
 *   Each player traverses their own ordered path of 14 tiles.
 *   A rider's "position" is their 1-based index along the path (1–14).
 *   0 = off-board (not yet entered), 15 = exited / scored.
 *
 *   Player 1 path tiles: 4, 3, 2, 1, 7, 8, 9, 10, 11, 12, 13, 14, 6, 5
 *   Player 2 path tiles: 18, 17, 16, 15, 7, 8, 9, 10, 11, 12, 13, 14, 20, 19
 *
 *   Shared zone: path indices 5–12 (tiles 7–14 for both paths)
 *   Private zones: indices 1–4 (entry) and 13–14 (exit)
 *
 * Stealth Alcoves (by path index): 4, 6, 8, 12, 14
 */

// ── Enums / union types ───────────────────────────────────────────────────────

/** Six Joustur factions mapped from existing Punch Skater™ crews. */
export type JousturFaction =
  | "rustKids"         // Punch Skater™s
  | "neonSaints"       // Ne0n Legion
  | "signalGhosts"     // Qu111s (Quills)
  | "chromeSyndicate"  // The Team
  | "voltageVultures"  // Iron Curtains
  | "alleyWraiths";    // The Asclepians

/** Eight distinct Joustur rider traits. */
export type JousturTrait =
  | "boost"
  | "guard"
  | "feint"
  | "anchor"
  | "strike"
  | "slip"
  | "surge"
  | "echo";

/** Fixed faction passive abilities. */
export type JousturFactionPassive =
  | "patchworkRush"   // Rust Kids
  | "crowdHalo"       // Neon Saints
  | "ghostRoute"      // Signal Ghosts
  | "precisionCast"   // Chrome Syndicate
  | "surgeTrigger"    // Voltage Vultures
  | "cutline";        // Alley Wraiths

/** Support card one-time activation effects. */
export type JousturSupportEffect =
  | "recoveryPing"  // Rust Kids
  | "crowdRoar"     // Neon Saints
  | "smokeScreen"   // Signal Ghosts
  | "reroll"        // Chrome Syndicate
  | "overclock"     // Voltage Vultures
  | "sideRoute";    // Alley Wraiths

export type JousturClashStance = "charge" | "guard" | "feint";

export type JousturChallengeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type JousturMatchStatus = "initializing" | "active" | "completed" | "cancelled";

export type JousturMatchMode = "friend" | "casual" | "solo";

// ── Lineup ────────────────────────────────────────────────────────────────────

/** Persistent lineup doc stored at `jousturLineups/{uid}`. */
export interface JousturLineup {
  uid: string;
  /** Exactly 6 rider card IDs. */
  riderCardIds: string[];
  supportCardId: string;
  updatedAt: string;
}

// ── Snapshots (static card info captured at match creation) ──────────────────

export interface JousturRiderSnapshot {
  cardId: string;
  name: string;
  rarity: string;
  /** Original Punch Skater™ crew string (e.g. "Ne0n Legion"). */
  crew: string;
  jousturTrait: JousturTrait;
  jousturFaction: JousturFaction;
  characterImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  boardImageUrl?: string | null;
  frameImageUrl?: string | null;
}

export interface JousturSupportSnapshot {
  cardId: string;
  name: string;
  rarity: string;
  crew: string;
  jousturFaction: JousturFaction;
  supportEffect: JousturSupportEffect;
  characterImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  boardImageUrl?: string | null;
  frameImageUrl?: string | null;
}

// ── Runtime state (mutable during a match) ───────────────────────────────────

export interface JousturRiderRuntimeState {
  cardId: string;
  /**
   * Current board position.
   *   0  = off-board / captured
   *   1–14 = on the track
   *   15 = scored / exited
   */
  position: number;
  isScored: boolean;
  /** True when the rider was sent back to OFF_BOARD by an opponent capture. */
  isCaptured: boolean;
}

export interface JousturSupportRuntimeState {
  activated: boolean;
  activatedOnTurn?: number;
}

export interface JousturPlayerState {
  uid: string;
  faction: JousturFaction;
  factionPassive: JousturFactionPassive;
  /** Static card snapshots (ordered, index matches riders[]). */
  lineup: JousturRiderSnapshot[];
  support: JousturSupportSnapshot;
  /** Runtime positions for each of the 6 riders. */
  riders: JousturRiderRuntimeState[];
  supportRuntime: JousturSupportRuntimeState;
  /** How many riders have been scored (exited at position 15). */
  scoredCount: number;
  /**
   * Ordered tile path for this player.
   * Player 1 (challenger): [4, 3, 2, 1, 7, 8, 9, 10, 11, 12, 13, 14, 6, 5]
   * Player 2 (defender):   [18, 17, 16, 15, 7, 8, 9, 10, 11, 12, 13, 14, 20, 19]
   */
  playerPath: number[];
}

export interface JousturBoardState {
  /** Monotonically increasing turn counter (starts at 1). */
  turn: number;
  activePlayerUid: string;
  /**
   * Current dice roll total (0–3, or higher after overclock).
   * `null` means the roll has not been generated yet for this turn.
   */
  rollResult: number | null;
  /** Individual dice results array (each 0 or 1); null when not yet rolled. */
  diceResults: number[] | null;
  /** The last completed roll total (for opponent visibility). */
  lastRollResult: number | null;
  /** Individual dice from the last completed roll. */
  lastDiceResults: number[] | null;
  /** UID of the player who made the last roll. */
  lastRollPlayerUid: string | null;
  /**
   * UID of the player whose riders are immune to capture for this turn
   * (set by smokeScreen support activation).  Null when inactive.
   */
  smokeScreenUid: string | null;
  /** The turn number after which the smoke screen expires. */
  smokeScreenExpiresAfterTurn: number | null;
  clash: JousturClashState | null;
}

export interface JousturClashState {
  attackerUid: string;
  defenderUid: string;
  attackerCardId: string;
  defenderCardId: string;
  tile: number;
  attackerChoice: JousturClashStance | null;
  defenderChoice: JousturClashStance | null;
  attackerChoiceLocked: boolean;
  defenderChoiceLocked: boolean;
  startedOnTurn: number;
}

// ── Match ─────────────────────────────────────────────────────────────────────

/** Full match document stored at `jousturMatches/{id}`. */
export interface JousturMatch {
  id: string;
  status: JousturMatchStatus;
  mode: JousturMatchMode;
  challengerUid: string;
  defenderUid: string;
  board: JousturBoardState;
  /**
   * Null only while status === "initializing" (player states are being built).
   * Always present for "active" / "completed" / "cancelled" matches.
   */
  challengerState: JousturPlayerState | null;
  defenderState: JousturPlayerState | null;
  winnerUid: string | null;
  /** Prevents duplicate reward grants. */
  rewardsGranted: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /**
   * Hydrated by GET /match/:id when board.rollResult !== null and the caller
   * is the active player.  Not persisted — computed on read.
   */
  legalMoves?: JousturLegalMove[];
  /** Hydrated alongside legalMoves. */
  canActivateSupport?: { canActivate: boolean; reason: string | null };
}

// ── Turn log ──────────────────────────────────────────────────────────────────

/** One entry per turn in `jousturMatches/{id}/turns/{turnId}`. */
export interface JousturTurnLogEntry {
  id: string;
  matchId: string;
  turn: number;
  playerUid: string;
  rollResult: number;
  /** cardId of the rider that moved; null if the player passed. */
  movedCardId: string | null;
  fromPosition: number;
  toPosition: number;
  capturedCardId: string | null;
  extraTurn: boolean;
  supportActivated: boolean;
  supportEffect?: JousturSupportEffect;
  events?: Array<Record<string, unknown>>;
  summary: string;
  timestamp: string;
}

// ── Challenge ─────────────────────────────────────────────────────────────────

/** Stored at `jousturChallenges/{id}`. */
export interface JousturChallenge {
  id: string;
  status: JousturChallengeStatus;
  challengerUid: string;
  challengerDisplayName: string;
  defenderUid: string;
  defenderDisplayName: string;
  /** Set when the challenge is accepted and a match is created. */
  matchId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** A legal move computed by the rules engine. */
export interface JousturLegalMove {
  cardId: string;
  fromPosition: number;
  toPosition: number;
  isExitMove: boolean;
  wouldCapture: boolean;
  capturedCardId: string | null;
}

/** The player's submitted action for the move step. */
export interface JousturMoveChoice {
  /** The rider card to move.  Null when passing or when only activating support. */
  cardId: string | null;
  activateSupport: boolean;
  /** Required by sideRoute — which rider to teleport. */
  supportTargetCardId?: string;
}

export interface JousturClashChoice {
  stance: JousturClashStance;
}

/** Reward values granted to one player after a completed match. */
export interface JousturPlayerReward {
  xp: number;
  ozzies: number;
}

export interface JousturMatchRewards {
  challenger: JousturPlayerReward;
  defender: JousturPlayerReward;
}

// ── UI display helpers ────────────────────────────────────────────────────────

/**
 * Human-readable names for each Joustur faction key.
 * Defined once here so all pages stay in sync automatically.
 */
export const JOUSTUR_FACTION_LABELS: Record<string, string> = {
  rustKids:        "Rust Kids",
  neonSaints:      "Neon Saints",
  signalGhosts:    "Signal Ghosts",
  chromeSyndicate: "Chrome Syndicate",
  voltageVultures: "Voltage Vultures",
  alleyWraiths:    "Alley Wraiths",
};
