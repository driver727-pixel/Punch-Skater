/**
 * types.ts
 * Unified Type Definitions for Punch-Skater.
 * Merges Craftlingua translation schemas with Skater Punk world-building.
 */

// ── World Building Types ─────────────────────────────────────────────────────

/**
 * Primary factions and crews from the Skater Punk doc.
 * Includes the "Moonrisers" and the "Iron Curtains" (False Flag).
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

/**
 * Origins of hardware, from high-tech "Dark Light Labs" 
 * to Skids' "DIY/Plywood" builds.
 */
export type Manufacturer = 
  | "UCA" 
  | "DIY/Plywood" 
  | "The Wooders" 
  | "Dark Light Labs" 
  | "Asclepian Medical" 
  | "VoidRacer";

/**
 * Locations defined in the Skater Punk geography.
 */
export type District = 
  | "Airaway" 
  | "The Roads" 
  | "The Tunnels" 
  | "Batteryville" 
  | "The Grid" 
  | "Electropolis" 
  | "Nightshade (The Murk)" 
  | "The Forest";

// ── Game Mechanics ────────────────────────────────────────────────────────────

export interface PassiveTrait {
  name: string;
  description: string;
  sourceFaction?: Faction;
}

export interface ActiveAbility {
  name: string;
  description: string;
  cooldown?: number; 
  cost?: string; // e.g. "1 Damage" or "Broomstick"
}

export interface CardPayload {
  id: string;
  name: string;
  crew: Faction;
  district: District;
  manufacturer: Manufacturer;
  passiveTrait: string;
  activeAbility: string;
  flavorText: string;
  tags: string[];
}

// ── Craftlingua / JSON Import ─────────────────────────────────────────────────

/**
 * A single vocabulary entry exported from Craftlingua.app.
 */
export interface CraftlinguaWord {
  /** The word or phrase in the constructed language. */
  word: string;
  /** English gloss / meaning. */
  meaning: string;
  /** Romanised or IPA pronunciation (optional). */
  phonetic?: string;
  /**
   * Maps terms to specific card fields. 
   * Updated to include Skater Punk specific categories.
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
  /** Free-form metadata for forward compatibility. */
  meta?: Record<string, unknown>;
}

/**
 * Top-level JSON envelope produced by Craftlingua.app exports.
 */
export interface CraftlinguaEnvelope {
  source: "craftlingua";
  version: string;
  exportedAt: string;
  language: {
    name: string;
    code: string;
    description?: string;
  };
  vocabulary?: CraftlinguaWord[];
  cards?: Partial<CardPayload>[];
}

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
