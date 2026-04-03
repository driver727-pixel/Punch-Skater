import type { CardPayload, CardPrompts } from "./types";
import { createSeededRandom, seedFromString } from "./prng";

const FIRST_NAMES = ["Vex", "Zara", "Nyx", "Kael", "Syn", "Dex", "Lyra", "Cade", "Mira", "Razor", "Nova", "Jett", "Blix", "Cipher", "Rook", "Sable", "Echo", "Flux", "Kira", "Zero"];
const LAST_NAMES = ["Vance", "Cross", "Nakamura", "Reeves", "Santos", "Okafor", "Petrov", "Chen", "Wolff", "Diaz", "Park", "Torres", "Kwan", "Adler", "Brax", "Solano", "Ito", "Marez", "Quinn", "Steele"];
const CREWS = ["Nightshade Runners", "Chrome Blades", "Neon Ghosts", "The Static Pack", "Iron Circuit", "The Undercurrent", "Voltage Saints", "The Dark Lanes", "Circuit Breakers", "Phantom Riders"];
const MANUFACTURERS = ["VoltEdge", "NightRider Tech", "ChromeCraft", "NeonForge", "StaticWave", "IronPulse", "ShadowDrive", "ApexRoll", "CyberGlide", "VoidRacer"];
const PERSONALITY_TAGS = ["Reckless", "Loyal", "Paranoid", "Cunning", "Fearless", "Ruthless", "Witty", "Stoic", "Volatile", "Precise", "Agile", "Cautious", "Bold", "Mysterious", "Tenacious"];

const PASSIVE_TRAITS = [
  { name: "Neural Link", description: "Gains +1 Speed when below 3 HP" },
  { name: "Ghost Protocol", description: "First stealth action each turn costs 0" },
  { name: "Street Smart", description: "+2 to all district navigation checks" },
  { name: "Iron Chassis", description: "Immune to the first damage each round" },
  { name: "Data Sponge", description: "Draw an extra card when entering Corporate zones" },
  { name: "Voltage Surge", description: "After using Active Ability, gain +2 Speed next turn" },
  { name: "Shadow Step", description: "Can pass through Stealth barriers once per game" },
  { name: "Jury Rig", description: "Can repair board without losing a turn once per game" },
];

const ACTIVE_ABILITIES = [
  { name: "Turbo Boost", description: "Triple Speed for one turn; take 1 damage" },
  { name: "Smoke Screen", description: "All enemies lose sight of you until end of turn" },
  { name: "EMP Pulse", description: "Disable one Tech obstacle or enemy device" },
  { name: "Crowd Surf", description: "Move through occupied tiles without triggering reactions" },
  { name: "Data Heist", description: "Instantly complete a pickup without a skill check" },
  { name: "Grind Rail", description: "Travel along any rail or ledge for free this turn" },
  { name: "Bail and Roll", description: "Avoid all damage this turn; lose 2 Speed next turn" },
  { name: "Network Ping", description: "Reveal all hidden threats in current district" },
];

const FLAVOR_TEXTS = [
  "The megacity never sleeps, but the streets belong to those who dare.",
  "Chrome wheels on neon streets - this is what freedom sounds like.",
  "Every delivery is a chance to disappear into the grid.",
  "They built walls. We built wheels.",
  "In Nightshade, your reputation is your only currency.",
  "The package doesn't care who's chasing you.",
  "Fast enough to outrun the corps, smart enough to stay alive.",
  "Born in the Undercity, risen by the ride.",
];

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

export function generateCard(prompts: CardPrompts): CardPayload {
  const { frameSeed, backgroundSeed, characterSeed, masterSeed } = buildSeed(prompts);

  // Use master seed for identity / stat generation so the full card is still reproducible
  const rng = createSeededRandom(masterSeed);

  const firstName = rng.pick(FIRST_NAMES);
  const lastName = rng.pick(LAST_NAMES);
  const crew = rng.pick(CREWS);
  const manufacturer = rng.pick(MANUFACTURERS);

  const serialSuffix = String(seedFromString(masterSeed) % 10000).padStart(4, "0");
  const districtCode = prompts.district.replace(/\s/g, "").slice(0, 2).toUpperCase();
  const serialNumber = `${districtCode}-${new Date().getFullYear()}-${serialSuffix}`;

  const bias = ARCHETYPE_BIAS[prompts.archetype] || {};
  const mult = RARITY_MULTIPLIERS[prompts.rarity] || 1.0;

  const rawStat = (key: string) =>
    clamp(Math.round((rng.range(3, 8) + (bias[key] || 0)) * mult), 1, 10);

  const stats = {
    speed: rawStat("speed"),
    stealth: rawStat("stealth"),
    tech: rawStat("tech"),
    grit: rawStat("grit"),
    rep: rawStat("rep"),
    stamina: clamp(prompts.stamina, 1, 10),
  };

  const personalityTags = rng.pickN(PERSONALITY_TAGS, 3);
  const passiveTrait = rng.pick(PASSIVE_TRAITS);
  const activeAbility = rng.pick(ACTIVE_ABILITIES);
  const flavorText = rng.pick(FLAVOR_TEXTS);

  const helmetStyle = rng.pick(HELMET_STYLES);
  const boardStyle = rng.pick(BOARD_STYLES);
  const jacketStyle = rng.pick(JACKET_STYLES);
  const colorScheme = rng.pick(COLOR_SCHEMES);
  const storagePackStyle = storagePackFromStamina(prompts.stamina);

  const tags = [
    prompts.archetype.toLowerCase().replace(/\s/g, "-"),
    prompts.rarity.toLowerCase().replace(/\s/g, "-"),
    prompts.style.toLowerCase().replace(/\s/g, "-"),
    prompts.vibe.toLowerCase(),
    prompts.district.toLowerCase().replace(/\s/g, "-"),
    ...personalityTags.map((t) => t.toLowerCase()),
  ];

  return {
    id: `card-${masterSeed.replace(/[^a-z0-9]/gi, "-")}-${seedFromString(masterSeed)}`,
    version: "1.0.0",
    prompts: { ...prompts },
    seed: masterSeed,
    frameSeed,
    backgroundSeed,
    characterSeed,
    identity: {
      name: `${firstName} ${lastName}`,
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
  };
}
