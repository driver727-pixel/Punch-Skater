import { BOARD_TYPE_OPTIONS, BATTERY_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS } from "./boardBuilder";
import { createSeededRandom } from "./prng";
import type { CardPayload, JoustCardProfile } from "./types";

const STYLE_HYPE_BONUS: Record<string, number> = {
  Corporate: 1,
  "Punk Rocker": 2,
  "Ex Military": 0,
  Fascist: 0,
  Street: 1,
  "Off-grid": 1,
  Union: 1,
  Olympic: 2,
};

const STYLE_ARMOR_TAG: Record<string, string> = {
  Corporate: "corp shell",
  "Punk Rocker": "neon leathers",
  "Ex Military": "tactical mesh",
  Fascist: "ironplate cut",
  Street: "street shell",
  "Off-grid": "scrap weave",
  Union: "crew canvas",
  Olympic: "velocity weave",
};

const LANCE_TYPE_POOLS: Record<string, readonly string[]> = {
  Belt: ["kinetic", "heavy"],
  Hub: ["signal", "glitch"],
  Gear: ["heavy", "bone-blade"],
  "4WD": ["heavy", "kinetic", "bone-blade"],
};

const STYLE_LANCE_TYPES: Record<string, string> = {
  Corporate: "signal",
  "Punk Rocker": "neon",
  "Ex Military": "heavy",
  Fascist: "bone-blade",
  Street: "kinetic",
  "Off-grid": "glitch",
  Union: "kinetic",
  Olympic: "neon",
};

const SHIELD_TYPE_POOLS: Record<string, readonly string[]> = {
  SlimStealth: ["holo", "mirror"],
  DoubleStack: ["riot", "magnetic"],
  TopPeli: ["magnetic", "banner"],
};

const STYLE_SHIELD_TYPES: Record<string, string> = {
  Corporate: "mirror",
  "Punk Rocker": "holo",
  "Ex Military": "riot",
  Fascist: "banner",
  Street: "riot",
  "Off-grid": "scrap",
  Union: "banner",
  Olympic: "mirror",
};

const RARITY_HYPE_BONUS: Record<string, number> = {
  Rare: 1,
  Legendary: 2,
};

export const JOUST_TRAIT_SUMMARIES: Record<string, string> = {
  "Boost Charge": "+1 Lance when Boost wins the read.",
  "Street Parry": "+1 Shield on tight Counter lines.",
  "Magnetic Guard": "+2 Shield on committed Guard plays.",
  "Heavy Lance": "+2 Lance on Charge, -1 Speed.",
  "Riot Shield": "+1 Shield and +1 Grit on Guard.",
  "Neon Flourish": "+1 Hype on flashy Trick Strikes.",
};

