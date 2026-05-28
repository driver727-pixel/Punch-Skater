/**
 * cardCondition.ts — Visual condition system for card scars and weathering.
 *
 * Workshop Feedback: "Give Me a Hero to Mourn"
 * Cards accumulate visual wear based on their combat history.
 * This module computes the condition state and provides CSS class mappings
 * for the SkaterCardFace renderer.
 */

import type { CardCombatHistory, CardCondition } from "./types";

/**
 * Compute the visual condition of a card based on its combat history.
 *
 * Conditions (mutually exclusive, highest priority wins):
 *   - "legendary"   → best streak ≥ 15 (gold glow, prestige overlay)
 *   - "scarred"     → 5+ consecutive losses recently (glitch line overlay)
 *   - "battle-worn" → 50+ total battles (subtle grain/wear)
 *   - "pristine"    → default (no overlays)
 */
export function computeCardCondition(history?: CardCombatHistory | null): CardCondition {
  if (!history) return "pristine";

  // Legendary overrides all — a mark of excellence
  if (history.bestStreak >= 15) return "legendary";

  // Scarred — consecutive losses indicate recent punishment
  if (history.currentStreak <= -5) return "scarred";

  // Battle-worn — veteran status from sheer volume
  if (history.totalBattles >= 50) return "battle-worn";

  return "pristine";
}

/**
 * CSS class name suffix for each card condition.
 * Used by SkaterCardFace to apply visual overlays.
 */
export const CONDITION_CLASS_MAP: Record<CardCondition, string> = {
  pristine: "",
  "battle-worn": "card-condition--battle-worn",
  scarred: "card-condition--scarred",
  legendary: "card-condition--legendary",
};

/**
 * Human-readable label for each condition (shown in card detail view).
 */
export const CONDITION_LABELS: Record<CardCondition, string> = {
  pristine: "Pristine",
  "battle-worn": "Battle-Worn",
  scarred: "Scarred",
  legendary: "Legendary",
};

/**
 * Short flavour description for each condition.
 */
export const CONDITION_DESCRIPTIONS: Record<CardCondition, string> = {
  pristine: "Fresh from the forge. No marks of battle.",
  "battle-worn": "This courier has seen the streets. Subtle wear marks their service.",
  scarred: "Crushed in recent encounters. Glitch artefacts bleed through the portrait.",
  legendary: "An unbroken streak of dominance. Gold light halos this warrior.",
};
