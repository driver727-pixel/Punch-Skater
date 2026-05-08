import { calculateBoardStats, getBoardSummary, normalizeBoardConfig } from "./boardBuilder";
import { buildForgedCard } from "./skaterBoardSynthesis";
import { normalizeCardPayload } from "./styles";
import { normalizeJoustProfile } from "./jousting";
import type { BoardConfig } from "./boardBuilder";
import type { CardPayload, WorkshopBoardPayload } from "./types";

export const WORKSHOP_REFORGE_FEE_OZZIES = 25;

export function createWorkshopBoard(config: BoardConfig, sourceCardId?: string): WorkshopBoardPayload {
  const normalizedConfig = normalizeBoardConfig(config);
  const now = new Date().toISOString();
  return {
    id: `workshop-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
    label: getBoardSummary(normalizedConfig),
    config: normalizedConfig,
    loadout: calculateBoardStats(normalizedConfig),
    ...(sourceCardId ? { sourceCardId } : {}),
  };
}

interface ReforgeCardBoardOptions {
  feeOzzies?: number;
  boardImageUrl?: string;
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
  const currentOzzies = Math.max(0, card.ozzies ?? 0);
  const feeOzzies = Math.max(0, options.feeOzzies ?? 0);
  const updatedCard = normalizeCardPayload({
    ...card,
    stats: forged.stats,
    board: {
      ...card.board,
      ...forged.board,
      imageUrl: options.boardImageUrl ?? card.board.imageUrl,
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
