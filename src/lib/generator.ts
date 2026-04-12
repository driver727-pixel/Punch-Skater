import { LORE_CHARACTER_NAMES, ARCHETYPE_TO_FACTION, LORE_PASSIVE_TRAITS, LORE_ACTIVE_ABILITIES } from './lore';
import type { CardPayload, CardPrompts, Rarity } from './types';
import { createSeededRandom, seedFromString } from './prng';

/** Rarities that unlock conlang/lore overlays on card display. */
export const HIGH_RARITY_TIERS: ReadonlySet<Rarity> = new Set<Rarity>(["Rare", "Legendary"]);

/** Human-readable pack labels keyed by storagePackStyle. */
export const STORAGE_PACK_LABELS: Record<string, string> = {
  "shopping-bag":  "🛍️ Light load — quick courier carry",
  "backpack":      "🎒 Standard kit — everyday courier gear",
  "cardboard-box": "📦 Heavy haul — bulk cargo run",
  "duffel-bag":    "🧳 Long run — overstuffed courier bag",
};

// ── Visual style tables ────────────────────────────────────────────────────────

const HELMET_STYLES: Record<string, string[]> = {
  Corporate:      ["exec-visor",   "mirror-shield",  "corp-dome"],
  Street:         ["graffiti-lid", "open-face",       "half-shell"],
  "Off-grid":     ["salvage-dome", "rough-cut",       "wrapped-rag"],

  Union:          ["hard-hat",     "bump-cap",        "safety-dome"],
  Olympic:        ["aero-helm",    "pro-visor",       "race-dome"],
  Ninja:          ["stealth-hood", "dark-cowl",       "shadow-wrap"],
  "Punk Rocker":  ["mohawk-cap",   "studded-lid",     "diy-bucket"],
  "Ex Military":  ["field-cap",    "patrol-helm",     "surplus-dome"],
  Hacker:         ["screen-hood",  "goggle-cap",      "wire-helm"],
  Chef:           ["chef-hat",     "bandana-wrap",    "kitchen-cap"],
  Fascist:        ["explorer-hat", "safari-helm",     "utility-cap"],
};

const BOARD_STYLES: Record<string, string[]> = {
  Grunge:   ["scratch-deck",  "taped-rail",    "worn-grip"],
  Neon:     ["led-deck",      "glow-rail",     "chrome-grip"],
  Chrome:   ["chrome-deck",   "mirror-rail",   "polished-grip"],
  Plastic:  ["molded-deck",   "color-pop",     "flat-grip"],
  Recycled: ["junk-deck",     "salvage-rail",  "reclaimed-grip"],
};

const JACKET_STYLES: Record<string, string[]> = {
  Corporate:      ["trench-corp",  "suit-jacket",    "exec-coat"],
  Street:         ["bomber",       "hoodie-zip",     "denim-cut"],
  "Off-grid":     ["poncho",       "patched-vest",   "salvage-coat"],

  Union:          ["work-vest",    "hi-vis-jacket",  "overalls"],
  Olympic:        ["tracksuit-top","sponsor-jacket", "pro-warmup"],
  Ninja:          ["stealth-wrap", "shadow-jacket",  "dark-cloak"],
  "Punk Rocker":  ["patched-denim","studded-vest",   "diy-jacket"],
  "Ex Military":  ["surplus-coat", "tac-surplus",    "cheap-armor-vest"],
  Hacker:         ["dark-hoodie",  "cable-vest",     "screen-jacket"],
  Chef:           ["chef-apron",   "kitchen-whites", "service-coat"],
  Fascist:        ["explorer-vest","utility-coat",   "survival-jacket"],
};

const COLOR_SCHEMES: Record<string, string[]> = {
  Grunge:   ["muted-rust",    "faded-black",   "weathered-grey"],
  Neon:     ["hot-pink",      "electric-blue", "acid-green"],
  Chrome:   ["silver-white",  "mirror-blue",   "steel-grey"],
  Plastic:  ["primary-red",   "plastic-yellow","toy-blue"],
  Recycled: ["earthy-brown",  "salvage-green", "dull-orange"],
};

