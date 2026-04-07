import { Faction, Manufacturer, Archetype, Vibe } from './types';

export const LORE_CHARACTER_NAMES = ["Skip 'Skids' Mayhew", "Ketch", "Cyber Jeff", "Quill-01", "Neon Stalker"];

// Maps UI Archetypes to Lore Factions
export const ARCHETYPE_TO_FACTION: Record<Archetype, Faction> = {
  "Ninja": "The Knights Technarchy",
  "Punk Rocker": "Punch Skaters",
  "Ex Military": "Iron Curtains",
  "Hacker": "D4rk $pider",
  "Chef": "UCPS Workers",
  "Olympic": "United Corporations of America (UCA)",
  "Fash": "The Asclepians"
};

// Maps UI Vibes to Lore Manufacturers
export const VIBE_TO_MANUFACTURER: Record<Vibe, Manufacturer> = {
  "Grunge": "DIY/Plywood",
  "Neon": "VoidRacer",
  "Chrome": "Dark Light Labs",
  "Plastic": "UCA",
  "Recycled": "The Wooders"
};

export const LORE_PASSIVE_TRAITS = [
  { name: "Gutter Punk Resilience", description: "+1 Armor when below 50% HP." },
  { name: "Luddite's Balance", description: "+2 to Grinding checks." }
];

export const LORE_ACTIVE_ABILITIES = [
  { name: "Broomstick Sabotage", description: "Wipeout for UCA White Bikes." },
  { name: "Turbo Boost", description: "Triple Speed; 1 damage." }
];
