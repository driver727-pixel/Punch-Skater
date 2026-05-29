import { calculateBoardStats, getBoardSummary, normalizeBoardConfig } from "./boardBuilder";
import { buildForgedCard } from "./skaterBoardSynthesis";
import { normalizeCardPayload } from "./styles";
import { normalizeJoustProfile } from "./jousting";
import type { BoardConfig } from "./boardBuilder";
import type { CardPayload, WorkshopBoardPayload, WorkshopWeaponPayload } from "./types";

export const WORKSHOP_REFORGE_FEE_OZZIES = 25;

function normalizeOzzies(value: number | undefined): number {
  return Math.max(0, value ?? 0);
}

export function createWorkshopBoard(config: BoardConfig, sourceCardId?: string): WorkshopBoardPayload {
  const normalizedConfig = normalizeBoardConfig(config);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    label: getBoardSummary(normalizedConfig),
    config: normalizedConfig,
    loadout: calculateBoardStats(normalizedConfig),
    ...(sourceCardId ? { sourceCardId } : {}),
  };
}

export function createWorkshopWeapon(
  weaponImageUrl: string,
  label: string,
  sourceCardId?: string,
): WorkshopWeaponPayload {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    label,
    weaponImageUrl,
    ...(sourceCardId ? { sourceCardId } : {}),
  };
}

interface ReforgeCardBoardOptions {
  feeOzzies?: number;
  boardImageUrl?: string;
  clearBoardImage?: boolean;
}

export function reforgeCardBoard(
  card: CardPayload,
  nextBoardConfig: BoardConfig,
  options: ReforgeCardBoardOptions = {},
): CardPayload {
  const normalizedBoardConfig = normalizeBoardConfig(nextBoardConfig);
  const forged = buildForgedCard({
    prompts: card.prompts,
    boardConfig: normalizedBoardConfig,
    idNonce: card.id,
  });
  const currentOzzies = normalizeOzzies(card.ozzies);
  const feeOzzies = normalizeOzzies(options.feeOzzies);
  const imageUrl = options.boardImageUrl ?? (options.clearBoardImage ? undefined : card.board.imageUrl);
  const updatedCard = normalizeCardPayload({
    ...card,
    stats: forged.stats,
    board: {
      ...card.board,
      ...forged.board,
      imageUrl,
      placement: card.board.placement,
      layerOrder: card.board.layerOrder,
    },
    ozzies: Math.max(0, currentOzzies - feeOzzies),
  });
  return {
    ...updatedCard,
    joust: normalizeJoustProfile(updatedCard),
  };
}

interface ReforgeCardWeaponOptions {
  feeOzzies?: number;
}

export function reforgeCardWeapon(
  card: CardPayload,
  weaponImageUrl: string,
  options: ReforgeCardWeaponOptions = {},
): CardPayload {
  const currentOzzies = normalizeOzzies(card.ozzies);
  const feeOzzies = normalizeOzzies(options.feeOzzies);
  const updatedCard = normalizeCardPayload({
    ...card,
    weaponImageUrl,
    ozzies: Math.max(0, currentOzzies - feeOzzies),
  });
  return {
    ...updatedCard,
    joust: normalizeJoustProfile(updatedCard),
  };
}
