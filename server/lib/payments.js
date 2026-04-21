const PAID_TIER_PRIORITY = {
  tier2: 1,
  tier3: 2,
};

export function normalizePaidTier(value) {
  return value === 'tier2' || value === 'tier3' ? value : null;
}

export function resolveHigherPaidTier(currentTier, incomingTier) {
  const normalizedCurrent = normalizePaidTier(currentTier);
  const normalizedIncoming = normalizePaidTier(incomingTier);
  if (!normalizedCurrent) return normalizedIncoming;
  if (!normalizedIncoming) return normalizedCurrent;
  return PAID_TIER_PRIORITY[normalizedIncoming] >= PAID_TIER_PRIORITY[normalizedCurrent]
    ? normalizedIncoming
    : normalizedCurrent;
}

export function shouldPersistPurchaseDetails(currentTier, incomingTier) {
  const normalizedIncoming = normalizePaidTier(incomingTier);
  if (!normalizedIncoming) return false;
  const normalizedCurrent = normalizePaidTier(currentTier);
  if (!normalizedCurrent) return true;
  return PAID_TIER_PRIORITY[normalizedIncoming] >= PAID_TIER_PRIORITY[normalizedCurrent];
}

export function buildPurchasedTierUpdate(currentData, purchase, updatedAt) {
  const nextTier = resolveHigherPaidTier(currentData?.tier, purchase?.tier);
  if (!nextTier) return null;

  const nextData = {
    tier: nextTier,
    updatedAt,
  };

  if (shouldPersistPurchaseDetails(currentData?.tier, purchase?.tier)) {
    if (purchase?.emailLower) {
      nextData.purchaseEmail = purchase.emailLower;
    }
    if (purchase?.sessionId) {
      nextData.lastCheckoutSessionId = purchase.sessionId;
    }
  }

  return nextData;
}

export function buildPendingPurchaseUpdate(currentData, purchase, updatedAt) {
  const nextTier = resolveHigherPaidTier(currentData?.tier, purchase?.tier);
  if (!nextTier || !purchase?.emailLower) return null;

  const nextData = {
    emailLower: purchase.emailLower,
    tier: nextTier,
    updatedAt,
  };

  if (shouldPersistPurchaseDetails(currentData?.tier, purchase?.tier) && purchase?.sessionId) {
    nextData.lastCheckoutSessionId = purchase.sessionId;
  }

  return nextData;
}
