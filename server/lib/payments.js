const PAID_TIER_PRIORITY = {
  tier2: 1,
  tier3: 2,
};

const SUBSCRIPTION_ACTIVE_STATUSES = new Set(['active', 'trialing']);

const MONTHLY_FORGE_CREDITS = {
  tier2: 50,
  tier3: 150,
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

export function resolveSubscriptionTier(status, tier) {
  const normalizedTier = normalizePaidTier(tier);
  if (!normalizedTier) return 'free';
  return SUBSCRIPTION_ACTIVE_STATUSES.has(status) ? normalizedTier : 'free';
}

function addOptionalPurchaseFields(nextData, purchase) {
  if (purchase?.emailLower) {
    nextData.purchaseEmail = purchase.emailLower;
  }
  if (purchase?.sessionId) {
    nextData.lastCheckoutSessionId = purchase.sessionId;
  }
  if (purchase?.stripeCustomerId) {
    nextData.stripeCustomerId = purchase.stripeCustomerId;
  }
  if (purchase?.stripeSubscriptionId) {
    nextData.stripeSubscriptionId = purchase.stripeSubscriptionId;
  }
  if (purchase?.subscriptionStatus) {
    nextData.subscriptionStatus = purchase.subscriptionStatus;
  }
  if (purchase?.currentPeriodEnd) {
    nextData.currentPeriodEnd = purchase.currentPeriodEnd;
  }
  if (purchase?.billingPeriod) {
    nextData.billingPeriod = purchase.billingPeriod;
  }
}

export function buildPurchasedTierUpdate(currentData, purchase, updatedAt) {
  const nextTier = resolveHigherPaidTier(currentData?.tier, purchase?.tier);
  if (!nextTier) return null;

  const nextData = {
    tier: nextTier,
    updatedAt,
  };

  if (shouldPersistPurchaseDetails(currentData?.tier, purchase?.tier)) {
    addOptionalPurchaseFields(nextData, purchase);
    if (purchase?.checkoutMode === 'subscription') {
      nextData.monthlyForgeCreditsIncluded = MONTHLY_FORGE_CREDITS[nextTier] ?? null;
      nextData.monthlyForgeCreditsRemaining = MONTHLY_FORGE_CREDITS[nextTier] ?? null;
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

  if (shouldPersistPurchaseDetails(currentData?.tier, purchase?.tier)) {
    addOptionalPurchaseFields(nextData, purchase);
  }

  return nextData;
}

export function buildSubscriptionEntitlementUpdate(currentData, subscription, updatedAt) {
  const desiredTier = resolveSubscriptionTier(subscription?.status, subscription?.tier);
  const nextData = {
    tier: desiredTier,
    subscriptionStatus: subscription?.status ?? 'canceled',
    updatedAt,
  };

  if (subscription?.stripeCustomerId) {
    nextData.stripeCustomerId = subscription.stripeCustomerId;
  }
  if (subscription?.stripeSubscriptionId) {
    nextData.stripeSubscriptionId = subscription.stripeSubscriptionId;
  }
  if (subscription?.currentPeriodEnd) {
    nextData.currentPeriodEnd = subscription.currentPeriodEnd;
  }
  if (subscription?.billingPeriod) {
    nextData.billingPeriod = subscription.billingPeriod;
  }

  if (desiredTier === 'free') {
    nextData.monthlyForgeCreditsIncluded = 0;
    nextData.monthlyForgeCreditsRemaining = 0;
    return nextData;
  }

  const monthlyCredits = MONTHLY_FORGE_CREDITS[desiredTier] ?? 0;
  nextData.monthlyForgeCreditsIncluded = monthlyCredits;
  nextData.monthlyForgeCreditsRemaining = monthlyCredits;

  return nextData;
}
