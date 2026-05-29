import type { CardPayload, DeckPayload, WorkshopBoardPayload, WorkshopWeaponPayload } from "./types";
import { normalizeCardPayload } from "./styles";
import { calculateBoardStats, normalizeBoardConfig } from "./boardBuilder";

const COLLECTION_KEY = "skpd_collection";
const DECKS_KEY = "skpd_decks";
const FACTION_DISCOVERIES_KEY = "skpd_faction_discoveries";
const COMPLETED_MISSIONS_KEY = "skpd_completed_missions";
const WORKSHOP_BOARDS_KEY = "skpd_workshop_boards";
const WORKSHOP_WEAPONS_KEY = "skpd_workshop_weapons";

export function loadCollection(): CardPayload[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? (JSON.parse(raw) as CardPayload[]).map(normalizeCardPayload) : [];
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

export function loadFactionDiscoveries(): string[] {
  try {
    const raw = localStorage.getItem(FACTION_DISCOVERIES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveFactionDiscoveries(factions: string[]): void {
  localStorage.setItem(FACTION_DISCOVERIES_KEY, JSON.stringify(Array.from(new Set(factions)).sort()));
}

export function loadCompletedMissions(): string[] {
  try {
    const raw = localStorage.getItem(COMPLETED_MISSIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveCompletedMissions(missionIds: string[]): void {
  localStorage.setItem(COMPLETED_MISSIONS_KEY, JSON.stringify(Array.from(new Set(missionIds)).sort()));
}

function normalizeWorkshopBoard(board: WorkshopBoardPayload): WorkshopBoardPayload {
  const config = normalizeBoardConfig(board.config);
  return {
    ...board,
    label: typeof board.label === "string" && board.label.trim() ? board.label : "Workshop build",
    config,
    loadout: calculateBoardStats(config),
  };
}

function compareWorkshopBoards(a: WorkshopBoardPayload, b: WorkshopBoardPayload): number {
  const aOrder = a.sortOrder ?? Infinity;
  const bOrder = b.sortOrder ?? Infinity;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

function normalizeWorkshopWeapon(weapon: WorkshopWeaponPayload): WorkshopWeaponPayload {
  return {
    ...weapon,
    label: typeof weapon.label === "string" && weapon.label.trim() ? weapon.label : "Saved weapon",
  };
}

function compareWorkshopWeapons(a: WorkshopWeaponPayload, b: WorkshopWeaponPayload): number {
  const aOrder = a.sortOrder ?? Infinity;
  const bOrder = b.sortOrder ?? Infinity;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export function loadWorkshopBoards(): WorkshopBoardPayload[] {
  try {
    const raw = localStorage.getItem(WORKSHOP_BOARDS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as WorkshopBoardPayload[]).map(normalizeWorkshopBoard).sort(compareWorkshopBoards);
  } catch {
    return [];
  }
}

export function saveWorkshopBoards(boards: WorkshopBoardPayload[]): void {
  localStorage.setItem(
    WORKSHOP_BOARDS_KEY,
    JSON.stringify(boards.map(normalizeWorkshopBoard).sort(compareWorkshopBoards)),
  );
}

export function loadWorkshopWeapons(): WorkshopWeaponPayload[] {
  try {
    const raw = localStorage.getItem(WORKSHOP_WEAPONS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as WorkshopWeaponPayload[]).map(normalizeWorkshopWeapon).sort(compareWorkshopWeapons);
  } catch {
    return [];
  }
}

export function saveWorkshopWeapons(weapons: WorkshopWeaponPayload[]): void {
  localStorage.setItem(
    WORKSHOP_WEAPONS_KEY,
    JSON.stringify(weapons.map(normalizeWorkshopWeapon).sort(compareWorkshopWeapons)),
  );
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
