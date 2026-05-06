import type { CardPayload, TradePayload, TradeReputationSnapshot, TradeValueBand } from "./types";

export const TRADE_ECONOMY_VERSION = "fair-trade-v1";
export const MAX_PENDING_OUTGOING_OFFERS = 5;
export const MAX_PENDING_OFFERS_TO_RECIPIENT = 2;
export const TRADE_SEND_COOLDOWN_MS = 30_000;

const RARITY_VALUES: Record<CardPayload["prompts"]["rarity"], number> = {
  "Punch Skater": 160,
  Apprentice: 220,
  Master: 360,
  Rare: 520,
  Legendary: 760,
};

export function estimateCardTradeValue(card: CardPayload): number {
  const stats = (card.stats.speed ?? 0) + (card.stats.range ?? 0) + (card.stats.stealth ?? 0) + (card.stats.grit ?? 0);
  const rarityValue = RARITY_VALUES[card.prompts.rarity] ?? 200;
  const statValue = stats * 6;
  const ozzyValue = Math.min(420, Math.max(0, card.ozzies ?? 0) / 25);
  const xpValue = Math.min(280, Math.max(0, card.xp ?? 0) / 10_000);
  const joustValue = card.joust
    ? (card.joust.lance + card.joust.shield + card.joust.hype) * 5 + card.joust.traits.length * 10
    : 0;
  const boardValue = card.board?.tuned ? 45 : 0;
  const maintenancePenalty =
    card.maintenance?.state === "impounded" ? 90 : card.maintenance?.state === "in_shop" ? 35 : 0;

  return Math.max(25, Math.round(rarityValue + statValue + ozzyValue + xpValue + joustValue + boardValue - maintenancePenalty));
}

export function getTradeValueBand(value: number): TradeValueBand {
  if (value >= 1_100) return "grail";
  if (value >= 850) return "elite";
  if (value >= 600) return "prime";
  if (value >= 350) return "rising";
  return "starter";
}

export function formatTradeValue(value: number): string {
  return `${value.toLocaleString()} est. value`;
}

export function createTradeReputationSnapshot(
  trades: TradePayload[],
  uid: string,
  nowIso = new Date().toISOString(),
): TradeReputationSnapshot {
  const sentTrades = trades.filter((trade) => trade.fromUid === uid);
  const accepted = sentTrades.filter((trade) => trade.status === "accepted").length;
  const declined = sentTrades.filter((trade) => trade.status === "declined").length;
  const cancelled = sentTrades.filter((trade) => trade.status === "cancelled").length;
  const pending = sentTrades.filter((trade) => trade.status === "pending").length;
  const completed = accepted + declined + cancelled;
  const score = Math.max(0, Math.min(100, 55 + accepted * 9 - declined * 3 - cancelled * 5 - pending * 2));
  const label = score >= 85 ? "Trusted trader" : score >= 65 ? "Steady trader" : score >= 45 ? "New trader" : "Needs caution";

  return {
    score,
    label,
    completedTrades: completed,
    acceptedTrades: accepted,
    cancelledTrades: cancelled,
    pendingOffers: pending,
    updatedAt: nowIso,
  };
}

export function getTradeFairnessFlags(card: CardPayload, estimatedValue = estimateCardTradeValue(card)): string[] {
  const flags: string[] = [];
  if (estimatedValue >= 1_100) flags.push("High-value card: review the card details before confirming.");
  if ((card.xp ?? 0) >= 1_000_000) flags.push("Veteran card: XP reflects earned gameplay history.");
  if ((card.ozzies ?? 0) >= 5_000) flags.push("High Ozzy card: Ozzies are earned, not purchasable power.");
  if (card.maintenance?.state && card.maintenance.state !== "active") {
    flags.push("Card is not active: maintenance state affects utility.");
  }
  return flags;
}

export function getSendAbusePreventionMessages(
  pendingTrades: TradePayload[],
  recipientUid: string,
  selectedCardId: string,
  nowMs = Date.now(),
): string[] {
  const messages: string[] = [];
  if (pendingTrades.length >= MAX_PENDING_OUTGOING_OFFERS) {
    messages.push(`Resolve an existing offer before opening more than ${MAX_PENDING_OUTGOING_OFFERS} pending trades.`);
  }
  if (pendingTrades.filter((trade) => trade.toUid === recipientUid).length >= MAX_PENDING_OFFERS_TO_RECIPIENT) {
    messages.push(`Keep it fair: no more than ${MAX_PENDING_OFFERS_TO_RECIPIENT} pending offers to the same player.`);
  }
  if (pendingTrades.some((trade) => (trade.offeredCardId ?? trade.offeredCard.id) === selectedCardId)) {
    messages.push("That card already has a pending offer.");
  }

  const latestOfferMs = pendingTrades.reduce((latest, trade) => {
    const createdMs = Date.parse(trade.createdAt);
    return Number.isFinite(createdMs) ? Math.max(latest, createdMs) : latest;
  }, 0);
  if (latestOfferMs > 0 && nowMs - latestOfferMs < TRADE_SEND_COOLDOWN_MS) {
    messages.push("Slow down: wait a few seconds between trade offers to prevent spam.");
  }

  return messages;
}
