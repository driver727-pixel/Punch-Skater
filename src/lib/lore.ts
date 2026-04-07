/**
 * lore.ts
 * * This file contains the canon arrays for the Punch-Skater game generator,
 * synchronized with the "Skater Punk" world-building documentation.
 * Conflicts resolved in favor of the "Skater Punk" master doc.
 */

import { Faction, Manufacturer, District } from './types';

// ── Factions & Crews ─────────────────────────────────────────────────────────

export const LORE_CREWS: string[] = [
  "Qu111s (Quills)",
  "Ne0n (Neon) Legion",
  "Iron Curtains",
  "D4rk $pider",
  "The Asclepians",
  "The Mesopotamian Society",
  "The Knights Technarchy",
  "Hermes' Squirmies",
  "UCPS Workers",
  "Moonrisers",
  "The Wooders"
];

// ── Manufacturers ────────────────────────────────────────────────────────────

export const LORE_MANUFACTURERS: string[] = [
  "United Corporations of America (UCA)",
  "DIY / Plywood Customs",
  "The Wooders (Exclusively Wood)",
  "Dark Light Labs",
  "Asclepian Medical Tech",
  "VoidRacer (Unregistered)"
];

// ── District-Specific Flavor Text ───────────────────────────────────────────

export const LORE_FLAVOR_TEXTS: string[] = [
  // Nightshade / The Murk
  "In the Murk, the Fuzz can't see you, but the other crews can.",
  "Deep in the tunnels, the only light is the spark of your trucks.",
  "The Nightshade is for private meetings and rapid, dangerous transit.",
  
  // Batteryville
  "They built walls. We built wheels.",
  "Batteryville: Where Skids learned that 'junk' is just a board waiting to happen.",
  "The package doesn't care who's chasing you.",
  
  // The Grid
  "Every step is logged. Every blink is recorded. Run faster than the timestamp.",
  "The Grid is where the work happens, and where people disappear.",
  
  // Airaway
  "The rooftop rails belong to the corps. The gaps between them belong to us.",
  "In Airaway, if it's motorized, it's illegal. If it's a bike, it's a target.",
  "The elevated city shines, but the shadows it casts are long.",
  
  // Electropolis
  "The Fuzz are pushing us into the corridors. Don't let them bottle you up.",
  "In Electropolis, order is maintained by the tip of a baton.",
  
  // The Forest (Wooders)
  "Wooden decks, wooden boardwalks, no tech. Just the grind.",
  "The Ewok village of the underground: grinding on tree trunks.",
  
  // Universal / The Code
  "Speed is sacred. Everything else is negotiable.",
  "The Code isn't written down. Everyone in the underground already knows it.",
  "A broomstick in the spokes is the only greeting a UCA bike deserves."
];

// ── Passive Traits ──────────────────────────────────────────────────────────

export const LORE_PASSIVE_TRAITS: { name: string; description: string }[] = [
  { name: "Gutter Punk Resilience", description: "Bruised and bloodied; gain +1 Armor when below 50% HP." },
  { name: "Anti-Corp Bias", description: "Deal double 'Stability Damage' to enemies on UCA White Bikes." },
  { name: "DIY Specialist", description: "Repairing your board with 'Junk' restores 25% more durability." },
  { name: "Nightshade Navigator", description: "Ignore movement penalties in tunnel or 'Murk' tiles." },
  { name: "Luddite's Balance", description: "If using a Wood deck, gain +2 to all Grinding checks." },
  { name: "Neural Link", description: "Gains +1 Speed when below 3 HP." },
  { name: "Ghost Protocol", description: "First stealth action each turn costs 0." },
  { name: "Data Sponge", description: "Draw an extra card when entering Corporate zones." },
  { name: "Scavenger", description: "Recover 1 spent resource when passing recycler zones in Batteryville." },
  { name: "Undercover Asclepian", description: "Neutral factions are less likely to intercept your deliveries." }
];

// ── Active Abilities (Power-ups) ────────────────────────────────────────────

export const LORE_ACTIVE_ABILITIES: { name: string; description: string }[] = [
  { name: "Broomstick Sabotage", description: "Throw a stick into a pursuit vehicle's spokes; causes instant wipeout." },
  { name: "Turbo Boost", description: "Triple Speed for one turn; take 1 damage." },
  { name: "EMP Pulse", description: "Disable one Tech obstacle or enemy device (Knights Technarchy favorite)." },
  { name: "Grind Rail", description: "Travel along any rail, ledge, or tree trunk for free this turn." },
  { name: "Syndicate Call", description: "Summon a Moonriser or crew member to intercept a pursuer." },
  { name: "Smoke Screen", description: "All enemies lose sight of you until end of turn." },
  { name: "Data Heist", description: "Instantly copy a memory disc or thumb drive without stopping." },
  { name: "Bail and Roll", description: "Avoid all damage this turn; lose 2 Speed next turn." },
  { name: "Signal Jam", description: "Prevent the Fuzz from calling for backup this turn." },
  { name: "Overcharge", description: "Push your DIY battery beyond its limit; +5 Speed but board takes 2 damage." }
];

// ── Suggested Character Names ───────────────────────────────────────────────

export const LORE_CHARACTER_NAMES: string[] = [
  "Skip 'Skids' Mayhew",
  "Ketch",
  "Cyber Jeff",
  "Quill-01",
  "Neon Stalker",
  "Iron Apostle",
  "Spider-Byte",
  "Asclepian Medic",
  "Technarchy Ninja",
  "Hermes Prime"
];
