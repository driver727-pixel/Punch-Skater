import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPendingPurchaseUpdate,
  buildPurchasedTierUpdate,
  normalizePaidTier,
  resolveHigherPaidTier,
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
