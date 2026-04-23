/**
 * skaterBoardSynthesis.ts
 *
 * Single source of truth for forging a complete CardPayload from user prompts
 * and a board configuration.
 *
 * buildForgedCard() is the only entry point for creating new cards.
 * It deterministically derives all fields from the provided inputs.
 */

import { LORE_CHARACTER_NAMES, ARCHETYPE_TO_FACTION } from "./lore";
import { createSeededRandom, seedFromString } from "./prng";
import { calculateBoardStats, computeSkateStats, getBoardSummary } from "./boardBuilder";
import { BOARD_TYPE_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS, BATTERY_OPTIONS, normalizeBoardConfig } from "./boardBuilder";
import { getCoverIdentityProfile } from "./coverIdentity";
import { getClassMultiplier, getClassBadgeLabel } from "./classScaling";
import { createDefaultMaintenance } from "./cardMaintenance";
import { resolveArchetypeStyle } from "./styles";
import type { CardPayload, CardPrompts, ForgedBoardComponents, ForgedRoleData, ForgedVarianceData } from "./types";
import type { BoardConfig } from "./boardBuilderTypes";

export interface BuildForgedCardInput {
  prompts: CardPrompts;
  boardConfig: BoardConfig;
  idNonce?: string;
}

// ── Stat scaling ─────────────────────────────────────────────────────────────

/**
 * The raw SkateStats values are in a ~0–500 total range (each component
 * contributes up to 100 points across four stats).  We divide by STAT_SCALE
 * to bring each stat to a 0–10 display scale.
 */
const STAT_SCALE = 30;
const MAX_STAT = 10;
const MIN_STAT = 0;

function scaleRaw(raw: number): number {
  return Math.max(MIN_STAT, Math.min(MAX_STAT, Math.round(raw / STAT_SCALE)));
}

// ── Visual style tables ────────────────────────────────────────────────────────

const HELMET_STYLES: Record<string, string[]> = {
  Corporate:      ["exec-visor",   "mirror-shield",  "corp-dome"],
  Street:         ["graffiti-lid", "open-face",       "half-shell"],
  "Off-grid":     ["salvage-dome", "rough-cut",       "wrapped-rag"],
  Union:          ["hard-hat",     "bump-cap",        "safety-dome"],
  Olympic:        ["aero-helm",    "pro-visor",       "race-dome"],
  "Punk Rocker":  ["mohawk-cap",   "studded-lid",     "diy-bucket"],
  "Ex Military":  ["field-cap",    "patrol-helm",     "surplus-dome"],
  Fascist:        ["explorer-hat", "safari-helm",     "utility-cap"],
};

const JACKET_STYLES: Record<string, string[]> = {
  Corporate:      ["trench-corp",  "suit-jacket",    "exec-coat"],
  Street:         ["bomber",       "hoodie-zip",     "denim-cut"],
  "Off-grid":     ["poncho",       "patched-vest",   "salvage-coat"],
  Union:          ["work-vest",    "hi-vis-jacket",  "overalls"],
  Olympic:        ["tracksuit-top","sponsor-jacket", "pro-warmup"],
  "Punk Rocker":  ["patched-denim","studded-vest",   "diy-jacket"],
  "Ex Military":  ["surplus-coat", "tac-surplus",    "cheap-armor-vest"],
  Fascist:        ["explorer-vest","utility-coat",   "survival-jacket"],
};

const COLOR_SCHEMES: string[] = [
  "muted-rust",    "faded-black",   "weathered-grey",
  "hot-pink",      "electric-blue", "acid-green",
  "silver-white",  "mirror-blue",   "steel-grey",
  "primary-red",   "plastic-yellow","toy-blue",
];

const STORAGE_PACK_STYLES = ["shopping-bag", "backpack", "cardboard-box", "duffel-bag"] as const;

// ── Main function ────────────────────────────────────────────────────────────

export function buildCharacterSeed(prompts: CardPrompts): string {
  return `${prompts.archetype}|${prompts.style}|${prompts.gender}|${prompts.ageGroup}|${prompts.bodyType}|${prompts.hairLength ?? ""}|${prompts.accentColor}|${prompts.skinTone ?? ""}|${prompts.faceCharacter ?? ""}`;
}