const STORAGE_PACK_STYLES = ["shopping-bag", "backpack", "cardboard-box", "duffel-bag"] as const;

const PERSONALITY_POOLS: Record<string, string[]> = {
  "The Knights Technarchy": ["silent",       "precise",     "disciplined",   "observant",   "cold"],
  "Qu111s":                 ["investigative","bold",        "principled",    "tenacious",   "sharp"],
  "Ne0n Legion":            ["greedy",       "nimble",      "opportunistic", "slick",       "fearless"],
  "Iron Curtains":          ["stoic",        "tactical",    "reliable",      "battle-hardened", "loyal"],
  "D4rk $pider":            ["paranoid",     "curious",     "methodical",    "introverted", "brilliant"],
  "The Asclepians":         ["compassionate","resourceful", "precise",       "dedicated",   "strategic"],
  "The Mesopotamian Society":["adventurous", "scholarly",   "meticulous",    "bold",        "calculating"],
  "Hermes' Squirmies":      ["neutral",      "discreet",    "reliable",      "adaptable",   "professional"],
  "UCPS":                   ["punctual",     "dutiful",     "street-smart",  "methodical",  "dependable"],
  "The Team":               ["coordinated",  "athletic",    "competitive",   "disciplined", "cohesive"],
};

// ── Stat constants ─────────────────────────────────────────────────────────────

/** Minimum value for a single card stat. */
export const MIN_SINGLE_STAT = 1;

/** Maximum value for a single stat on the live card scale. */
export const MAX_SINGLE_STAT = 10;

/** Historic single-stat ceiling used by older saved cards. */
export const LEGACY_MAX_SINGLE_STAT = 200;

const BASE_STAT_MIN = 2;
const BASE_STAT_MAX = 4;

// ── Stat modifiers by archetype (added on top of a 2–4 base roll) ─────────────

interface StatMods { speed: number; stealth: number; tech: number; grit: number; rep: number; }

const ARCHETYPE_MODS: Record<string, StatMods> = {
  "The Knights Technarchy":  { speed:  1, stealth:  2, tech:  1, grit:  0, rep:  0 },
  "Qu111s":                  { speed:  1, stealth:  0, tech:  0, grit:  1, rep:  2 },
  "Ne0n Legion":             { speed:  2, stealth:  1, tech:  1, grit:  0, rep:  0 },
  "Iron Curtains":           { speed:  0, stealth:  0, tech:  1, grit:  2, rep:  0 },
  "D4rk $pider":             { speed:  0, stealth:  1, tech:  2, grit:  0, rep:  0 },
  "The Asclepians":          { speed:  0, stealth:  0, tech:  1, grit:  2, rep:  1 },
  "The Mesopotamian Society":{ speed:  1, stealth:  1, tech:  2, grit:  0, rep:  1 },
  "Hermes' Squirmies":       { speed:  1, stealth:  1, tech:  0, grit:  1, rep:  1 },
  "UCPS":                    { speed:  1, stealth:  0, tech:  0, grit:  1, rep:  2 },
  "The Team":                { speed:  2, stealth:  0, tech:  0, grit:  1, rep:  2 },
};

const RARITY_BONUS: Record<Rarity, number> = {
  "Punch Skater": 0,
  Apprentice:     1,
  Master:         2,
  Rare:           3,
  Legendary:      4,
};

export function clampCardStat(value: number): number {
  return Math.max(MIN_SINGLE_STAT, Math.min(MAX_SINGLE_STAT, Math.round(value)));
}

export function normalizeLegacyCardStat(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_SINGLE_STAT;
  }

  if (value <= MAX_SINGLE_STAT) {
    return clampCardStat(value);
  }

  // Linearly interpolate the old [1, 200] card scale onto the live [1, 10]
  // scale so legacy saves keep their relative strength after the rebalance.
  const scaled = MIN_SINGLE_STAT
    + ((value - MIN_SINGLE_STAT) * (MAX_SINGLE_STAT - MIN_SINGLE_STAT))
      / (LEGACY_MAX_SINGLE_STAT - MIN_SINGLE_STAT);

  return clampCardStat(scaled);
}

