import type { CardPayload } from "./types";

export function getDisplayedArchetype(card: CardPayload): string {
  return card.discovery?.displayArchetype?.trim() || card.prompts.archetype;
}

export function isSecretFactionCard(card: CardPayload): boolean {
  return !!card.discovery?.isSecretReveal && !!card.discovery?.revealedFaction;
}

export function getDisplayedCrew(card: CardPayload): string {
  return card.discovery?.revealedFaction ?? "Unknown";
}
