import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPendingPurchaseUpdate,
  buildPurchasedTierUpdate,
  buildSubscriptionEntitlementUpdate,
  normalizePaidTier,
  resolveHigherPaidTier,
  resolveSubscriptionTier,
  shouldPersistPurchaseDetails,
} from '../lib/payments.js';

test('normalizePaidTier accepts only paid tiers', () => {
  assert.equal(normalizePaidTier('tier2'), 'tier2');
  assert.equal(normalizePaidTier('tier3'), 'tier3');
  assert.equal(normalizePaidTier('free'), null);
  assert.equal(normalizePaidTier(''), null);
});

test('resolveHigherPaidTier never downgrades a paid tier', () => {
  assert.equal(resolveHigherPaidTier(null, 'tier2'), 'tier2');
  assert.equal(resolveHigherPaidTier('tier2', 'tier3'), 'tier3');
  assert.equal(resolveHigherPaidTier('tier3', 'tier2'), 'tier3');
  assert.equal(resolveHigherPaidTier('tier3', 'free'), 'tier3');
});

test('shouldPersistPurchaseDetails only updates purchase metadata for equal or higher tiers', () => {
  assert.equal(shouldPersistPurchaseDetails(null, 'tier2'), true);
  assert.equal(shouldPersistPurchaseDetails('tier2', 'tier3'), true);
  assert.equal(shouldPersistPurchaseDetails('tier3', 'tier2'), false);
});

test('buildPurchasedTierUpdate preserves higher existing tier while ignoring lower-tier metadata', () => {
  const update = buildPurchasedTierUpdate({
    tier: 'tier3',
    purchaseEmail: 'existing@example.com',
    lastCheckoutSessionId: 'cs_existing',
  }, {
    tier: 'tier2',
    emailLower: 'buyer@example.com',
    sessionId: 'cs_new',
  }, 'timestamp');

  assert.deepEqual(update, {
    tier: 'tier3',
    updatedAt: 'timestamp',
  });
});

test('buildPurchasedTierUpdate applies purchase metadata for equal or higher tiers', () => {
  const update = buildPurchasedTierUpdate({
    tier: 'tier2',
  }, {
    tier: 'tier3',
    emailLower: 'buyer@example.com',
    sessionId: 'cs_upgrade',
  }, 'timestamp');

  assert.deepEqual(update, {
    tier: 'tier3',
    purchaseEmail: 'buyer@example.com',
    lastCheckoutSessionId: 'cs_upgrade',
    updatedAt: 'timestamp',
  });
});

test('buildPendingPurchaseUpdate keeps the highest pending tier', () => {
  const update = buildPendingPurchaseUpdate({
    tier: 'tier3',
    lastCheckoutSessionId: 'cs_existing',
  }, {
    emailLower: 'buyer@example.com',
    tier: 'tier2',
    sessionId: 'cs_new',
  }, 'timestamp');

  assert.deepEqual(update, {
    emailLower: 'buyer@example.com',
    tier: 'tier3',
    updatedAt: 'timestamp',
  });
});

test('buildPendingPurchaseUpdate stores session metadata for new or upgraded purchases', () => {
  const update = buildPendingPurchaseUpdate({}, {
    emailLower: 'buyer@example.com',
    tier: 'tier2',
    sessionId: 'cs_pending',
  }, 'timestamp');

  assert.deepEqual(update, {
    emailLower: 'buyer@example.com',
    tier: 'tier2',
    lastCheckoutSessionId: 'cs_pending',
    updatedAt: 'timestamp',
  });
});

test('buildPendingPurchaseUpdate stores subscription metadata for later account linking', () => {
  const update = buildPendingPurchaseUpdate({}, {
    emailLower: 'buyer@example.com',
    tier: 'tier3',
    sessionId: 'cs_subscribe',
    checkoutMode: 'subscription',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    billingPeriod: 'annual',
  }, 'timestamp');

  assert.deepEqual(update, {
    emailLower: 'buyer@example.com',
    tier: 'tier3',
    lastCheckoutSessionId: 'cs_subscribe',
    checkoutMode: 'subscription',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    billingPeriod: 'annual',
    updatedAt: 'timestamp',
  });
});

test('buildPurchasedTierUpdate stores subscription entitlement metadata and credits', () => {
  const update = buildPurchasedTierUpdate({}, {
    tier: 'tier3',
    emailLower: 'buyer@example.com',
    sessionId: 'cs_subscribe',
    checkoutMode: 'subscription',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    billingPeriod: 'monthly',
  }, 'timestamp');

  assert.deepEqual(update, {
    tier: 'tier3',
    purchaseEmail: 'buyer@example.com',
    lastCheckoutSessionId: 'cs_subscribe',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    billingPeriod: 'monthly',
    monthlyForgeCreditsIncluded: 150,
    monthlyForgeCreditsRemaining: 150,
    updatedAt: 'timestamp',
  });
});

test('resolveSubscriptionTier only grants active or trialing subscriptions', () => {
  assert.equal(resolveSubscriptionTier('active', 'tier2'), 'tier2');
  assert.equal(resolveSubscriptionTier('trialing', 'tier3'), 'tier3');
  assert.equal(resolveSubscriptionTier('past_due', 'tier3'), 'free');
  assert.equal(resolveSubscriptionTier('canceled', 'tier2'), 'free');
});

test('buildSubscriptionEntitlementUpdate downgrades canceled subscriptions', () => {
  const update = buildSubscriptionEntitlementUpdate({
    tier: 'tier3',
  }, {
    tier: 'tier3',
    status: 'canceled',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  }, 'timestamp');

  assert.deepEqual(update, {
    tier: 'free',
    subscriptionStatus: 'canceled',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    monthlyForgeCreditsIncluded: 0,
    monthlyForgeCreditsRemaining: 0,
    updatedAt: 'timestamp',
  });
});
