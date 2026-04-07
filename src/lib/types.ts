/**
 * types.ts
 */
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
  | "Moonrisers"
  | "The Wooders"
  | "Punch Skaters";

export type Manufacturer = "UCA" | "DIY/Plywood" | "The Wooders" | "Dark Light Labs" | "Asclepian Medical" | "VoidRacer";
export type District = "Airaway" | "The Roads" | "Batteryville" | "The Grid" | "Electropolis" | "Nightshade" | "The Forest" | "Glass City";
export type Archetype = "Ninja" | "Punk Rocker" | "Ex Military" | "Hacker" | "Chef" | "Fash";
export type Rarity = "Punch Skater" | "Apprentice" | "Master" | "Rare" | "Legendary";
export type Vibe = "Grunge" | "Neon" | "Chrome" | "Plastic" | "Recycled";
export type Style = "Corporate" | "Street" | "Off-grid" | "Military" | "Union" | "Olympic";
export type Gender = "Woman" | "Man" | "Non-binary";

export interface CardPrompts {
  archetype: Archetype;
  rarity: Rarity;
  style: Style;
  vibe: Vibe;
  district: District;
  accentColor: string;
  stamina: number;
  gender: Gender;
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
    manufacturer: Manufacturer;
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
  createdAt: string;
  /** Legacy single-image URL (AI-generated illustration). */
  imageUrl?: string;
  /** Layered AI art URLs */
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  /** CraftLingua conlang overlay — present on Rare/Legendary cards with a linked language profile. */
  conlang?: ConlangOverlay;
}

// ── Deck payload ──────────────────────────────────────────────────────────────

export interface DeckPayload {
  id: string;
  version: string;
  name: string;
  cards: CardPayload[];
  createdAt: string;
  updatedAt: string;
}

// ── Trade payload ─────────────────────────────────────────────────────────────

export interface TradePayload {
  id: string;
  fromUid: string;
  fromEmail: string;
  toUid: string;
  toEmail: string;
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
