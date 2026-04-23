/**
 * featureFlags.ts — Central feature-flag registry.
 *
 * Every new system ships behind a flag here. Default is `false` in production
 * until QA passes. Flags can be toggled at build time via environment
 * variables (VITE_FF_*) or at runtime through an admin panel (future).
 *
 * Naming convention:  SCREAMING_SNAKE matching the system name.
 */

function envFlag(key: string, fallback: boolean = false): boolean {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, string | undefined>)[key];
    if (val === "true" || val === "1") return true;
    if (val === "false" || val === "0") return false;
  }
  return fallback;
}

export const featureFlags = {
  /** 8-hour free forge timer ("Charge Up"). @owner gamma */
  CHARGE_UP: envFlag("VITE_FF_CHARGE_UP", false),

  /** Daily login streaks + rewards UI. @owner gamma */
  DAILY_REWARDS: envFlag("VITE_FF_DAILY_REWARDS", false),

  /** Mission / quest tracker panel. @owner gamma */
  MISSIONS: envFlag("VITE_FF_MISSIONS", false),

  /** Battle pass tier progression + premium track. @owner gamma */
  BATTLE_PASS: envFlag("VITE_FF_BATTLE_PASS", false),

  /** Crew / guild system. @owner charlie */
  CREWS: envFlag("VITE_FF_CREWS", false),

  /** Ranked seasons + seasonal leaderboard. @owner charlie */
  RANKED_SEASONS: envFlag("VITE_FF_RANKED_SEASONS", false),

  /** Shareable card / deck links. @owner charlie */
  SHARE_LINKS: envFlag("VITE_FF_SHARE_LINKS", false),
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;

/** Runtime check — use in components / hooks to gate UI. */
export function isEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag];
}
