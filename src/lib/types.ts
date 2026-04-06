export interface CardPayload {
  id: string;
  version: "1.0.0";
  prompts: {
    archetype: string;
    rarity: string;
    style: string;
    vibe: string;
    district: string;
    accentColor: string;
    stamina: number;
  };
  /** Master seed: frameSeed::backgroundSeed::characterSeed */
  seed: string;
  /** Layer-1 seed — determined by rarity alone */
  frameSeed: string;
  /** Layer-2 seed — determined by district alone */
  backgroundSeed: string;
  /** Layer-3 seed — determined by archetype, style, vibe, stamina */
  characterSeed: string;
  identity: {
    name: string;
    crew: string;
    manufacturer: string;
    serialNumber: string;
  };
  stats: {
    speed: number;
    stealth: number;
    tech: number;
    grit: number;
    rep: number;
    stamina: number;
  };
  traits: {
    personalityTags: string[];
    passiveTrait: { name: string; description: string };
    activeAbility: { name: string; description: string };
  };
  flavorText: string;
  visuals: {
    helmetStyle: string;
    boardStyle: string;
    jacketStyle: string;
    colorScheme: string;
    accentColor: string;
    storagePackStyle: string;
  };
  tags: string[];
  createdAt: string;
  /** AI-generated illustration URL (single combined image — backward-compatible). */
  imageUrl?: string;
  /** AI-generated background layer URL (district scene, no characters). */
  backgroundImageUrl?: string;
  /** AI-generated character layer URL (courier portrait on white background). */
  characterImageUrl?: string;
  /** AI-generated frame layer URL (ornate playing-card border based on rarity). */
  frameImageUrl?: string;
}

export interface DeckPayload {
  id: string;
  version: "1.0.0";
  name: string;
  cards: CardPayload[];
  createdAt: string;
  updatedAt: string;
}

export type TradeStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface TradePayload {
  id: string;
  fromUid: string;
  fromEmail: string;
  toUid: string;
  toEmail: string;
  offeredCard: CardPayload;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
}

export type Archetype = "Ninja" | "Punk Rocker" | "Ex Military" | "Hacker" | "Chef" | "Olympic" | "Fash";
export type Rarity = "Legendary" | "Rare" | "Master" | "Apprentice" | "Punch Skater";
export type Style = "Corporate" | "Street" | "Off-grid" | "Military" | "Union";
export type Vibe = "Grunge" | "Neon" | "Chrome" | "Plastic" | "Recycled";
export type District = "Airaway" | "Nightshade" | "Batteryville" | "The Grid" | "Glass City";

export interface CardPrompts {
  archetype: Archetype;
  rarity: Rarity;
  style: Style;
  vibe: Vibe;
  district: District;
  accentColor: string;
  stamina: number;
}

// ── Craftlingua / JSON Import ─────────────────────────────────────────────────

/**
 * A single vocabulary entry exported from Craftlingua.app.
 * Each word carries an optional `cardField` hint so the importer knows
 * which part of a card the constructed-language term enriches.
 */
export interface CraftlinguaWord {
  /** The word or phrase in the constructed language. */
  word: string;
  /** English gloss / meaning. */
  meaning: string;
  /** Romanised or IPA pronunciation (optional). */
  phonetic?: string;
  /**
   * Which card field this term maps to.
   * Extend this union as new card fields become available.
   */
  cardField?:
    | "name"
    | "flavorText"
    | "crew"
    | "passiveTrait"
    | "activeAbility"
    | "tag"
    | "manufacturer"
    | "district";
  /** Free-form metadata for forward compatibility with future Craftlingua fields. */
  meta?: Record<string, unknown>;
}

/**
 * Top-level JSON envelope produced by Craftlingua.app exports.
 * The importer also accepts the older `{ version, exportedAt, cards }` collection
 * export format and plain `CardPayload[]` arrays.
 */
export interface CraftlinguaEnvelope {
  /** Must be "craftlingua" to identify the source. */
  source: "craftlingua";
  /** Craftlingua schema version (semver string). */
  version: string;
  /** ISO 8601 export timestamp. */
  exportedAt: string;
  /** Metadata about the constructed language being exported. */
  language: {
    /** Full name of the conlang, e.g. "Neon-Kana". */
    name: string;
    /** Short identifier / BCP-47-style code, e.g. "nnk". */
    code: string;
    /** Human-readable description (optional). */
    description?: string;
  };
  /** Vocabulary list — words/phrases mapped to card fields. */
  vocabulary?: CraftlinguaWord[];
  /**
   * Pre-built card objects ready to be added to the collection.
   * These are validated against the CardPayload schema before import.
   */
  cards?: Partial<CardPayload>[];
}

/** Validation error for a single card during import. */
export interface ImportCardError {
  /** Zero-based position in the source array. */
  index: number;
  /** Card id if present in the source data. */
  id?: string;
  /** Human-readable validation messages. */
  errors: string[];
}

/** Result returned by the client-side `validateImport` helper. */
export interface ImportResult {
  /** Cards that passed validation and are ready to save. */
  accepted: CardPayload[];
  /** Cards that failed validation, with reasons. */
  rejected: ImportCardError[];
  /** Total number of card entries seen in the source. */
  total: number;
  /** Craftlingua language metadata when present in the envelope. */
  language?: CraftlinguaEnvelope["language"];
  /** Vocabulary entries when present in the envelope. */
  vocabulary?: CraftlinguaWord[];
}
