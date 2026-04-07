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
export type District = "Airaway" | "The Roads" | "The Tunnels" | "Batteryville" | "The Grid" | "Electropolis" | "Nightshade" | "The Forest";
export type Archetype = "Ninja" | "Punk Rocker" | "Ex Military" | "Hacker" | "Chef" | "Olympic" | "Fash";
export type Rarity = "Punch Skater" | "Apprentice" | "Master" | "Rare" | "Legendary";
export type Vibe = "Grunge" | "Neon" | "Chrome" | "Plastic" | "Recycled";
export type Style = "Corporate" | "Street" | "Off-grid" | "Military" | "Union";

export interface CardPrompts {
  archetype: Archetype;
  rarity: Rarity;
  style: Style;
  vibe: Vibe;
  district: District;
  accentColor: string;
  stamina: number;
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
  // Seeds for image generation
  frameSeed: string;
  backgroundSeed: string;
  characterSeed: string;
}
