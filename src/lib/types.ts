/**
 * types.ts
 */
export type { BoardType, Drivetrain, WheelType, BatteryType, BoardConfig, BoardLoadout } from "./boardBuilder";
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

export type District = "Airaway" | "The Roads" | "Batteryville" | "The Grid" | "Electropolis" | "Nightshade" | "The Forest" | "Glass City";
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
/** @deprecated Vibe was removed from the forge UI. Kept as a type alias for legacy card compatibility. */
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
export type BodyType = "Slim" | "Athletic" | "Average" | "Stocky" | "Heavy" | "Wiry" | "Pear-shaped" | "Lanky" | "Barrel-chested";
export type HairLength = "Bald" | "Buzzcut" | "Short" | "Medium" | "Long" | "Very Long";
export type HairColor = "Black" | "Brown" | "Blonde" | "Red" | "Gray" | "White" | "Auburn" | "Dyed Bright";
export type SkinTone = "Very Light" | "Light" | "Medium Light" | "Medium" | "Medium Dark" | "Dark" | "Very Dark";
export type FaceCharacter = "Conventional" | "Weathered" | "Scarred" | "Asymmetric" | "Rugged" | "Baby-faced" | "Gaunt" | "Round-faced";

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
}

// ── Conlang overlay (CraftLingua integration) ─────────────────────────────────

export interface ConlangOverlay {
  passiveTrait: string;
  activeAbility: string;
  flavorText: string;
  catchphrase: string;
  languageName: string;
  languageCode: string;
}

// ── Card payload ──────────────────────────────────────────────────────────────

export interface CardPayload {
  id: string;
  version: string;
  /** Master seed: "frameSeed::backgroundSeed::characterSeed" */
  seed: string;
  /** Derived per-layer cache keys */
  frameSeed: string;
  backgroundSeed: string;
  characterSeed: string;
  prompts: CardPrompts;
  identity: {
    name: string;
    crew: Faction;
    serialNumber: string;
    /** User-defined age displayed on the card beneath the character name. */
    age?: string;
  };
  stats: {
    speed: number;
    stealth: number;
    tech: number;
    grit: number;
    rep: number;
  };
  traits: {
    passiveTrait: { name: string; description: string };
    activeAbility: { name: string; description: string };
    personalityTags: string[];
  };
  visuals: {
    helmetStyle: string;
    boardStyle: string;
    jacketStyle: string;
    colorScheme: string;
    accentColor: string;
    storagePackStyle: string;
  };
  flavorText: string;
  tags: string[];
  /** Electric skateboard loadout attached to this character. */
  board?: import("./boardBuilder").BoardConfig;
  /** Computed board stats derived from the four chosen components. */
  boardLoadout?: import("./boardBuilder").BoardLoadout;
  /** AI-generated skateboard image URL built from the board config description. */
  boardImageUrl?: string;
  createdAt: string;
  /** Legacy single-image URL (AI-generated illustration). */
  imageUrl?: string;
  /** Layered AI art URLs */
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  /** CraftLingua conlang overlay — present on Rare/Legendary cards with a linked language profile. */
  conlang?: ConlangOverlay;
  discovery?: {
    displayArchetype?: string;
    revealedFaction?: Faction;
    isSecretReveal?: boolean;
    logoMark?: string;
    unlockedAt?: string;
  };
}

// ── Deck payload ──────────────────────────────────────────────────────────────

export interface DeckPayload {
  id: string;
  version: string;
  name: string;
  cards: CardPayload[];
  createdAt: string;
  updatedAt: string;
  /** Whether this deck is readied for battle in the multiplayer arena. */
  battleReady?: boolean;
}

// ── Battle payload ──────────────────────────────────────────────────────────

/** Stat keys used for wager deduction and battle resolution. */
export type StatKey = "speed" | "stealth" | "tech" | "grit" | "rep";

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
  /** Timestamp when the deck was readied. */
  readiedAt: string;
}

/** Outcome stored after a battle completes. */
export interface BattleResult {
  id: string;
  challengerUid: string;
  challengerDeckName: string;
  defenderUid: string;
  defenderDeckName: string;
  winnerUid: string;
  challengerScore: number;
  defenderScore: number;
  wagerPoints: number;
  /** Card IDs in the winning deck that can receive bonus points. */
  winningDeckCardIds: string[];
  createdAt: string;
}

// ── Leaderboard payload ───────────────────────────────────────────────────────

/** A public leaderboard entry uploaded from a player's chosen deck. */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  deckName: string;
  cardCount: number;
  deckPower: number;
  /** Total Ozzycred worth of the deck (sum of every card's stat total). */
  ozzies: number;
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