export function buildForgedCard({ prompts, boardConfig, idNonce }: BuildForgedCardInput): CardPayload {
  // ── Resolve style from archetype ──────────────────────────────────────────
  const resolvedStyle = resolveArchetypeStyle(prompts.archetype, prompts.style);
  const forgePrompts = { ...prompts, style: resolvedStyle };

  // ── Seeds ──────────────────────────────────────────────────────────────────
  const characterSeed  = buildCharacterSeed(forgePrompts);
  const backgroundSeed = forgePrompts.district;
  const frameSeed      = forgePrompts.rarity;
  const masterSeed     = `${frameSeed}::${backgroundSeed}::${characterSeed}`;

  // Deterministic RNG seeded on character attributes only
  const charRng = createSeededRandom(characterSeed);

  // ── Class (rarity) ─────────────────────────────────────────────────────────
  const rarity = forgePrompts.rarity;
  const classMultiplier = getClassMultiplier(rarity);
  const classBadgeLabel = getClassBadgeLabel(rarity);

  // ── Role (archetype identity + passives) ──────────────────────────────────
  const identityProfile = getCoverIdentityProfile(forgePrompts.archetype);
  const role: ForgedRoleData = {
    archetype: forgePrompts.archetype,
    label: identityProfile?.label ?? String(forgePrompts.archetype),
    coverRole: identityProfile?.coverRole ?? String(forgePrompts.archetype).toLowerCase(),
    passiveName: identityProfile?.passiveName ?? "Courier's Edge",
    passiveDescription: identityProfile?.passiveDescription ?? "Experienced runner keeps moving.",
    roleBonuses: identityProfile?.roleBonuses ?? { speed: 0, range: 0, stealth: 0, grit: 0 },
  };

  // ── Board stats ────────────────────────────────────────────────────────────
  const normalizedBoard = normalizeBoardConfig(boardConfig);
  const isCriticalForge = charRng.next() < 0.05; // 5 % chance, deterministic per seed
  const skateStats = computeSkateStats(normalizedBoard, { criticalForge: isCriticalForge });
  const boardLoadout = calculateBoardStats(normalizedBoard);

  // ── Variance (deterministic, seeded) ──────────────────────────────────────
  const varianceRange = 2; // ±2 before clamping
  const variance: ForgedVarianceData = {
    speed:   charRng.range(-varianceRange, varianceRange),
    range:   charRng.range(-varianceRange, varianceRange),
    stealth: charRng.range(-varianceRange, varianceRange),
    grit:    charRng.range(-varianceRange, varianceRange),
  };

  // ── Final stats: scale board → 0-10, add role bonuses + variance, apply class multiplier ──
  const rb = role.roleBonuses;

  function deriveStat(raw: number, roleBonus: number, vari: number): number {
    const base = scaleRaw(raw);
    return Math.max(MIN_STAT, Math.min(MAX_STAT, Math.round((base + roleBonus + vari) * classMultiplier)));
  }

  const finalSpeed   = deriveStat(skateStats.spd, rb.speed,   variance.speed);
  const finalRange   = deriveStat(skateStats.rng, rb.range,   variance.range);
  const finalStealth = deriveStat(skateStats.stl, rb.stealth, variance.stealth);
  const finalGrit    = deriveStat(skateStats.grt, rb.grit,    variance.grit);
  const rangeNm      = Math.round(skateStats.rng / 10); // raw range units → nautical miles

  // ── Visuals ────────────────────────────────────────────────────────────────
  const storagePackStyle = charRng.pick([...STORAGE_PACK_STYLES]);
  const helmetStyle  = charRng.pick(HELMET_STYLES[forgePrompts.style] ?? ["standard-helm"]);
  const jacketStyle  = charRng.pick(JACKET_STYLES[forgePrompts.style] ?? ["standard-jacket"]);
  const colorScheme  = charRng.pick(COLOR_SCHEMES);

  // ── Identity ───────────────────────────────────────────────────────────────
  const name         = charRng.pick(LORE_CHARACTER_NAMES);
  const serialSuffix = Math.abs(seedFromString(characterSeed)) % 10000;
  const serialNumber = `PS-${String(serialSuffix).padStart(4, "0")}`;

  // ── Card ID (deterministic per full prompt + nonce) ───────────────────────
  const effectiveNonce = idNonce ?? crypto.randomUUID();
  const idSeed  = `${masterSeed}::${effectiveNonce}`;
  const idHash  = Math.abs(seedFromString(idSeed)).toString(36).padStart(7, "0");
  const nonceSuffix = effectiveNonce.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(-24);
  const id = `forge-${idHash}-${nonceSuffix}`;

  // ── Board metadata ─────────────────────────────────────────────────────────
  const boardComponents: ForgedBoardComponents = {
    boardType:  normalizedBoard.boardType,
    drivetrain: normalizedBoard.drivetrain,
    motor:      normalizedBoard.motor,
    wheels:     normalizedBoard.wheels,
    battery:    normalizedBoard.battery,
  };

  const loadoutSummary = getBoardSummary(normalizedBoard);

  const accessProfile = boardLoadout.accessProfile;

  // ── Assemble payload ───────────────────────────────────────────────────────
  return {
    id,
    version: "2.0.0",
    createdAt: new Date().toISOString(),

    seed: masterSeed,
    frameSeed,
    backgroundSeed,
    characterSeed,

    prompts: { ...forgePrompts },

    class: {
      rarity,
      multiplier: classMultiplier,
      badgeLabel: classBadgeLabel,
    },

    identity: {
      name,
      crew: ARCHETYPE_TO_FACTION[forgePrompts.archetype],
      serialNumber,
      age: "",
    },

    role,

    variance,

    stats: {
      speed:   finalSpeed,
      range:   finalRange,
      rangeNm,
      stealth: finalStealth,
      grit:    finalGrit,
    },

    board: {
      config:        normalizedBoard,
      loadout:       boardLoadout,
      totalWeight:   skateStats.totalWeight,
      tuned:         isCriticalForge,
      components:    boardComponents,
      loadoutSummary,
      accessProfile,
    },

    maintenance: createDefaultMaintenance(rarity),

    visuals: {
      helmetStyle,
      jacketStyle,
      colorScheme,
      accentColor: forgePrompts.accentColor,
      storagePackStyle,
    },

    front: {
      flavorText: `Running packages through ${forgePrompts.district}.`,
    },

    back: {},
  };
}

