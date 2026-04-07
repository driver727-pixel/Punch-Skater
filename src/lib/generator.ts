import { LORE_CHARACTER_NAMES, ARCHETYPE_TO_FACTION, VIBE_TO_MANUFACTURER, LORE_PASSIVE_TRAITS, LORE_ACTIVE_ABILITIES } from './lore';
import { CardPayload, CardPrompts, Rarity } from './types';
import { createSeededRandom, seedFromString } from './prng';

/** Rarities that unlock conlang/lore overlays on card display. */
export const HIGH_RARITY_TIERS: ReadonlySet<Rarity> = new Set<Rarity>(["Rare", "Legendary"]);

/**
 * Human-readable pack labels for each stamina bracket.
 * Key = storagePackStyle value produced by generateCard().
 */
export const STORAGE_PACK_LABELS: Record<string, string> = {
  "shopping-bag":  "🛍️ Light load — just the essentials",
  "backpack":      "🎒 Standard kit — ready for most runs",
  "cardboard-box": "📦 Heavy haul — stamina is everything",
  "duffel-bag":    "🧳 Maximum carry — legendary endurance",
};

// ── Visual style tables ────────────────────────────────────────────────────────

const HELMET_STYLES: Record<string, string[]> = {
  Corporate:  ["exec-visor",   "mirror-shield",  "corp-dome"],
  Street:     ["graffiti-lid", "open-face",       "half-shell"],
  "Off-grid": ["salvage-dome", "rough-cut",       "wrapped-rag"],
  Military:   ["tac-helmet",   "battle-dome",     "combat-visor"],
  Union:      ["hard-hat",     "bump-cap",        "safety-dome"],
};

const BOARD_STYLES: Record<string, string[]> = {
  Grunge:   ["scratch-deck",  "taped-rail",    "worn-grip"],
  Neon:     ["led-deck",      "glow-rail",     "chrome-grip"],
  Chrome:   ["chrome-deck",   "mirror-rail",   "polished-grip"],
  Plastic:  ["molded-deck",   "color-pop",     "flat-grip"],
  Recycled: ["junk-deck",     "salvage-rail",  "reclaimed-grip"],
};

const JACKET_STYLES: Record<string, string[]> = {
  Corporate:  ["trench-corp",  "suit-jacket",   "exec-coat"],
  Street:     ["bomber",       "hoodie-zip",    "denim-cut"],
  "Off-grid": ["poncho",       "patched-vest",  "salvage-coat"],
  Military:   ["field-jacket", "tac-vest",      "camo-coat"],
  Union:      ["work-vest",    "hi-vis-jacket", "overalls"],
};

const COLOR_SCHEMES: Record<string, string[]> = {
  Grunge:   ["muted-rust",    "faded-black",   "weathered-grey"],
  Neon:     ["hot-pink",      "electric-blue", "acid-green"],
  Chrome:   ["silver-white",  "mirror-blue",   "steel-grey"],
  Plastic:  ["primary-red",   "plastic-yellow","toy-blue"],
  Recycled: ["earthy-brown",  "salvage-green", "dull-orange"],
};

const PERSONALITY_POOLS: Record<string, string[]> = {
  "Ninja":         ["silent",       "precise",     "disciplined",    "observant",   "cold"],
  "Punk Rocker":   ["loud",         "rebellious",  "charismatic",    "reckless",    "fearless"],
  "Ex Military":   ["stoic",        "tactical",    "reliable",       "battle-hardened", "loyal"],
  "Hacker":        ["paranoid",     "curious",     "methodical",     "introverted", "brilliant"],
  "Chef":          ["resourceful",  "creative",    "stubborn",       "enduring",    "improviser"],
  "Fash":          ["vain",         "precise",     "status-obsessed","calculating", "polished"],
};

// ── Stat modifiers by archetype (added on top of a 1–7 base roll) ─────────────

interface StatMods { speed: number; stealth: number; tech: number; grit: number; rep: number; }

const ARCHETYPE_MODS: Record<string, StatMods> = {
  "Ninja":        { speed:  2, stealth:  3, tech:  1, grit:  0, rep: -1 },
  "Punk Rocker":  { speed:  1, stealth: -1, tech:  0, grit:  2, rep:  3 },
  "Ex Military":  { speed:  1, stealth:  0, tech:  1, grit:  3, rep:  0 },
  "Hacker":       { speed: -1, stealth:  2, tech:  3, grit:  0, rep:  0 },
  "Chef":         { speed:  0, stealth:  0, tech:  1, grit:  3, rep:  1 },
  "Fash":         { speed:  1, stealth:  1, tech:  2, grit: -1, rep:  2 },
};

const RARITY_MULTIPLIER: Record<Rarity, number> = {
  "Punch Skater": 0.55,
  Apprentice:     0.70,
  Master:         0.85,
  Rare:           0.95,
  Legendary:      1.00,
};

// ── Main generator ─────────────────────────────────────────────────────────────

export const generateCard = (prompts: CardPrompts): CardPayload => {
  // ── Seeds ──────────────────────────────────────────────────────────────────
  const characterSeed  = `${prompts.archetype}|${prompts.style}|${prompts.vibe}|${prompts.stamina}|${prompts.gender}`;
  const backgroundSeed = prompts.district;
  const frameSeed      = prompts.rarity;
  const masterSeed     = `${frameSeed}::${backgroundSeed}::${characterSeed}`;

  // charRng is seeded only on characterSeed so character attributes are stable
  // when district or rarity changes (only frameSeed / backgroundSeed differ).
  const charRng = createSeededRandom(characterSeed);
  const mult    = RARITY_MULTIPLIER[prompts.rarity];
  const mods    = ARCHETYPE_MODS[prompts.archetype] ?? { speed: 0, stealth: 0, tech: 0, grit: 0, rep: 0 };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const clamp = (n: number) => Math.max(1, Math.min(10, n));
  const rollStat = (mod: number): number =>
    clamp(Math.round((charRng.range(1, 7) + mod) * mult));

  const speed   = rollStat(mods.speed);
  const stealth = rollStat(mods.stealth);
  const tech    = rollStat(mods.tech);
  const grit    = rollStat(mods.grit);
  const rep     = rollStat(mods.rep);

  // ── Visuals ────────────────────────────────────────────────────────────────
  const storagePackStyle =
    prompts.stamina <= 2 ? "shopping-bag"  :
    prompts.stamina <= 5 ? "backpack"      :
    prompts.stamina <= 8 ? "cardboard-box" : "duffel-bag";

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
      manufacturer: VIBE_TO_MANUFACTURER[prompts.vibe],
      serialNumber,
    },
    stats: { speed, stealth, tech, grit, rep, stamina: prompts.stamina },
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
