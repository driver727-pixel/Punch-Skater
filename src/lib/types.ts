/**
 * types.ts
 */
export type { BoardType, Drivetrain, MotorType, WheelType, BatteryType, BoardConfig, BoardLoadout } from "./boardBuilder";
export type Faction =
  | "United Corporations of America (UCA)"
  | "Qu111s (Quills)"
  | "Ne0n Legion"
  | "Iron Curtains"
  | "D4rk $pider"
  | "The Asclepians"
  | "The Mesopotamian Society"
  | "The Knights Technarchy"
  | "Hermes' Squirmies"
  | "UCPS Workers"
  | "The Team"
  | "Moonrisers"
  | "The Wooders"
  | "Punch Skaters";

export type District = "Airaway" | "Batteryville" | "The Grid" | "Nightshade" | "The Forest" | "Glass City";
export type HiddenDistrict = "Electropolis";
export type CorridorHub = "The Roads";
export type WorldLocation = District | HiddenDistrict | CorridorHub;
export type RoadCorridor = "Surface Corridor" | "Freight Artery" | "Underpass Tunnel" | "Timber Route";
export type Archetype =
  | "The Knights Technarchy"
  | "Qu111s"
  | "Ne0n Legion"
  | "Iron Curtains"
  | "D4rk $pider"
  | "The Asclepians"
  | "The Mesopotamian Society"
  | "Hermes' Squirmies"
  | "UCPS"
  | "The Team";
export type Rarity = "Punch Skater" | "Apprentice" | "Master" | "Rare" | "Legendary";
export const PUNCH_SKATER_RARITY: Rarity = "Punch Skater";
/** @deprecated Vibe was removed from the forge UI. */
export type Vibe = "Grunge" | "Neon" | "Chrome" | "Plastic" | "Recycled";
export type Style =
  | "Corporate"
  | "Punk Rocker"
  | "Ex Military"
  | "Fascist"
  | "Street"
  | "Off-grid"
  | "Union"
  | "Olympic";
export type Gender = "Woman" | "Man" | "Non-binary";
export type AgeGroup = "Young Adult" | "Adult" | "Middle-aged" | "Senior";
export type BodyType = "Slim" | "Athletic" | "Average" | "Stocky" | "Heavy";
export type HairLength = "Bald" | "Short" | "Medium" | "Long";
export type HairColor = "Black" | "Brown" | "Blonde" | "Red" | "Gray" | "White" | "Auburn" | "Dyed Bright";
export type SkinTone = "Very Light" | "Light" | "Medium Light" | "Medium" | "Medium Dark" | "Dark" | "Very Dark";
export type FaceCharacter = "Conventional" | "Attractive" | "Weathered" | "Scarred" | "Asymmetric" | "Rugged" | "Baby-faced" | "Gaunt" | "Round-faced";
export type ShoeStyle = "Skate Shoes" | "High Tops" | "Chunky Sneakers" | "Work Boots" | "Trail Runners";

export interface CardPrompts {
  archetype: Archetype;
  rarity: Rarity;
  style: Style;
  /** @deprecated Kept for legacy card compatibility; no longer shown in the forge UI. */
  vibe?: Vibe;
  district: District;
  accentColor: string;
  gender: Gender;
  ageGroup: AgeGroup;
  bodyType: BodyType;
  hairLength?: HairLength;
  hairColor?: HairColor;
  skinTone?: SkinTone;
  faceCharacter?: FaceCharacter;
  shoeStyle?: ShoeStyle;
}

// ── Forged card sub-types ─────────────────────────────────────────────────────

export type MaintenanceState = "active" | "in_shop" | "impounded";

export interface RoleBonusSet {
  speed: number;
  range: number;
  stealth: number;
  grit: number;
}

export interface ForgedRoleData {
  archetype: Archetype;
  label: string;
  coverRole: string;
  passiveName: string;
  passiveDescription: string;
  roleBonuses: RoleBonusSet;
}

export interface ForgedVarianceData {
  speed: number;
  range: number;
  stealth: number;
  grit: number;
}

export interface ForgedCardStats {
  speed: number;
  range: number;
  rangeNm: number;
  stealth: number;
  grit: number;
}

export interface ForgedBoardComponents {
  boardType: string;
  drivetrain: string;
  motor: string;
  wheels: string;
  battery: string;
}

