/**
 * wheelHazardMatrix.ts — Wheel-type vs race-hazard interaction system.
 *
 * Workshop Feedback: "Make the Hardware Hurt"
 * Different wheel types respond differently to track hazards.
 * This matrix defines graduated multipliers and provides UI-friendly
 * descriptions shown during the race when hazards fire.
 *
 * Mirror changes to `server/lib/wheelHazardMatrix.js`.
 */

/**
 * Race hazard identifiers (matching EVENTS keys in race.ts).
 */
export type RaceHazardId = "pothole" | "wipeout" | "copDodge" | "courierHandoff" | "comeback";

export interface WheelHazardInteraction {
  /** Final multiplier applied (replaces the generic event multiplier). */
  multiplier: number;
  /** Short UI label shown in the race HUD. */
  label: string;
  /** Whether this wheel fully bypasses the hazard penalty. */
  bypasses: boolean;
}

/**
 * The core counter matrix.
 *
 * Keys: WheelType → RaceHazardId → interaction override.
 * If a wheel/hazard combo is NOT in the matrix, the default event multiplier applies.
 */
export const WHEEL_HAZARD_MATRIX: Partial<Record<string, Partial<Record<RaceHazardId, WheelHazardInteraction>>>> = {
  // ── Pneumatic Wheels ───────────────────────────────────────────────────────
  // Designed for rough terrain; absorbs impacts that devastate other wheels.
  Pneumatic: {
    pothole: {
      multiplier: 0.85,
      label: "🛞 Pneumatic Wheels absorb the pothole — minimal drag",
      bypasses: false,
    },
    wipeout: {
      multiplier: 0.55,
      label: "🛞 Pneumatic suspension reduces wipeout severity",
      bypasses: false,
    },
  },

  // ── Rubber Wheels ──────────────────────────────────────────────────────────
  // Good all-rounders; slight advantage on obstacles, nothing extreme.
  Rubber: {
    pothole: {
      multiplier: 0.60,
      label: "🔴 Rubber Wheels handle the pothole — reduced penalty",
      bypasses: false,
    },
    wipeout: {
      multiplier: 0.35,
      label: "🔴 Rubber grip reduces wipeout recovery time",
      bypasses: false,
    },
  },

  // ── Urethane Wheels ────────────────────────────────────────────────────────
  // Fast on smooth surfaces but terrible on rough terrain.
  Urethane: {
    pothole: {
      multiplier: 0.30,
      label: "⚠️ Urethane Wheels slam hard into the pothole — massive drag!",
      bypasses: false,
    },
    wipeout: {
      multiplier: 0.12,
      label: "⚠️ Urethane Wheels slide out on impact — devastating wipeout!",
      bypasses: false,
    },
    copDodge: {
      multiplier: 1.70,
      label: "⚡ Urethane speed advantage amplifies the cop dodge burst!",
      bypasses: false,
    },
    courierHandoff: {
      multiplier: 1.90,
      label: "⚡ Urethane grip on smooth ground boosts hand-off sprint!",
      bypasses: false,
    },
  },

  // ── Cloud Wheels ───────────────────────────────────────────────────────────
  // Maximized for comfort over speed; penalty resistance is high.
  Cloud: {
    pothole: {
      multiplier: 1.0,
      label: "☁️ Cloud Wheels glide over the pothole — no penalty!",
      bypasses: true,
    },
    wipeout: {
      multiplier: 0.45,
      label: "☁️ Cloud Wheels cushion the crash — reduced wipeout",
      bypasses: false,
    },
    copDodge: {
      multiplier: 1.40,
      label: "☁️ Cloud Wheels lack the burst speed for a full cop dodge",
      bypasses: false,
    },
  },

  // ── Vapor Wheels ───────────────────────────────────────────────────────────
  // Lightweight speed demons; shatter on impact.
  Vapor: {
    pothole: {
      multiplier: 0.20,
      label: "💨 Vapor Wheels shatter on the pothole — critical slowdown!",
      bypasses: false,
    },
    wipeout: {
      multiplier: 0.08,
      label: "💨 Vapor Wheels disintegrate on impact — catastrophic wipeout!",
      bypasses: false,
    },
    copDodge: {
      multiplier: 1.80,
      label: "💨 Vapor Wheels unleash max speed on the cop dodge!",
      bypasses: false,
    },
    courierHandoff: {
      multiplier: 1.95,
      label: "💨 Vapor Wheels hit blistering pace on the hand-off sprint!",
      bypasses: false,
    },
  },
};

/**
 * Resolve the effective multiplier and UI label for a given wheel + hazard combo.
 * Returns null if no special interaction exists (use default event multiplier).
 */
export function resolveWheelHazardInteraction(
  wheelType: string | null | undefined,
  hazardId: RaceHazardId,
): WheelHazardInteraction | null {
  if (!wheelType) return null;
  const wheelEntry = WHEEL_HAZARD_MATRIX[wheelType];
  if (!wheelEntry) return null;
  return wheelEntry[hazardId] ?? null;
}

/**
 * Format the counter math for display in the race HUD.
 * Shows before/after multipliers so the player sees the impact.
 */
export function formatCounterMathDisplay(
  wheelType: string,
  hazardTag: string,
  defaultMultiplier: number,
  interaction: WheelHazardInteraction,
): string {
  const defaultPct = Math.round((1 - defaultMultiplier) * 100);
  const actualPct = Math.round((1 - interaction.multiplier) * 100);

  if (interaction.bypasses) {
    return `${wheelType} → ${hazardTag}: BYPASSED (0% penalty vs ${defaultPct}% default)`;
  }

  if (interaction.multiplier > defaultMultiplier) {
    // Wheel makes the hazard worse
    return `${wheelType} → ${hazardTag}: ${actualPct}% penalty (vs ${defaultPct}% default) ⚠️`;
  }

  if (interaction.multiplier > 1) {
    // Boost event — wheel amplifies it
    const boostPct = Math.round((interaction.multiplier - 1) * 100);
    const defaultBoostPct = Math.round((defaultMultiplier - 1) * 100);
    return `${wheelType} → ${hazardTag}: +${boostPct}% boost (vs +${defaultBoostPct}% default) ⚡`;
  }

  // Wheel reduces the penalty
  return `${wheelType} → ${hazardTag}: ${actualPct}% penalty (vs ${defaultPct}% default) ✓`;
}
