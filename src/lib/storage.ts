import type { CardPayload, DeckPayload } from "./types";

const COLLECTION_KEY = "skpd_collection";
const DECKS_KEY = "skpd_decks";

export function loadCollection(): CardPayload[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? (JSON.parse(raw) as CardPayload[]) : [];
  } catch {
    return [];
  }
}

export function saveCollection(cards: CardPayload[]): void {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(cards));
}

export function loadDecks(): DeckPayload[] {
  try {
    const raw = localStorage.getItem(DECKS_KEY);
    return raw ? (JSON.parse(raw) as DeckPayload[]) : [];
  } catch {
    return [];
  }
}

export function saveDecks(decks: DeckPayload[]): void {
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}

export function exportJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