export interface LayerPlacement {
  /** Center X position on the front artwork, as a percentage of card width. */
  xPercent: number;
  /** Center Y position on the front artwork, as a percentage of card height. */
  yPercent: number;
  /** Locked-dimension board size multiplier. */
  scale: number;
  /** Board orientation in degrees. */
  rotationDeg: number;
}

export type BoardPlacement = LayerPlacement;

export type CharacterPlacement = LayerPlacement;

export type CompositeLayerOrder = "behind-character" | "in-front";

export interface ForgedBoardData {
  config: import("./boardBuilder").BoardConfig;
  loadout?: import("./boardBuilder").BoardLoadout;
  imageUrl?: string;
  placement?: BoardPlacement;
  layerOrder?: CompositeLayerOrder;
  totalWeight: number;
  tuned: boolean;
  components: ForgedBoardComponents;
  loadoutSummary: string;
  accessProfile: string;
}

export interface ForgedMaintenanceData {
  state: MaintenanceState;
  chargePct: number;
  repairMinutes: number;
  repairEndsAt?: string;
  fastTrackCreditCost?: number;
}

// ── Card payload ──────────────────────────────────────────────────────────────

export interface CardPayload {
  id: string;
  version: string;
  createdAt: string;

  /** Master seed: "frameSeed::backgroundSeed::characterSeed" */
  seed: string;
  /** Derived per-layer cache keys */
  frameSeed: string;
  backgroundSeed: string;
  characterSeed: string;

  prompts: CardPrompts;

  class: {
    rarity: Rarity;
    multiplier: number;
    badgeLabel: string;
  };

  identity: {
    name: string;
    crew: Faction;
    serialNumber: string;
    /** User-defined age displayed on the card beneath the character name. */
    age?: string;
  };

  role: ForgedRoleData;

  variance: ForgedVarianceData;

  stats: ForgedCardStats;

  board: ForgedBoardData;

  maintenance: ForgedMaintenanceData;

  visuals: {
    helmetStyle: string;
    jacketStyle: string;
    colorScheme: string;
    accentColor: string;
    storagePackStyle: string;
  };

  front: {
    flavorText?: string;
    flavorTextEnglish?: string;
    flavorTextConlang?: string;
    craftlingua?: {
      shareCode?: string;
      exploreUrl?: string;
      languageName?: string;
      languageCode?: string;
      source?: "district-default" | "profile-link" | "local-profile";
    };
  };

  back: {
    notes?: string;
  };

  /** Layered AI art URLs */
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  characterPlacement?: CharacterPlacement;

  /**
   * Accumulated gameplay experience for this card.
   * Starts at 0; maximum is 100,000,000.
   * Earned through missions, battles, login streaks, and other gameplay.
   * XP shows what you have done — it represents how seasoned a card is.
   */
  xp?: number;

  /**
   * Earned Ozzy value for this card.
   * Assigned randomly at forge time (seeded by card prompts) and can increase
   * through missions and special events.
   * Ozzies show how valuable and respected a card is in the world of Sk8rpunk.
   * Account Ozzies = sum across the entire collection.
   * Crew Ozzies = sum across the active 6-card Crew.
   */
  ozzies?: number;
}

// ── Deck payload ──────────────────────────────────────────────────────────────

export interface DeckPayload {
  id: string;
  version: string;
  name: string;
  cards: CardPayload[];
  createdAt: string;
  updatedAt: string;
  /** Persistent display order for deck lists. Lower values appear first. */
  sortOrder?: number;
  /** Whether this deck is readied for battle in the multiplayer arena. */
  battleReady?: boolean;
  /**
   * Whether this is the player's primary public deck.
   * Cards in the primary deck are challengeable in the Race Arena, and the
   * card flagged as `challengerCardId` represents the player on the starting grid.
   * At most one deck per user should be primary.
   */
  isPrimary?: boolean;
  /**
   * ID of the single card in this deck that acts as the player's "Challenger".
   * Used by the Race Arena to display this deck on the starting grid and to
   * pre-select the racing card when this player issues a challenge.
   */
  challengerCardId?: string;
}

// ── Battle payload ──────────────────────────────────────────────────────────

/** Stat keys used for wager deduction and battle resolution. */
export type StatKey = "speed" | "range" | "stealth" | "grit";

