import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTradeRoutes } from '../routes/trades.js';

function createAppHarness() {
  const routes = [];
  return {
    routes,
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
  };
}

async function invokeRoute(route, { body = {} } = {}) {
  const req = { body, headers: {} };
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
  };

  for (let handlerIndex = 0; handlerIndex < route.handlers.length && !res.ended;) {
    const handler = route.handlers[handlerIndex];
    if (handler.length >= 3) {
      let nextCalled = false;
      await handler(req, res, () => {
        nextCalled = true;
      });
      if (!nextCalled) break;
      handlerIndex += 1;
      continue;
    }
    await handler(req, res);
    handlerIndex += 1;
  }

  return res;
}

function makeDocSnapshot(data) {
  return {
    exists: data !== undefined,
    data: () => data,
  };
}

function makeQuerySnapshot(docs = []) {
  return {
    empty: docs.length === 0,
    docs: docs.map((data, index) => ({
      id: data?.id ?? `doc-${index}`,
      data: () => data,
    })),
  };
}

function createAdminDbHarness({
  userLookup = [],
  trades = [],
  cardsByUser = {},
} = {}) {
  const writes = [];

  function createTradesCollection() {
    return {
      where(field, _op, value) {
        return {
          async get() {
            return makeQuerySnapshot(trades.filter((trade) => trade?.[field] === value));
          },
        };
      },
      doc(id) {
        return {
          path: `trades/${id}`,
          async set(data, options) {
            writes.push({ path: this.path, data, options });
          },
        };
      },
    };
  }

  function createUserLookupCollection() {
    return {
      where(field, _op, value) {
        return {
          limit(count) {
            return {
              async get() {
                return makeQuerySnapshot(userLookup.filter((entry) => entry?.[field] === value).slice(0, count));
              },
            };
          },
        };
      },
    };
  }

  function createUsersCollection() {
    return {
      doc(uid) {
        return {
          collection(name) {
            if (name !== 'cards') throw new Error(`Unsupported subcollection ${name}`);
            return {
              doc(cardId) {
                return {
                  async get() {
                    return makeDocSnapshot(cardsByUser?.[uid]?.[cardId]);
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  return {
    writes,
    collection(name) {
      if (name === 'trades') return createTradesCollection();
      if (name === 'userLookup') return createUserLookupCollection();
      if (name === 'users') return createUsersCollection();
      throw new Error(`Unsupported collection ${name}`);
    },
  };
}

function createTradeRouteHarness(options = {}) {
  const app = createAppHarness();
  let rateLimitCalls = 0;
  registerTradeRoutes(app, {
    adminDb: Object.prototype.hasOwnProperty.call(options, 'adminDb') ? options.adminDb : createAdminDbHarness(),
    tradeRateLimit: (_req, _res, next) => {
      rateLimitCalls += 1;
      next();
    },
    authenticateFirebaseUser: options.authenticateFirebaseUser ?? (async () => ({ uid: 'sender-1', email: 'Sender@Email.com' })),
    randomUUID: options.randomUUID ?? (() => 'test-uuid'),
  });
  return {
    route: app.routes.find((route) => route.path === '/api/trades'),
    getRateLimitCalls: () => rateLimitCalls,
  };
}

function createTradeCard(overrides = {}) {
  return {
    id: 'card-1',
    identity: { name: 'Trade Card' },
    prompts: { rarity: 'Rare' },
    class: { rarity: 'Rare' },
    stats: { speed: 12, range: 11, stealth: 10, grit: 9 },
    xp: 150_000,
    ozzies: 2_500,
    joust: { lance: 4, shield: 5, hype: 3, traits: ['flash'] },
    board: { tuned: true },
    maintenance: { state: 'active' },
    ...overrides,
  };
}

test('trade route returns 503 when adminDb is unavailable', async () => {
  const { route, getRateLimitCalls } = createTradeRouteHarness({ adminDb: null });

  const res = await invokeRoute(route, {
    body: { offeredCardId: 'card-1', recipientEmail: 'friend@example.com' },
  });

  assert.equal(getRateLimitCalls(), 1);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'Trades are not configured on this server.' });
});

test('trade route rejects spoofed client-authored economy fields', async () => {
  const { route } = createTradeRouteHarness();

  const res = await invokeRoute(route, {
    body: {
      offeredCardId: 'card-1',
      recipientEmail: 'friend@example.com',
      estimatedValue: 999999,
    },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Trade creation accepts only offeredCardId and recipientEmail.' });
});

test('trade route creates server-authored metadata from stored card and trade history', async () => {
  const adminDb = createAdminDbHarness({
    userLookup: [{ uid: 'recipient-1', emailLower: 'friend@example.com' }],
    trades: [
      {
        id: 'accepted-1',
        fromUid: 'sender-1',
        toUid: 'recipient-2',
        offeredCardId: 'old-card',
        status: 'accepted',
        createdAt: '2026-05-05T10:00:00.000Z',
      },
      {
        id: 'declined-1',
        fromUid: 'sender-1',
        toUid: 'recipient-3',
        offeredCardId: 'old-card-2',
        status: 'declined',
        createdAt: '2026-05-05T09:00:00.000Z',
      },
    ],
    cardsByUser: {
      'sender-1': {
        'card-1': createTradeCard(),
      },
    },
  });
  const { route } = createTradeRouteHarness({ adminDb });

  const res = await invokeRoute(route, {
    body: { offeredCardId: 'card-1', recipientEmail: 'Friend@Example.com' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(adminDb.writes.length, 1);
  const storedTrade = adminDb.writes[0].data;
  assert.equal(storedTrade.id, 'trade-test-uuid');
  assert.equal(storedTrade.fromUid, 'sender-1');
  assert.equal(storedTrade.fromEmail, 'Sender@Email.com');
  assert.equal(storedTrade.toUid, 'recipient-1');
  assert.equal(storedTrade.toEmail, 'friend@example.com');
  assert.equal(storedTrade.offeredCardId, 'card-1');
  assert.deepEqual(storedTrade.offeredCard, createTradeCard());
  assert.equal(storedTrade.economyVersion, 'fair-trade-v1');
  assert.equal(storedTrade.estimatedValue, 1002);
  assert.equal(storedTrade.valueBand, 'elite');
  assert.deepEqual(storedTrade.senderReputation, {
    score: 61,
    label: 'New trader',
    completedTrades: 2,
    acceptedTrades: 1,
    cancelledTrades: 0,
    pendingOffers: 0,
    updatedAt: storedTrade.createdAt,
  });
  assert.deepEqual(storedTrade.fairPlay, {
    flags: [],
    reviewedAt: storedTrade.createdAt,
  });
  assert.deepEqual(storedTrade.confirmations, {
    sender: ['no-real-money', 'estimated-value-reviewed', 'recipient-verified'],
  });
  assert.equal(storedTrade.status, 'pending');
  assert.equal(storedTrade.updatedAt, storedTrade.createdAt);
  assert.deepEqual(res.body, { trade: storedTrade });
});

test('trade route blocks duplicate pending offers for the same card', async () => {
  const adminDb = createAdminDbHarness({
    userLookup: [{ uid: 'recipient-1', emailLower: 'friend@example.com' }],
    trades: [
      {
        id: 'pending-1',
        fromUid: 'sender-1',
        toUid: 'recipient-9',
        offeredCardId: 'card-1',
        offeredCard: { id: 'card-1' },
        status: 'pending',
        createdAt: '2026-05-05T10:00:00.000Z',
      },
    ],
    cardsByUser: {
      'sender-1': {
        'card-1': createTradeCard(),
      },
    },
  });
  const { route } = createTradeRouteHarness({ adminDb });

  const res = await invokeRoute(route, {
    body: { offeredCardId: 'card-1', recipientEmail: 'friend@example.com' },
  });

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'That card already has a pending offer.' });
  assert.equal(adminDb.writes.length, 0);
});
