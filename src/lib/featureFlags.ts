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
  /** Daily login streaks + rewards UI. @owner gamma */
  DAILY_REWARDS: envFlag("VITE_FF_DAILY_REWARDS", false),

  /** Mission / quest tracker panel. @owner gamma */
  MISSIONS: envFlag("VITE_FF_MISSIONS", true),

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

/**
 * Per-feature allow-lists of user emails that have early access.
 * A user whose email appears here can access the feature even when the
 * global build-time flag is off.
 */
const featureFlagOverrides: Partial<Record<FeatureFlagKey, readonly string[]>> = {};

/**
 * Runtime check — use in components / hooks to gate UI.
 *
 * Pass the current user object (or just the email string) to enable
 * per-user overrides:
 *   isEnabled("MISSIONS", user)
 *   isEnabled("MISSIONS", userEmail)
 *
 * A feature is considered enabled when either:
 *   1. The global build-time flag is true, OR
 *   2. The provided user's email is in the override list for that feature.
 */
export function isEnabled(
  flag: FeatureFlagKey,
  user?: { email?: string | null } | string | null,
): boolean {
  if (featureFlags[flag]) return true;
  const overrides = featureFlagOverrides[flag];
  if (overrides) {
    const email = typeof user === "string" ? user : user?.email;
    if (email) {
      const emailLower = email.toLowerCase();
      return overrides.some((e) => e.toLowerCase() === emailLower);
    }
  }
  return false;
}
