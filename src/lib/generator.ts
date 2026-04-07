import type { CardPayload, CardPrompts, CraftlinguaWord } from "./types";
import { createSeededRandom, seedFromString } from "./prng";
import {
  generateConlangName,
  generateCatchphrase,
  translateToConlang,
} from "./languageIngestion";
import {
  LORE_CREWS,
  LORE_MANUFACTURERS,
  LORE_FLAVOR_TEXTS,
  LORE_PASSIVE_TRAITS,
  LORE_ACTIVE_ABILITIES,
} from "./lore";

const FIRST_NAMES = ["Vex", "Zara", "Nyx", "Kael", "Syn", "Dex", "Lyra", "Cade", "Mira", "Razor", "Nova", "Jett", "Blix", "Cipher", "Rook", "Sable", "Echo", "Flux", "Kira", "Zero"];
const LAST_NAMES = ["Vance", "Cross", "Nakamura", "Reeves", "Santos", "Okafor", "Petrov", "Chen", "Wolff", "Diaz", "Park", "Torres", "Kwan", "Adler", "Brax", "Solano", "Ito", "Marez", "Quinn", "Steele"];
const CREWS = LORE_CREWS;
const MANUFACTURERS = LORE_MANUFACTURERS;
const PERSONALITY_TAGS = ["Reckless", "Loyal", "Paranoid", "Cunning", "Fearless", "Ruthless", "Witty", "Stoic", "Volatile", "Precise", "Agile", "Cautious", "Bold", "Mysterious", "Tenacious"];

const PASSIVE_TRAITS = LORE_PASSIVE_TRAITS;

const ACTIVE_ABILITIES = LORE_ACTIVE_ABILITIES;

const FLAVOR_TEXTS = LORE_FLAVOR_TEXTS;

const HELMET_STYLES = ["Visor-X", "DomeShell", "NightCap", "SteelCrown", "HoloShade"];
const BOARD_STYLES = ["Slick-90", "VortexDeck", "GhostRide", "NeonCruiser", "IronSlider"];
const JACKET_STYLES = ["Synthleather", "ChromeVest", "NeonStripe", "DataWeave", "SteelMesh"];
const COLOR_SCHEMES = ["midnight", "neonGreen", "crimsonRed", "voidPurple", "cyberBlue"];

const RARITY_MULTIPLIERS: Record<string, number> = {
  "Punch Skater": 0.8,
  Apprentice: 1.0,
  Master: 1.2,
  Rare: 1.35,
  Legendary: 1.5,
};

const ARCHETYPE_BIAS: Record<string, Record<string, number>> = {
  "Ninja":        { speed: 2, stealth: 3, tech: 0, grit: 0, rep: 0 },
  "Punk Rocker":  { speed: 1, stealth: 0, tech: 0, grit: 2, rep: 3 },
  "Ex Military":  { speed: 1, stealth: 1, tech: 1, grit: 3, rep: 0 },
  "Hacker":       { speed: 0, stealth: 1, tech: 3, grit: 0, rep: 2 },
  "Chef":         { speed: 2, stealth: 0, tech: 1, grit: 1, rep: 1 },
  "Olympic":      { speed: 2, stealth: 0, tech: 1, grit: 2, rep: 3 },
  "Fash":         { speed: 0, stealth: 2, tech: 0, grit: 1, rep: 5 },
};

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Derive the storage pack style from a stamina value (1–10).
 *
 * stamina 1–2  → shopping-bag  (small single-hand carry)
 * stamina 3–5  → backpack      (worn on back)
 * stamina 6–8  → cardboard-box (large two-hand carry)
 * stamina 9–10 → duffel-bag    (over-the-shoulder, max capacity)
 */
function storagePackFromStamina(stamina: number): string {
  if (stamina <= 2) return "shopping-bag";
  if (stamina <= 5) return "backpack";
  if (stamina <= 8) return "cardboard-box";
  return "duffel-bag";
}

/** Human-readable pack label used in both the forge UI and card details. */
export const STORAGE_PACK_LABELS: Record<string, string> = {
  "shopping-bag":  "🛍️ Shopping bag (one hand)",
  "backpack":      "🎒 Backpack",
  "cardboard-box": "📦 Cardboard box (both hands)",
  "duffel-bag":    "👜 Over-the-shoulder duffel bag",
};

/**
 * Build the three layer seeds and the master seed from prompts.
 *
 *   frameSeed      = rarity
 *   backgroundSeed = district
 *   characterSeed  = archetype|style|vibe|stamina
 *   masterSeed     = frameSeed::backgroundSeed::characterSeed
 */
export function buildSeed(prompts: CardPrompts): {
  frameSeed: string;
  backgroundSeed: string;
  characterSeed: string;
  masterSeed: string;
} {
  const frameSeed = prompts.rarity;
  const backgroundSeed = prompts.district;
  const characterSeed = `${prompts.archetype}|${prompts.style}|${prompts.vibe}|${prompts.stamina}`;
  const masterSeed = `${frameSeed}::${backgroundSeed}::${characterSeed}`;
  return { frameSeed, backgroundSeed, characterSeed, masterSeed };
}