export function normalizeCardStats<T extends Record<string, number>>(stats: T): T {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, normalizeLegacyCardStat(value)]),
  ) as T;
}

// ── Main generator ─────────────────────────────────────────────────────────────

export const generateCard = (prompts: CardPrompts): CardPayload => {
  // ── Seeds ──────────────────────────────────────────────────────────────────
  const characterSeed  = `${prompts.archetype}|${prompts.style}|${prompts.vibe}|${prompts.gender}|${prompts.ageGroup}|${prompts.bodyType}`;
  const backgroundSeed = prompts.district;
  const frameSeed      = prompts.rarity;
  const masterSeed     = `${frameSeed}::${backgroundSeed}::${characterSeed}`;

  // charRng is seeded only on characterSeed so character attributes are stable
  // when district or rarity changes (only frameSeed / backgroundSeed differ).
  const charRng = createSeededRandom(characterSeed);
  const rarityBonus = RARITY_BONUS[prompts.rarity];
  const mods    = ARCHETYPE_MODS[prompts.archetype] ?? { speed: 0, stealth: 0, tech: 0, grit: 0, rep: 0 };

  // ── Stats (1–10 per stat; 5 stats × 10 = 50 max per card) ──────────────────
  const rollStat = (mod: number): number =>
    clampCardStat(charRng.range(BASE_STAT_MIN, BASE_STAT_MAX) + mod + rarityBonus);

  const speed   = rollStat(mods.speed);
  const stealth = rollStat(mods.stealth);
  const tech    = rollStat(mods.tech);
  const grit    = rollStat(mods.grit);
  const rep     = rollStat(mods.rep);

  // ── Visuals ────────────────────────────────────────────────────────────────
  const storagePackStyle = charRng.pick([...STORAGE_PACK_STYLES]);

  const helmetStyle  = charRng.pick(HELMET_STYLES[prompts.style]  ?? ["standard-helm"]);
  const boardStyle   = charRng.pick(BOARD_STYLES[prompts.vibe]    ?? ["standard-deck"]);
  const jacketStyle  = charRng.pick(JACKET_STYLES[prompts.style]  ?? ["standard-jacket"]);
  const colorScheme  = charRng.pick(COLOR_SCHEMES[prompts.vibe]   ?? ["neutral-grey"]);

  // ── Personality tags ───────────────────────────────────────────────────────
  const tagPool        = PERSONALITY_POOLS[prompts.archetype] ?? ["resourceful", "adaptable"];
  const personalityTags = charRng.pickN(tagPool, 2);

  // ── Traits ─────────────────────────────────────────────────────────────────
  const passiveTrait  = charRng.pick(LORE_PASSIVE_TRAITS);
  const activeAbility = charRng.pick(LORE_ACTIVE_ABILITIES);

  // ── Identity ───────────────────────────────────────────────────────────────
  const name         = charRng.pick(LORE_CHARACTER_NAMES);
  const serialSuffix = Math.abs(seedFromString(characterSeed)) % 10000;
  const serialNumber = `PS-${String(serialSuffix).padStart(4, "0")}`;

  // ── Card ID (deterministic per full prompt set) ────────────────────────────
  const idNum = Math.abs(seedFromString(masterSeed)) % 1_000_000;
  const id    = `forge-${String(idNum).padStart(6, "0")}`;

  return {
    id,
    version: "1.0.0",
    seed: masterSeed,
    frameSeed,
    backgroundSeed,
    characterSeed,
    prompts: { ...prompts },
    identity: {
      name,
      crew:         ARCHETYPE_TO_FACTION[prompts.archetype],
      serialNumber,
    },
    stats: { speed, stealth, tech, grit, rep },
    traits: {
      passiveTrait,
      activeAbility,
      personalityTags,
    },
    visuals: {
      helmetStyle,
      boardStyle,
      jacketStyle,
      colorScheme,
      accentColor:      prompts.accentColor,
      storagePackStyle,
    },
    flavorText: `A ${prompts.rarity} ${prompts.archetype} running packages through ${prompts.district}.`,
    tags: [prompts.archetype, prompts.style, prompts.vibe, prompts.rarity, prompts.district],
    createdAt: new Date().toISOString(),
  };
};