/** Minimal public card snapshot used for readying decks and resolving battles. */
export interface BattleCardSnapshot {
  id: string;
  archetype: Archetype;
  stats: CardPayload["stats"];
}

/** Exact post-battle stats to apply to a player's affected cards. */
export interface BattleCardResolution {
  id: string;
  stats: CardPayload["stats"];
}

/** Public scouting data shown for battle-ready decks in the arena. */
export interface ArenaDeckSummary {
  deckPower: number;
  strongestStat: StatKey;
  strongestStatTotal: number;
  synergyBonusPct: number;
  archetypeHint: string;
}

/** A public arena listing with limited scouting details for matchmaking. */
export interface ArenaEntry {
  uid: string;
  displayName: string;
  deckId: string;
  deckName: string;
  cardCount: number;
  battleSummary?: ArenaDeckSummary;
  battleDeck?: BattleCardSnapshot[];
  /** Timestamp when the deck was readied. */
  readiedAt: string;
}

/** Outcome stored after a battle completes. */
export interface BattleResult {
  id: string;
  challengerUid: string;
  challengerDeckId: string;
  challengerDeckName: string;
  defenderUid: string;
  defenderDeckId: string;
  defenderDeckName: string;
  winnerUid: string;
  challengerScore: number;
  defenderScore: number;
  wagerPoints: number;
  /** Card IDs in the winning deck that can receive bonus points. */
  winningDeckCardIds: string[];
  challengerCardResolutions: BattleCardResolution[];
  defenderCardResolutions: BattleCardResolution[];
  createdAt: string;
}

// ── Race Arena ──────────────────────────────────────────────────────────────

/** Lifecycle states of a courier race challenge. */
export type RaceChallengeStatus = "pending" | "accepted" | "declined" | "cancelled" | "resolved";

/**
 * Minimal public snapshot of a card racing in the arena.
 * Keeps just enough information to drive the race resolver and animation.
 */
export interface RaceCardSnapshot {
  id: string;
  name: string;
  archetype: Archetype;
  rarity: Rarity;
  stats: ForgedCardStats;
  /** Optional preview image URL used by the race animation. */
  imageUrl?: string;
}

/**
 * A pending/accepted/declined courier race challenge between two players.
 * Stored in `challenges/{id}`. Server-only writes.
 */
export interface RaceChallenge {
  id: string;
  status: RaceChallengeStatus;
  challengerUid: string;
  challengerDisplayName: string;
  challengerCardId: string;
  challengerCardName: string;
  defenderUid: string;
  defenderDisplayName: string;
  defenderCardId: string;
  defenderCardName: string;
  defenderDeckId: string;
  /** Ozzies escrowed by the challenger when the challenge was issued. */
  ozzyWager: number;
  createdAt: string;
  updatedAt: string;
  /** Set when status transitions to resolved. */
  raceId?: string;
  /** Optional message to the defender. */
  message?: string;
}

/** A single tick in the precomputed race timeline. */
export interface RaceTimelineTick {
  /** Tick index (monotonically increasing). */
  t: number;
  /** Challenger track progress in [0, 1]. */
  challengerProgress: number;
  /** Defender track progress in [0, 1]. */
  defenderProgress: number;
  /** Challenger instantaneous speed (units/tick), useful for HUD. */
  challengerSpeed: number;
  /** Defender instantaneous speed (units/tick), useful for HUD. */
  defenderSpeed: number;
  /** Optional human-readable event at this tick (e.g. "Shortcut!"). */
  challengerEvent?: string;
  defenderEvent?: string;
}

export interface RaceCardDelta {
  ozzies: number;
  xp: number;
}

/** Settled outcome of a courier race. */
export interface RaceResult {
  winnerUid: string | null;
  /** Tick on which each card crossed the finish line; null if DNF. */
  challengerFinishTick: number | null;
  defenderFinishTick: number | null;
  /** Net Ozzy transfer applied at the moment the race resolved. */
  ozzyTransfer: {
    challenger: number;
    defender: number;
  };
  /** Per-card deltas applied to the racing cards (XP + Ozzies). */
  cardDeltas: {
    challenger: RaceCardDelta;
    defender: RaceCardDelta;
  };
  /** Optional small stat tweak applied to the winning card. */
  winnerStatBoost?: { stat: StatKey; amount: number };
  raceSeed: string;
}