function clampJoustStat(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function uniq<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatJoustGearLabel(type: string, suffix?: string): string {
  const base = toTitleCase(type);
  return suffix ? `${base} ${suffix}` : base;
}

function getBoardTypeLabel(card: CardPayload): string {
  return BOARD_TYPE_OPTIONS.find((option) => option.value === card.board.config.boardType)?.label
    ?? card.board.components.boardType
    ?? card.board.config.boardType
    ?? "Street";
}

function deriveLanceType(card: CardPayload): string {
  const rng = createSeededRandom(`${card.seed}::lance`);
  const candidates = uniq([
    STYLE_LANCE_TYPES[card.prompts.style],
    ...(LANCE_TYPE_POOLS[card.board.config.drivetrain] ?? []),
    card.prompts.rarity === "Legendary" ? "glitch" : undefined,
  ].filter((value): value is string => Boolean(value)));
  return rng.pick(candidates);
}

function deriveShieldType(card: CardPayload): string {
  const rng = createSeededRandom(`${card.seed}::shield`);
  const candidates = uniq([
    STYLE_SHIELD_TYPES[card.prompts.style],
    ...(SHIELD_TYPE_POOLS[card.board.config.battery] ?? []),
    card.board.config.wheels === "Rubber" ? "scrap" : undefined,
    card.board.config.wheels === "Cloud" ? "mirror" : undefined,
  ].filter((value): value is string => Boolean(value)));
  return rng.pick(candidates);
}

function deriveTraits(card: CardPayload, profile: Omit<JoustCardProfile, "traits">): string[] {
  const candidates = uniq([
    profile.lance >= 8 || card.board.config.motor === "Outrunner" ? "Boost Charge" : undefined,
    card.board.config.boardType === "Street" || card.board.config.wheels === "Urethane" ? "Street Parry" : undefined,
    profile.gear.shieldType === "magnetic" ? "Magnetic Guard" : undefined,
    profile.gear.lanceType === "heavy" || profile.gear.lanceType === "bone-blade" ? "Heavy Lance" : undefined,
    profile.gear.shieldType === "riot" || card.board.config.wheels === "Rubber" ? "Riot Shield" : undefined,
    profile.hype >= 8 || profile.gear.lanceType === "neon" ? "Neon Flourish" : undefined,
  ].filter((value): value is string => Boolean(value)));

  const rng = createSeededRandom(`${card.seed}::traits`);
  const resolved = candidates.length > 0 ? rng.pickN(candidates, Math.min(2, candidates.length)) : [];
  if (resolved.length > 0) {
    return resolved;
  }
  return [profile.lance >= profile.shield ? "Heavy Lance" : "Street Parry"];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function deriveJoustProfile(card: CardPayload): JoustCardProfile {
  const boardTypeLabel = getBoardTypeLabel(card);
  const lanceType = deriveLanceType(card);
  const shieldType = deriveShieldType(card);
  const armorTag = STYLE_ARMOR_TAG[card.prompts.style] ?? "street shell";
  const batteryBonus = BATTERY_OPTIONS.find((option) => option.value === card.board.config.battery)?.range ?? 0;
  const motorAcceleration = MOTOR_OPTIONS.find((option) => option.value === card.board.config.motor)?.acceleration ?? 0;
  const drivetrainWeight = DRIVETRAIN_OPTIONS.find((option) => option.value === card.board.config.drivetrain)?.weight ?? 0;
  const wheelGrip = WHEEL_OPTIONS.find((option) => option.value === card.board.config.wheels)?.weight ?? 0;

  const lance = clampJoustStat(
    (card.stats.speed + card.stats.grit) / 2
      + (motorAcceleration >= 8 ? 1 : 0)
      + (drivetrainWeight >= 30 ? 1 : 0),
  );
  const shield = clampJoustStat(
    (card.stats.grit + card.stats.stealth) / 2
      + (batteryBonus >= 8 ? 1 : 0)
      + (wheelGrip >= 30 ? 1 : 0),
  );
  const rarityHypeBonus = RARITY_HYPE_BONUS[card.prompts.rarity] ?? 0;
  const hype = clampJoustStat(
    (card.stats.speed + card.stats.stealth + card.stats.range) / 3
      + (STYLE_HYPE_BONUS[card.prompts.style] ?? 0)
      + rarityHypeBonus
      + (card.board.tuned ? 1 : 0),
  );

  const baseProfile = {
    lance,
    shield,
    hype,
    gear: {
      boardType: boardTypeLabel,
      lanceType,
      shieldType,
      armorTag,
    },
  } satisfies Omit<JoustCardProfile, "traits">;

  return {
    ...baseProfile,
    traits: deriveTraits(card, baseProfile),
  };
}

export function normalizeJoustProfile(card: CardPayload): JoustCardProfile {
  const derived = deriveJoustProfile(card);
  const current = card.joust;
  if (!current) {
    return derived;
  }

  const normalized: JoustCardProfile = {
    lance: Number.isFinite(current.lance) ? clampJoustStat(current.lance) : derived.lance,
    shield: Number.isFinite(current.shield) ? clampJoustStat(current.shield) : derived.shield,
    hype: Number.isFinite(current.hype) ? clampJoustStat(current.hype) : derived.hype,
    gear: {
      boardType: isNonEmptyString(current.gear?.boardType) ? current.gear.boardType : derived.gear.boardType,
      lanceType: isNonEmptyString(current.gear?.lanceType) ? current.gear.lanceType : derived.gear.lanceType,
      shieldType: isNonEmptyString(current.gear?.shieldType) ? current.gear.shieldType : derived.gear.shieldType,
      armorTag: isNonEmptyString(current.gear?.armorTag) ? current.gear.armorTag : derived.gear.armorTag,
    },
    traits: Array.isArray(current.traits)
      ? uniq(current.traits.filter((trait): trait is string => isNonEmptyString(trait))).slice(0, 2)
      : derived.traits,
  };

  if (
    normalized.lance === current.lance
    && normalized.shield === current.shield
    && normalized.hype === current.hype
    && normalized.gear.boardType === current.gear?.boardType
    && normalized.gear.lanceType === current.gear?.lanceType
    && normalized.gear.shieldType === current.gear?.shieldType
    && normalized.gear.armorTag === current.gear?.armorTag
    && normalized.traits.length === (current.traits?.length ?? 0)
    && normalized.traits.every((trait, index) => trait === current.traits?.[index])
  ) {
    return current;
  }

  if (normalized.traits.length === 0) {
    normalized.traits = derived.traits;
  }

  return normalized;
}
