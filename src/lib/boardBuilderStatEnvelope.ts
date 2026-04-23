/**
 * boardBuilderStatEnvelope.ts
 *
 * The Skateboard Stat Engine — calculates four core stats for a board loadout:
 *   SPD (Speed), RNG (Range), STL (Stealth), GRT (Grit)
 *
 * Design rules:
 *  - Each of the 5 components contributes exactly 100 base stat points.
 *  - Total base stats across all 5 components = 500.
 *  - Weight Penalty: subtracts (TotalWeight × 0.5) from SPD and STL (floored at 0).
 *  - Critical Forge (5% chance): reduces the effective weight by 15 % before
 *    applying the penalty, and marks the result as isTuned = true.
 */

import type { BoardConfig, SkateStats } from "./boardBuilderTypes";
import type { BoardType, Drivetrain, MotorType, WheelType, BatteryType } from "./boardBuilderTypes";
import { normalizeBoardConfig } from "./boardBuilderCompatibility";

interface StatEntry { spd: number; rng: number; stl: number; grt: number }

// ── Base stat tables (each row must sum to exactly 100) ──────────────────────

const DECK_STATS: Record<BoardType, StatEntry> = {
  Street:  { spd: 40, rng: 15, stl: 35, grt: 10 },
  Surf:    { spd: 25, rng: 20, stl: 45, grt: 10 },
  AT:      { spd: 20, rng: 30, stl: 15, grt: 35 },
  Mountain:{ spd: 15, rng: 20, stl: 10, grt: 55 },
  Slider:  { spd: 40, rng: 15, stl: 35, grt: 10 }, // mirrors Street
};

const DRIVETRAIN_STATS: Record<Drivetrain, StatEntry> = {
  Belt: { spd: 45, rng: 15, stl: 20, grt: 20 },
  Hub:  { spd: 25, rng: 15, stl: 50, grt: 10 },
  Gear: { spd: 20, rng: 20, stl: 15, grt: 45 },
  "4WD":{ spd: 15, rng: 20, stl: 10, grt: 55 },
};

const MOTOR_STATS: Record<MotorType, StatEntry> = {
  Micro:     { spd: 20, rng: 40, stl: 35, grt:  5 },
  Standard:  { spd: 30, rng: 30, stl: 25, grt: 15 },
  Torque:    { spd: 35, rng: 20, stl: 15, grt: 30 },
  Outrunner: { spd: 20, rng: 20, stl: 10, grt: 50 },
};

const WHEEL_STATS: Record<WheelType, StatEntry> = {
  Urethane:  { spd: 40, rng: 15, stl: 30, grt: 15 },
  Cloud:     { spd: 30, rng: 20, stl: 40, grt: 10 },
  Pneumatic: { spd: 20, rng: 30, stl: 15, grt: 35 },
  Rubber:    { spd: 15, rng: 25, stl: 15, grt: 45 },
};

const BATTERY_STATS: Record<BatteryType, StatEntry> = {
  SlimStealth: { spd: 25, rng: 25, stl: 45, grt:  5 },
  DoubleStack: { spd: 15, rng: 55, stl: 10, grt: 20 },
  TopPeli:     { spd: 10, rng: 60, stl:  5, grt: 25 },
};

// ── Weight tables (mirrors boardBuilderOptions weight values) ────────────────

const DECK_WEIGHT: Record<BoardType, number> = {
  Street: 10, Surf: 20, AT: 30, Mountain: 40, Slider: 10,
};

const DRIVETRAIN_WEIGHT: Record<Drivetrain, number> = {
  Belt: 10, Hub: 20, Gear: 30, "4WD": 40,
};

const MOTOR_WEIGHT: Record<MotorType, number> = {
  Micro: 10, Standard: 20, Torque: 30, Outrunner: 40,
};

const WHEEL_WEIGHT: Record<WheelType, number> = {
  Urethane: 10, Cloud: 20, Pneumatic: 30, Rubber: 40,
};

const BATTERY_WEIGHT: Record<BatteryType, number> = {
  SlimStealth: 10, DoubleStack: 30, TopPeli: 40,
};

// ── Critical Forge constants ─────────────────────────────────────────────────

/** Probability (0–1) of triggering a Critical Forge on any single forge action. */
export const CRITICAL_FORGE_CHANCE = 0.05;

/** Fraction by which effective total weight is reduced on a Critical Forge. */
export const CRITICAL_FORGE_WEIGHT_REDUCTION = 0.15;

// ── Public API ───────────────────────────────────────────────────────────────

interface ComputeSkateStatsOptions {
  /** When true the formula applies the Critical Forge weight reduction. */
  criticalForge?: boolean;
}

/**
 * Computes the four-stat envelope (SPD, RNG, STL, GRT) for a given board
 * configuration.  The result always includes total weight and the tuned flag.
 *
 * @param config        - The five-component board configuration to evaluate.
 * @param options       - Optional flags (criticalForge).
 */
export function computeSkateStats(
  config: BoardConfig,
  options: ComputeSkateStatsOptions = {},
): SkateStats {
  const c = normalizeBoardConfig(config);
  const { criticalForge = false } = options;

  // ── Sum base stats from all five components ──────────────────────────────
  const deck     = DECK_STATS[c.boardType];
  const drive    = DRIVETRAIN_STATS[c.drivetrain];
  const motor    = MOTOR_STATS[c.motor];
  const wheels   = WHEEL_STATS[c.wheels];
  const battery  = BATTERY_STATS[c.battery];

  const baseSpd = deck.spd + drive.spd + motor.spd + wheels.spd + battery.spd;
  const baseRng = deck.rng + drive.rng + motor.rng + wheels.rng + battery.rng;
  const baseStl = deck.stl + drive.stl + motor.stl + wheels.stl + battery.stl;
  const baseGrt = deck.grt + drive.grt + motor.grt + wheels.grt + battery.grt;

  // ── Compute total weight ─────────────────────────────────────────────────
  const rawWeight =
    DECK_WEIGHT[c.boardType] +
    DRIVETRAIN_WEIGHT[c.drivetrain] +
    MOTOR_WEIGHT[c.motor] +
    WHEEL_WEIGHT[c.wheels] +
    BATTERY_WEIGHT[c.battery];

  // Use full-precision effective weight for the penalty so that Critical Forge
  // produces a measurably different result even at low raw weights.
  // The stored totalWeight is rounded for display purposes only.
  const effectiveWeight = criticalForge
    ? rawWeight * (1 - CRITICAL_FORGE_WEIGHT_REDUCTION)
    : rawWeight;
  const totalWeight = Math.round(effectiveWeight);

  // ── Apply weight penalty to SPD and STL ─────────────────────────────────
  const penalty = effectiveWeight * 0.5;
  const spd = Math.max(0, Math.round(baseSpd - penalty));
  const stl = Math.max(0, Math.round(baseStl - penalty));

  return {
    spd,
    rng: baseRng,
    stl,
    grt: baseGrt,
    totalWeight,
    isTuned: criticalForge,
  };
}
