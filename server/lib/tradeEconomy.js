export const TRADE_ECONOMY_VERSION = 'fair-trade-v1';
export const MAX_PENDING_OUTGOING_OFFERS = 5;
export const MAX_PENDING_OFFERS_TO_RECIPIENT = 2;
export const TRADE_SEND_COOLDOWN_MS = 30_000;
export const MAX_ESTIMATED_TRADE_VALUE = 100_000;

const MAX_OZZY_TRADE_VALUE = 420;
const MAX_XP_TRADE_VALUE = 280;
const XP_TO_VALUE_DIVISOR = 10_000;
const OZZY_TO_VALUE_DIVISOR = 25;
const JOUST_STAT_MULTIPLIER = 5;
const JOUST_TRAIT_VALUE = 10;
const TUNED_BOARD_VALUE = 45;
const IMPOUNDED_MAINTENANCE_PENALTY = 90;
const IN_SHOP_MAINTENANCE_PENALTY = 35;
const REPUTATION_BASE_SCORE = 55;
const REPUTATION_ACCEPTED_WEIGHT = 9;
const REPUTATION_DECLINED_WEIGHT = 3;
const REPUTATION_CANCELLED_WEIGHT = 5;
const REPUTATION_PENDING_WEIGHT = 2;

const RARITY_VALUES = {
  'Punch Skater™': 160,
  Apprentice: 220,
  Master: 360,
  Rare: 520,
  Legendary: 760,
};

function toFiniteNonNegative(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function toTraitCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function estimateCardTradeValue(card) {
  const stats = ['speed', 'range', 'stealth', 'grit'].reduce(
    (total, key) => total + toFiniteNonNegative(card?.stats?.[key]),
    0,
  );
  const rarityValue = RARITY_VALUES[card?.prompts?.rarity] ?? 200;
  const statValue = stats * 6;
  const ozzyValue = Math.min(MAX_OZZY_TRADE_VALUE, toFiniteNonNegative(card?.ozzies) / OZZY_TO_VALUE_DIVISOR);
  const xpValue = Math.min(MAX_XP_TRADE_VALUE, toFiniteNonNegative(card?.xp) / XP_TO_VALUE_DIVISOR);
  const joustValue = card?.joust
    ? (
      toFiniteNonNegative(card.joust.lance)
      + toFiniteNonNegative(card.joust.shield)
      + toFiniteNonNegative(card.joust.hype)
    ) * JOUST_STAT_MULTIPLIER + toTraitCount(card.joust.traits) * JOUST_TRAIT_VALUE
    : 0;
  const boardValue = card?.board?.tuned ? TUNED_BOARD_VALUE : 0;
  const maintenancePenalty =
    card?.maintenance?.state === 'impounded'
      ? IMPOUNDED_MAINTENANCE_PENALTY
      : card?.maintenance?.state === 'in_shop'
        ? IN_SHOP_MAINTENANCE_PENALTY
        : 0;

  return Math.min(
    MAX_ESTIMATED_TRADE_VALUE,
    Math.max(25, Math.round(rarityValue + statValue + ozzyValue + xpValue + joustValue + boardValue - maintenancePenalty)),
  );
}

export function getTradeValueBand(value) {
  if (value >= 1_100) return 'grail';
  if (value >= 850) return 'elite';
  if (value >= 600) return 'prime';
  if (value >= 350) return 'rising';
  return 'starter';
}

export function createTradeReputationSnapshot(trades, uid, nowIso = new Date().toISOString()) {
  const sentTrades = Array.isArray(trades) ? trades.filter((trade) => trade?.fromUid === uid) : [];
  const accepted = sentTrades.filter((trade) => trade?.status === 'accepted').length;
  const declined = sentTrades.filter((trade) => trade?.status === 'declined').length;
  const cancelled = sentTrades.filter((trade) => trade?.status === 'cancelled').length;
  const pending = sentTrades.filter((trade) => trade?.status === 'pending').length;
  const completed = accepted + declined + cancelled;
  const score = Math.max(
    0,
    Math.min(
      100,
      REPUTATION_BASE_SCORE
        + accepted * REPUTATION_ACCEPTED_WEIGHT
        - declined * REPUTATION_DECLINED_WEIGHT
        - cancelled * REPUTATION_CANCELLED_WEIGHT
        - pending * REPUTATION_PENDING_WEIGHT,
    ),
  );
  const label = score >= 85 ? 'Trusted trader' : score >= 65 ? 'Steady trader' : score >= 45 ? 'New trader' : 'Needs caution';

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

export function getTradeFairnessFlags(card, estimatedValue = estimateCardTradeValue(card)) {
  const flags = [];
  if (estimatedValue >= 1_100) flags.push('High-value card: review the card details before confirming.');
  if (toFiniteNonNegative(card?.xp) >= 1_000_000) flags.push('Veteran card: XP reflects earned gameplay history.');
  if (toFiniteNonNegative(card?.ozzies) >= 5_000) flags.push('High Ozzy card: Ozzies are earned, not purchasable power.');
  if (card?.maintenance?.state && card.maintenance.state !== 'active') {
    flags.push('Card is not active: maintenance state affects utility.');
  }
  return flags;
}

export function getSendAbusePreventionMessages(
  pendingTrades,
  recipientUid,
  selectedCardId,
  nowMs = Date.now(),
) {
  const trades = Array.isArray(pendingTrades) ? pendingTrades : [];
  const messages = [];
  if (trades.length >= MAX_PENDING_OUTGOING_OFFERS) {
    messages.push(`Resolve an existing offer before opening more than ${MAX_PENDING_OUTGOING_OFFERS} pending trades.`);
  }
  if (trades.filter((trade) => trade?.toUid === recipientUid).length >= MAX_PENDING_OFFERS_TO_RECIPIENT) {
    messages.push(`Keep it fair: no more than ${MAX_PENDING_OFFERS_TO_RECIPIENT} pending offers to the same player.`);
  }
  if (trades.some((trade) => (trade?.offeredCardId ?? trade?.offeredCard?.id) === selectedCardId)) {
    messages.push('That card already has a pending offer.');
  }

  const latestOfferMs = trades.reduce((latest, trade) => {
    const createdMs = Date.parse(trade?.createdAt ?? '');
    return Number.isFinite(createdMs) ? Math.max(latest, createdMs) : latest;
  }, 0);
  if (latestOfferMs > 0 && nowMs - latestOfferMs < TRADE_SEND_COOLDOWN_MS) {
    messages.push('Slow down: wait a few seconds between trade offers to prevent spam.');
  }

  return messages;
}
