import { DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import { buildForgedCard } from "./skaterBoardSynthesis";
import { createSeededRandom } from "./prng";
import type {
  AgeGroup,
  Archetype,
  BodyType,
  CardPayload,
  CardPrompts,
  District,
  FaceCharacter,
  Gender,
  HairLength,
  Rarity,
  SkinTone,
} from "./types";

export interface PlayerProgressionSnapshot {
  missionXp: number;
  missionOzzies: number;
  /**
   * Current Deck Power of the player's active 6-card Crew.
   * Once this reaches a threshold, the corresponding forge rarity tier unlocks.
   * Deck Power = sum of all stat Points across all 6 Crew cards.
   */
  deckPower?: number;
}

export interface ForgeClassOption {
  rarity: Exclude<Rarity, "Legendary">;
  unlocked: boolean;
  unlockHint: string | null;
}

interface ClassUnlockRule {
  rarity: ForgeClassOption["rarity"];
  minXp: number;
  minOzzies: number;
  /** Deck Power threshold — reaches this by building a strong 6-card Crew. */
  minDeckPower: number;
}

const ARCHETYPES: Archetype[] = [
  "Qu111s",
  "Ne0n Legion",
  "Iron Curtains",
  "The Asclepians",
  "The Mesopotamian Society",
  "Hermes' Squirmies",
  "UCPS",
  "The Team",
  "The Knights Technarchy",
];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];
const AGE_GROUPS: AgeGroup[] = ["Young Adult", "Adult", "Middle-aged", "Senior"];
const BODY_TYPES: BodyType[] = ["Slim", "Athletic", "Average", "Heavy"];
const HAIR_LENGTHS: HairLength[] = ["Bald", "Short", "Medium", "Long"];
const SKIN_TONES: SkinTone[] = ["Light", "Medium", "Dark", "Very Dark"];
const FACE_CHARACTERS: FaceCharacter[] = ["Conventional", "Attractive", "Weathered", "Scarred", "Rugged"];
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#3366ff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];

export const LEGENDARY_FORGE_NOTICE = "Legendary cards are not forgeable.";

/**
 * Forge-class unlock rules.
 *
 * A rarity tier unlocks when the player meets ANY of:
 *   - `minXp`      mission XP threshold, OR
 *   - `minOzzies`  mission Ozzies threshold, OR
 *   - `minDeckPower` active Crew Deck Power threshold
 *
 * The Deck Power thresholds are expressed relative to the long-term design
 * target of 10,000 max Deck Power (see progression.ts).  As the stat ceiling
 * rises in future sprints, these numbers will remain the authoritative target.
 *
 * No-pay-to-win: progression must come from play.
 */
export const FORGE_CLASS_RULES: readonly ClassUnlockRule[] = [
  { rarity: "Punch Skater", minXp: 0,   minOzzies: 0,   minDeckPower: 0 },
  { rarity: "Apprentice",   minXp: 80,  minOzzies: 40,  minDeckPower: 1_000 },
  { rarity: "Master",       minXp: 220, minOzzies: 110, minDeckPower: 2_500 },
  { rarity: "Rare",         minXp: 480, minOzzies: 240, minDeckPower: 5_000 },
] as const;

function normalizeProgressionValue(value: number | undefined): number {
  return Math.max(0, Number(value) || 0);
}

function getUnlockRule(rarity: ForgeClassOption["rarity"]): ClassUnlockRule {
  return FORGE_CLASS_RULES.find((rule) => rule.rarity === rarity) ?? FORGE_CLASS_RULES[0];
}

export function isForgeClassUnlocked(
  rarity: ForgeClassOption["rarity"],
  progression: PlayerProgressionSnapshot,
): boolean {
  const rule = getUnlockRule(rarity);
  if (rule.minXp === 0 && rule.minOzzies === 0 && rule.minDeckPower === 0) return true;
  const missionXp = normalizeProgressionValue(progression.missionXp);
  const missionOzzies = normalizeProgressionValue(progression.missionOzzies);
  const deckPower = normalizeProgressionValue(progression.deckPower);
  return missionXp >= rule.minXp || missionOzzies >= rule.minOzzies || deckPower >= rule.minDeckPower;
}

export function getForgeClassOptions(progression: PlayerProgressionSnapshot): ForgeClassOption[] {
  return FORGE_CLASS_RULES.map((rule) => ({
    rarity: rule.rarity,
    unlocked: isForgeClassUnlocked(rule.rarity, progression),
    unlockHint: rule.minXp === 0 && rule.minOzzies === 0 && rule.minDeckPower === 0
      ? null
      : `Unlock with ${rule.minXp.toLocaleString()} XP, ${rule.minOzzies.toLocaleString()} Ozzies, or ${rule.minDeckPower.toLocaleString()} Deck Power.`,
  }));
}

export function normalizeForgeRarity(
  rarity: Rarity,
  progression: PlayerProgressionSnapshot,
): ForgeClassOption["rarity"] {
  if (rarity !== "Legendary" && isForgeClassUnlocked(rarity, progression)) {
    return rarity;
  }
  const unlockedOptions = getForgeClassOptions(progression).filter((option) => option.unlocked);
  return unlockedOptions[unlockedOptions.length - 1]?.rarity ?? "Punch Skater";
}

function pick<T>(rng: ReturnType<typeof createSeededRandom>, values: readonly T[]): T {
  return rng.pick(values as T[]);
}

export function buildSignupBonusCard(uid: string): CardPayload {
  const rng = createSeededRandom(`signup-bonus:${uid}`);
  const prompts: CardPrompts = {
    archetype: pick(rng, ARCHETYPES),
    rarity: "Rare",
    style: "Street",
    district: pick(rng, DISTRICTS),
    accentColor: pick(rng, ACCENT_PRESETS),
    gender: pick(rng, GENDERS),
    ageGroup: pick(rng, AGE_GROUPS),
    bodyType: pick(rng, BODY_TYPES),
    hairLength: pick(rng, HAIR_LENGTHS),
    skinTone: pick(rng, SKIN_TONES),
    faceCharacter: pick(rng, FACE_CHARACTERS),
  };

  return buildForgedCard({
    prompts,
    boardConfig: DEFAULT_BOARD_CONFIG,
    idNonce: `signup-bonus:${uid}`,
  });
}