/**
 * A precomputed race that both players replay. Stored in `races/{id}`.
 * Server-only writes; both participants may read.
 */
export interface Race {
  id: string;
  challengeId: string;
  challengerUid: string;
  defenderUid: string;
  challenger: RaceCardSnapshot;
  defender: RaceCardSnapshot;
  ozzyWager: number;
  /**
   * Number of laps in this race (>=1). Total race progress is `1.0` regardless
   * of laps; laps are a presentational concept the animation may use.
   */
  laps: number;
  /** Tick interval in milliseconds (typically 50ms over ~30s ⇒ 600 ticks). */
  tickMs: number;
  timeline: RaceTimelineTick[];
  result: RaceResult;
  createdAt: string;
}

// ── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | "race_challenge"
  | "race_accepted"
  | "race_declined"
  | "race_cancelled"
  | "race_finished";

export interface NotificationItem {
  id: string;
  uid: string;
  type: NotificationType;
  /** Short headline shown in toasts/inbox. */
  title: string;
  /** Optional longer description. */
  body?: string;
  /** Deep-link route when the user clicks the notification. */
  link?: string;
  /** Domain payload (challenge/race ids, etc). */
  data?: Record<string, string | number | boolean | null>;
  read: boolean;
  createdAt: string;
}

// ── Leaderboard payload ───────────────────────────────────────────────────────

/** A public leaderboard entry uploaded from a player's chosen deck/Crew. */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  /** Player-facing name for the active 6-card Crew/deck. */
  deckName: string;
  cardCount: number;
  /**
   * Deck Power = sum of all stat Points across all cards in the active Crew.
   * Deck Power shows how strong your Crew is.
   */
  deckPower: number;
  /**
   * Legacy stat-based deck worth (kept for backward compatibility).
   * New code should prefer crewOzzies.
   */
  ozzies: number;
  /**
   * Crew Ozzies = sum of each card's individual Ozzy value across the
   * active 6-card Crew.  Ozzies show how valuable and respected the Crew is.
   */
  crewOzzies?: number;
  /**
   * Crew XP = sum of XP across all cards in the active 6-card Crew.
   * XP shows what the Crew has done through gameplay.
   */
  crewXp?: number;
  /**
   * Combined leaderboard score:
   *   Deck Power + Crew Ozzies + (Crew XP / 10,000) + district reputation
   */
  leaderboardScore?: number;
  strongestStat: StatKey;
  strongestStatTotal: number;
  synergyBonusPct: number;
  archetypeHint: string;
  updatedAt: string;
}

// ── Trade payload ─────────────────────────────────────────────────────────────

export interface TradePayload {
  id: string;
  fromUid: string;
  fromEmail: string;
  toUid: string;
  toEmail: string;
  offeredCardId?: string;
  offeredCard: CardPayload;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

// ── CraftLingua types ─────────────────────────────────────────────────────────

export interface CraftlinguaWord {
  word: string;
  phonetic?: string;
  meaning: string;
  /** Which card field this word is intended to populate (e.g. "name"). */
  cardField?: string;
}

export interface CraftlinguaDistrictLanguage {
  district: District;
  slug: string;
  shareCode: string;
  language: {
    name: string;
    code: string;
  };
  descriptor: string;
  summary: string;
  sample: string;
  phrasebook?: Record<string, string>;
  vocabulary?: CraftlinguaWord[];
  exploreUrl?: string;
}

export interface CraftlinguaLink {
  shareCode: string;
  district: District;
  languageName: string;
  languageCode: string;
  exploreUrl: string;
  linkedAt: string;
}

export interface CraftlinguaEnvelope {
  source: "craftlingua";
  version: string;
  exportedAt: string;
  language: {
    name: string;
    code: string;
  };
  vocabulary?: CraftlinguaWord[];
  cards?: CardPayload[];
}

// ── Import types ──────────────────────────────────────────────────────────────

export interface ImportCardError {
  index: number;
  id?: string;
  errors: string[];
}

export interface ImportResult {
  accepted: CardPayload[];
  rejected: ImportCardError[];
  total: number;
  language?: CraftlinguaEnvelope["language"];
  vocabulary?: CraftlinguaWord[];
}
