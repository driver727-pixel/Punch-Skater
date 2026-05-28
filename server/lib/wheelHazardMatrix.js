/**
 * wheelHazardMatrix.js — Wheel-type vs race-hazard interaction system (server canonical).
 *
 * Workshop Feedback: "Make the Hardware Hurt"
 * Different wheel types respond differently to track hazards.
 * The race resolver uses this matrix to apply graduated multipliers
 * based on the racer's equipped wheel type.
 *
 * Client mirror: src/lib/wheelHazardMatrix.ts
 */

/**
 * The core counter matrix.
 * Keys: WheelType → RaceHazardId → { multiplier, label, bypasses }
 * If a wheel/hazard combo is NOT in the matrix, the default event multiplier applies.
 */
export const WHEEL_HAZARD_MATRIX = {
  Pneumatic: {
    pothole: { multiplier: 0.85, label: '🛞 Pneumatic Wheels absorb the pothole — minimal drag', bypasses: false },
    wipeout: { multiplier: 0.55, label: '🛞 Pneumatic suspension reduces wipeout severity', bypasses: false },
  },
  Rubber: {
    pothole: { multiplier: 0.60, label: '🔴 Rubber Wheels handle the pothole — reduced penalty', bypasses: false },
    wipeout: { multiplier: 0.35, label: '🔴 Rubber grip reduces wipeout recovery time', bypasses: false },
  },
  Urethane: {
    pothole: { multiplier: 0.30, label: '⚠️ Urethane Wheels slam hard into the pothole — massive drag!', bypasses: false },
    wipeout: { multiplier: 0.12, label: '⚠️ Urethane Wheels slide out on impact — devastating wipeout!', bypasses: false },
    copDodge: { multiplier: 1.70, label: '⚡ Urethane speed advantage amplifies the cop dodge burst!', bypasses: false },
    courierHandoff: { multiplier: 1.90, label: '⚡ Urethane grip on smooth ground boosts hand-off sprint!', bypasses: false },
  },
  Cloud: {
    pothole: { multiplier: 1.0, label: '☁️ Cloud Wheels glide over the pothole — no penalty!', bypasses: true },
    wipeout: { multiplier: 0.45, label: '☁️ Cloud Wheels cushion the crash — reduced wipeout', bypasses: false },
    copDodge: { multiplier: 1.40, label: '☁️ Cloud Wheels lack the burst speed for a full cop dodge', bypasses: false },
  },
  Vapor: {
    pothole: { multiplier: 0.20, label: '💨 Vapor Wheels shatter on the pothole — critical slowdown!', bypasses: false },
    wipeout: { multiplier: 0.08, label: '💨 Vapor Wheels disintegrate on impact — catastrophic wipeout!', bypasses: false },
    copDodge: { multiplier: 1.80, label: '💨 Vapor Wheels unleash max speed on the cop dodge!', bypasses: false },
    courierHandoff: { multiplier: 1.95, label: '💨 Vapor Wheels hit blistering pace on the hand-off sprint!', bypasses: false },
  },
};

/**
 * Resolve the effective interaction for a given wheel + hazard combo.
 * @param {string|null} wheelType
 * @param {string} hazardId - One of: pothole, wipeout, copDodge, courierHandoff, comeback
 * @returns {{ multiplier: number, label: string, bypasses: boolean }|null}
 */
export function resolveWheelHazardInteraction(wheelType, hazardId) {
  if (!wheelType) return null;
  const wheelEntry = WHEEL_HAZARD_MATRIX[wheelType];
  if (!wheelEntry) return null;
  return wheelEntry[hazardId] ?? null;
}