// ── Board component label helpers ────────────────────────────────────────────

export function getBoardComponentLabels(boardConfig: BoardConfig): {
  boardTypeLabel: string;
  drivetrainLabel: string;
  motorLabel: string;
  wheelsLabel: string;
  batteryLabel: string;
  boardTypeIcon: string;
  drivetrainIcon: string;
  motorIcon: string;
  wheelsIcon: string;
  batteryIcon: string;
} {
  const nb = normalizeBoardConfig(boardConfig);
  const bt = BOARD_TYPE_OPTIONS.find((o) => o.value === nb.boardType);
  const dr = DRIVETRAIN_OPTIONS.find((o) => o.value === nb.drivetrain);
  const mt = MOTOR_OPTIONS.find((o) => o.value === nb.motor);
  const wh = WHEEL_OPTIONS.find((o) => o.value === nb.wheels);
  const ba = BATTERY_OPTIONS.find((o) => o.value === nb.battery);
  return {
    boardTypeLabel:  bt?.label ?? nb.boardType,
    drivetrainLabel: dr?.label ?? nb.drivetrain,
    motorLabel:      mt?.label ?? nb.motor,
    wheelsLabel:     wh?.label ?? nb.wheels,
    batteryLabel:    ba?.label ?? nb.battery,
    boardTypeIcon:   bt?.icon  ?? "🛹",
    drivetrainIcon:  dr?.icon  ?? "⚙️",
    motorIcon:       mt?.icon  ?? "⚡",
    wheelsIcon:      wh?.icon  ?? "⚫",
    batteryIcon:     ba?.icon  ?? "🔋",
  };
}
