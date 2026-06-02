import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPaymentRoutes } from '../routes/payments.js';

function createAppHarness() {
  const routes = [];
  return {
    routes,
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
  };
}

async function invokeWebhookRoute(route, reqOverrides = {}) {
  const req = {
    body: Buffer.from('{}'),
    headers: {
      'stripe-signature': 'sig_test',
    },
    ...reqOverrides,
  };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  const handler = route.handlers[route.handlers.length - 1];
  await handler(req, res);
  return res;
}

function createProcessedEventsDb() {
  const processedEvents = new Map();
  function createDocRef(id) {
    return {
      async get() {
        return { exists: processedEvents.has(id) };
      },
      async set(data) {
        processedEvents.set(id, data);
      },
      async delete() {
        processedEvents.delete(id);
      },
    };
  }

  return {
    processedEvents,
    async runTransaction(callback) {
      const tx = {
        async get(ref) {
          return ref.get();
        },
        set(ref, data) {
          processedEvents.set(ref.id, data);
        },
      };
      return callback(tx);
    },
    collection(name) {
      assert.equal(name, 'processedStripeEvents');
      return {
        doc(id) {
          const ref = createDocRef(id);
          return {
            ...ref,
            id,
          };
        },
      };
    },
  };
}

test('stripe webhook only marks events processed after successful handling', async () => {
  const app = createAppHarness();
  const adminDb = createProcessedEventsDb();
  let syncCalls = 0;

  registerPaymentRoutes(app, {
    stripe: {
      webhooks: {
        constructEvent() {
          return {
            id: 'evt_retryable',
            type: 'checkout.session.completed',
            data: {
              object: {
                metadata: { priceId: 'price_tier2' },
                customer_details: { email: 'skater@example.com' },
                id: 'cs_test_123',
                payment_status: 'paid',
              },
            },
          };
        },
      },
    },
    stripeWebhookSecret: 'whsec_test',
    checkoutRateLimit: (_req, _res, next) => next(),
    resolveTierFromPriceId: (priceId) => (priceId === 'price_tier2' ? 'tier2' : null),
    resolveCheckoutModeFromPriceId: () => 'payment',
    resolveBillingPeriodFromPriceId: () => null,
    syncPurchasedTier: async () => {
      syncCalls += 1;
      if (syncCalls === 1) {
        throw new Error('temporary failure');
      }
    },
    syncSubscriptionEntitlement: async () => {},
    isAllowedRedirectUrl: () => true,
    normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
    timingSafeEmailMatches: (left, right) => left === right,
    sendCheckoutVerificationFailure: () => {},
    getAdminDb: () => adminDb,
  });

  const webhookRoute = app.routes.find((route) => route.path === '/api/stripe/webhook');
  assert.ok(webhookRoute);

  const failedAttempt = await invokeWebhookRoute(webhookRoute);
  assert.equal(failedAttempt.statusCode, 500);
  assert.deepEqual(failedAttempt.body, { error: 'Failed to process Stripe webhook.' });
  assert.equal(adminDb.processedEvents.has('evt_retryable'), false);
  assert.equal(syncCalls, 1);

  const successfulRetry = await invokeWebhookRoute(webhookRoute);
  assert.equal(successfulRetry.statusCode, 200);
  assert.deepEqual(successfulRetry.body, { received: true });
  assert.equal(adminDb.processedEvents.has('evt_retryable'), true);

  const deduplicatedReplay = await invokeWebhookRoute(webhookRoute);
  assert.equal(deduplicatedReplay.statusCode, 200);
  assert.deepEqual(deduplicatedReplay.body, { received: true });
  assert.equal(syncCalls, 2);
});
