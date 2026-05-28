/**
 * cardTitles.ts — Dynamic card title generation system.
 *
 * Workshop Feedback: "Give Me a Hero to Mourn"
 * Cards earn titles automatically based on performance thresholds.
 * Titles are appended to the card's display name in context (e.g.,
 * Fatou 'The Untouchable' Darkside).
 *
 * Mirror changes to `server/lib/cardTitles.js`.
 */

import type { CardCombatHistory } from "./types";

export interface TitleRule {
  /** Unique stable ID for the title. */
  id: string;
  /** Display label shown on the card (e.g., "The Untouchable"). */
  label: string;
  /** Short flavour description for the codex/tooltip. */
  description: string;
  /** Predicate that determines if the title is earned. */
  check: (history: CardCombatHistory) => boolean;
}

/**
 * Ordered list of title rules. Evaluated top-to-bottom; a card can earn
 * multiple titles but only display one at a time.
 */
export const TITLE_RULES: TitleRule[] = [
  {
    id: "the-untouchable",
    label: "The Untouchable",
    description: "Won 10 consecutive battles without a loss.",
    check: (h) => h.bestStreak >= 10,
  },
  {
    id: "courier-killer",
    label: "Courier Killer",
    description: "Defeated 5 named boss rivals.",
    check: (h) => h.bossesDefeated.length >= 5,
  },
  {
    id: "photo-finish-king",
    label: "Photo Finish",
    description: "Won 5 races by a razor-thin margin.",
    check: (h) => h.narrowWins >= 5,
  },
  {
    id: "iron-legs",
    label: "Iron Legs",
    description: "Completed 50 total battles.",
    check: (h) => h.totalBattles >= 50,
  },
  {
    id: "centurion",
    label: "Centurion",
    description: "Reached 100 total battles.",
    check: (h) => h.totalBattles >= 100,
  },
  {
    id: "district-dominator",
    label: "District Dominator",
    description: "Defeated all 6 district rivals.",
    check: (h) => h.bossesDefeated.length >= 6,
  },
  {
    id: "grudge-bearer",
    label: "Grudge Bearer",
    description: "Lost 3 times to the same rival and came back for more.",
    check: (h) => h.raceLosses >= 3 && !!h.lastDefeatedBy,
  },
  {
    id: "the-unbreakable",
    label: "The Unbreakable",
    description: "Achieved a 15+ win streak.",
    check: (h) => h.bestStreak >= 15,
  },
  {
    id: "road-warrior",
    label: "Road Warrior",
    description: "Won 25 races.",
    check: (h) => h.raceWins >= 25,
  },
  {
    id: "joust-ace",
    label: "Joust Ace",
    description: "Won 15 jousts.",
    check: (h) => h.joustWins >= 15,
  },
];

/**
 * Evaluate which titles a card has earned based on its combat history.
 * Returns the list of title labels that the card qualifies for.
 */
export function evaluateEarnedTitles(history: CardCombatHistory): string[] {
  return TITLE_RULES.filter((rule) => rule.check(history)).map((rule) => rule.label);
}

/**
 * Format a card name with its active title for display.
 * e.g., "Fatou Darkside" + "The Untouchable" → "Fatou 'The Untouchable' Darkside"
 */
export function formatCardNameWithTitle(name: string, title?: string | null): string {
  if (!title) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return `${name} '${title}'`;
  const firstName = parts[0];
  const rest = parts.slice(1).join(" ");
  return `${firstName} '${title}' ${rest}`;
}

/**
 * Create a fresh (empty) combat history object for newly forged cards.
 */
export function createEmptyCombatHistory(): CardCombatHistory {
  return {
    raceWins: 0,
    raceLosses: 0,
    joustWins: 0,
    joustLosses: 0,
    missionSuccesses: 0,
    missionFailures: 0,
    currentStreak: 0,
    bestStreak: 0,
    bossesDefeated: [],
    narrowWins: 0,
    totalBattles: 0,
  };
}
