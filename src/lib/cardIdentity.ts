import type { CardPayload } from "./types";

export function getDisplayedArchetype(card: CardPayload): string {
  return card.role.label;
}

export function getDisplayedCrew(card: CardPayload): string {
  return card.identity.crew;
}