/** Rarity tiers that unlock conlang lore on the card display. */
export const HIGH_RARITY_TIERS = new Set(["Legendary", "Rare"]);

export function generateCard(prompts: CardPrompts, vocabulary?: CraftlinguaWord[]): CardPayload {
  const { frameSeed, backgroundSeed, characterSeed, masterSeed } = buildSeed(prompts);

  // Character-specific properties (name, traits, visuals) are seeded by
  // characterSeed so they remain stable when only district or rarity changes.
  const charRng = createSeededRandom(characterSeed);

  const defaultFirstName = charRng.pick(FIRST_NAMES);
  const defaultLastName  = charRng.pick(LAST_NAMES);
  const crew = charRng.pick(CREWS);
  const manufacturer = charRng.pick(MANUFACTURERS);

  // Serial suffix is stable across district/rarity changes; only the district
  // prefix updates to reflect where the courier is currently operating.
  const serialSuffix = String(Math.abs(seedFromString(characterSeed)) % 10000).padStart(4, "0");
  const districtCode = prompts.district.replace(/\s/g, "").slice(0, 2).toUpperCase();
  const serialNumber = `${districtCode}-${new Date().getFullYear()}-${serialSuffix}`;

  const bias = ARCHETYPE_BIAS[prompts.archetype] || {};
  const mult = RARITY_MULTIPLIERS[prompts.rarity] || 1.0;

  // Stats are derived from the character seed so they don't change when only
  // district changes; the rarity multiplier is still applied deterministically,
  // so raising rarity still increases stats.
  const rawStat = (key: string) =>
    clamp(Math.round((charRng.range(3, 8) + (bias[key] || 0)) * mult), 1, 10);

  const stats = {
    speed: rawStat("speed"),
    stealth: rawStat("stealth"),
    tech: rawStat("tech"),
    grit: rawStat("grit"),
    rep: rawStat("rep"),
    stamina: clamp(prompts.stamina, 1, 10),
  };

  // Use a conlang-generated name when vocabulary is available; otherwise fall
  // back to the seeded English name.  Both paths always consume the same RNG
  // calls above so all subsequent picks remain deterministic.
  const conlangName = vocabulary?.length
    ? generateConlangName(vocabulary, characterSeed)
    : null;
  const identityName = conlangName ?? `${defaultFirstName} ${defaultLastName}`;

  const personalityTags = charRng.pickN(PERSONALITY_TAGS, 3);
  const passiveTrait = charRng.pick(PASSIVE_TRAITS);
  const activeAbility = charRng.pick(ACTIVE_ABILITIES);
  const flavorText = charRng.pick(FLAVOR_TEXTS);

  const helmetStyle = charRng.pick(HELMET_STYLES);
  const boardStyle = charRng.pick(BOARD_STYLES);
  const jacketStyle = charRng.pick(JACKET_STYLES);
  const colorScheme = charRng.pick(COLOR_SCHEMES);
  const storagePackStyle = storagePackFromStamina(prompts.stamina);

  const tags = [
    prompts.archetype.toLowerCase().replace(/\s/g, "-"),
    prompts.rarity.toLowerCase().replace(/\s/g, "-"),
    prompts.style.toLowerCase().replace(/\s/g, "-"),
    prompts.vibe.toLowerCase(),
    prompts.district.toLowerCase().replace(/\s/g, "-"),
    ...personalityTags.map((t) => t.toLowerCase()),
  ];

  // Build conlang data when vocabulary is provided.  The translations are built
  // AFTER all charRng picks so the RNG sequence is never disturbed.
  // Language name/code is passed via _languageName/_languageCode properties that
  // CardForge attaches when creating the vocabulary array from the loaded profile.
  let conlang: CardPayload["conlang"] | undefined;
  if (vocabulary?.length) {
    const first = vocabulary[0] as CraftlinguaWord & { _languageName?: string; _languageCode?: string };
    const langName = first._languageName ?? "Neon-Kana";
    const langCode = first._languageCode ?? "nnk";
    conlang = {
      languageName: langName,
      languageCode: langCode,
      name: identityName,
      catchphrase: generateCatchphrase(vocabulary, characterSeed),
      passiveTrait:  translateToConlang(passiveTrait.description, vocabulary),
      activeAbility: translateToConlang(activeAbility.description, vocabulary),
      flavorText:    translateToConlang(flavorText, vocabulary),
    };
  }

  return {
    id: `card-${masterSeed.replace(/[^a-z0-9]/gi, "-")}-${seedFromString(masterSeed)}`,
    version: "1.0.0",
    prompts: { ...prompts },
    seed: masterSeed,
    frameSeed,
    backgroundSeed,
    characterSeed,
    identity: {
      name: identityName,
      crew,
      manufacturer,
      serialNumber,
    },
    stats,
    traits: {
      personalityTags,
      passiveTrait,
      activeAbility,
    },
    flavorText,
    visuals: {
      helmetStyle,
      boardStyle,
      jacketStyle,
      colorScheme,
      accentColor: prompts.accentColor,
      storagePackStyle,
    },
    tags,
    createdAt: new Date().toISOString(),
    conlang,
  };
}
