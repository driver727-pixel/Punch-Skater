import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAdminRoutes } from '../routes/admin.js';

// ── Minimal Express-like harness ─────────────────────────────────────────────

function createAppHarness() {
  const routes = [];
  const methods = ['get', 'post', 'put', 'delete'];
  const app = { routes };
  for (const method of methods) {
    app[method] = (path, ...handlers) => {
      routes.push({ method: method.toUpperCase(), path, handlers });
    };
    app.use = () => {};
  }
  return app;
}

async function invokeRoute(route, { body = {}, params = {}, headers = {} } = {}) {
  const req = { body, params, headers };
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.ended = true; return this; },
    end() { this.ended = true; return this; },
  };

  for (let index = 0; index < route.handlers.length && !res.ended;) {
    const handler = route.handlers[index];
    if (handler.length >= 3) {
      let nextCalled = false;
      await handler(req, res, () => { nextCalled = true; });
      if (!nextCalled) break;
      index += 1;
      continue;
    }
    await handler(req, res);
    index += 1;
  }
  return res;
}

// ── Firestore stub helpers ────────────────────────────────────────────────────

function makeDocRef(path, store) {
  return {
    path,
    async get() {
      const data = store[path];
      return { exists: data !== undefined, data: () => data };
    },
    async set(data) {
      store[path] = data;
    },
    async delete() {
      delete store[path];
    },
    collection(name) {
      return makeCollectionRef(`${path}/${name}`, store);
    },
  };
}

function makeCollectionRef(path, store) {
  return {
    path,
    async get() {
      const docs = Object.entries(store)
        .filter(([k]) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
        .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v }));
      return { docs };
    },
    doc(id) {
      return makeDocRef(`${path}/${id}`, store);
    },
  };
}

function makeAdminDb(initialData = {}) {
  const store = { ...initialData };
  return {
    store,
    collection(name) {
      return makeCollectionRef(name, store);
    },
  };
}

// ── Shared harness factory ────────────────────────────────────────────────────

function buildHarness({
  adminDbData = {},
  callerUid = 'admin-uid-1',
  authenticateAdminRequest = async () => ({ uid: callerUid, email: 'admin@example.com', admin: true }),
  FieldValue = { serverTimestamp: () => '__SERVER_TS__' },
} = {}) {
  const app = createAppHarness();
  const adminDb = makeAdminDb(adminDbData);

  registerAdminRoutes(app, {
    adminAuth: {},
    adminDb,
    authSyncRateLimit: (_req, _res, next) => next(),
    adminUserRateLimit: (_req, _res, next) => next(),
    authenticateFirebaseUser: async () => ({ uid: callerUid }),
    authenticateAdminRequest,
    syncAdminClaim: async () => ({ admin: true, claimsUpdated: false }),
    isStrongPassword: () => true,
    buildUserDisplayName: ({ email }) => email.split('@')[0],
    upsertUserLookupRecord: async () => {},
    reconcilePurchasedTierForUser: async () => {},
    deleteUserData: async () => {},
    migrateUserCards: async () => ({ migratedCount: 0 }),
    FieldValue,
  });

  function findRoute(method, pathPattern) {
    return app.routes.find((r) => r.method === method && r.path === pathPattern);
  }

  return { app, adminDb, findRoute };
}

// ── GET /api/admin/player/:uid/cards ─────────────────────────────────────────

test('GET /api/admin/player/:uid/cards returns player cards', async () => {
  const { findRoute } = buildHarness({
    adminDbData: {
      'users/player-1/cards/card-abc': { id: 'card-abc', identity: { name: 'Test Skater' } },
    },
  });

  const route = findRoute('GET', '/api/admin/player/:uid/cards');
  assert.ok(route, 'route should exist');

  const res = await invokeRoute(route, { params: { uid: 'player-1' } });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.cards));
  assert.equal(res.body.cards.length, 1);
  assert.equal(res.body.cards[0].id, 'card-abc');
});

test('GET /api/admin/player/:uid/cards returns 503 when adminDb is absent', async () => {
  const app = createAppHarness();
  registerAdminRoutes(app, {
    adminAuth: null,
    adminDb: null,
    authSyncRateLimit: (_req, _res, next) => next(),
    adminUserRateLimit: (_req, _res, next) => next(),
    authenticateFirebaseUser: async () => {},
    authenticateAdminRequest: async () => {},
    syncAdminClaim: async () => {},
    isStrongPassword: () => true,
    buildUserDisplayName: () => 'Skater',
    upsertUserLookupRecord: async () => {},
    reconcilePurchasedTierForUser: async () => {},
    deleteUserData: async () => {},
    migrateUserCards: async () => ({ migratedCount: 0 }),
    FieldValue: { serverTimestamp: () => '__SERVER_TS__' },
  });

  const route = app.routes.find((r) => r.method === 'GET' && r.path === '/api/admin/player/:uid/cards');
  assert.ok(route, 'route should exist');

  const res = await invokeRoute(route, { params: { uid: 'player-1' } });
  assert.equal(res.statusCode, 503);
});

test('GET /api/admin/player/:uid/cards returns 403 for non-admin', async () => {
  const { findRoute } = buildHarness({
    authenticateAdminRequest: async () => {
      throw Object.assign(new Error('Forbidden: admin access required.'), { statusCode: 403 });
    },
  });

  const route = findRoute('GET', '/api/admin/player/:uid/cards');
  const res = await invokeRoute(route, { params: { uid: 'player-1' } });
  assert.equal(res.statusCode, 403);
});

// ── GET /api/admin/player/:uid/decks ─────────────────────────────────────────

test('GET /api/admin/player/:uid/decks returns player decks', async () => {
  const { findRoute } = buildHarness({
    adminDbData: {
      'users/player-1/decks/deck-1': { id: 'deck-1', name: 'My Deck', cardIds: ['a', 'b'] },
    },
  });

  const route = findRoute('GET', '/api/admin/player/:uid/decks');
  assert.ok(route);
  const res = await invokeRoute(route, { params: { uid: 'player-1' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.decks.length, 1);
  assert.equal(res.body.decks[0].name, 'My Deck');
});

// ── PUT /api/admin/player/:uid/profile ───────────────────────────────────────

test('PUT /api/admin/player/:uid/profile updates displayName', async () => {
  const { findRoute, adminDb } = buildHarness();
  const route = findRoute('PUT', '/api/admin/player/:uid/profile');
  assert.ok(route);

  const res = await invokeRoute(route, {
    params: { uid: 'player-1' },
    body: { displayName: 'New Name' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.uid, 'player-1');

  const profileData = adminDb.store['userProfiles/player-1'];
  assert.equal(profileData?.displayName, 'New Name');
});

test('PUT /api/admin/player/:uid/profile rejects empty displayName', async () => {
  const { findRoute } = buildHarness();
  const route = findRoute('PUT', '/api/admin/player/:uid/profile');
  const res = await invokeRoute(route, {
    params: { uid: 'player-1' },
    body: { displayName: '   ' },
  });
  assert.equal(res.statusCode, 400);
});

test('PUT /api/admin/player/:uid/profile rejects when no fields provided', async () => {
  const { findRoute } = buildHarness();
  const route = findRoute('PUT', '/api/admin/player/:uid/profile');
  const res = await invokeRoute(route, {
    params: { uid: 'player-1' },
    body: {},
  });
  assert.equal(res.statusCode, 400);
});

// ── PUT /api/admin/player/:uid/cards/:cardId ─────────────────────────────────

test('PUT /api/admin/player/:uid/cards/:cardId saves the card', async () => {
  const { findRoute, adminDb } = buildHarness();
  const route = findRoute('PUT', '/api/admin/player/:uid/cards/:cardId');
  assert.ok(route);

  const cardData = { id: 'restored-card', identity: { name: 'Old Skater' } };
  const res = await invokeRoute(route, {
    params: { uid: 'player-1', cardId: 'restored-card' },
    body: cardData,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.cardId, 'restored-card');
  assert.deepEqual(adminDb.store['users/player-1/cards/restored-card'], cardData);
});

test('PUT /api/admin/player/:uid/cards/:cardId rejects non-object body', async () => {
  const { findRoute } = buildHarness();
  const route = findRoute('PUT', '/api/admin/player/:uid/cards/:cardId');

  const res = await invokeRoute(route, {
    params: { uid: 'player-1', cardId: 'card-x' },
    body: null,
  });
  assert.equal(res.statusCode, 400);
});

// ── DELETE /api/admin/player/:uid/cards/:cardId ───────────────────────────────

test('DELETE /api/admin/player/:uid/cards/:cardId removes the card', async () => {
  const { findRoute, adminDb } = buildHarness({
    adminDbData: {
      'users/player-1/cards/card-to-delete': { id: 'card-to-delete' },
    },
  });
  const route = findRoute('DELETE', '/api/admin/player/:uid/cards/:cardId');
  assert.ok(route);

  const res = await invokeRoute(route, {
    params: { uid: 'player-1', cardId: 'card-to-delete' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.cardId, 'card-to-delete');
  assert.equal(adminDb.store['users/player-1/cards/card-to-delete'], undefined);
});

// ── DELETE /api/admin/player/:uid/decks/:deckId ───────────────────────────────

test('DELETE /api/admin/player/:uid/decks/:deckId removes the deck', async () => {
  const { findRoute, adminDb } = buildHarness({
    adminDbData: {
      'users/player-1/decks/deck-del': { id: 'deck-del', name: 'Bye Deck' },
    },
  });
  const route = findRoute('DELETE', '/api/admin/player/:uid/decks/:deckId');
  assert.ok(route);

  const res = await invokeRoute(route, {
    params: { uid: 'player-1', deckId: 'deck-del' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deckId, 'deck-del');
  assert.equal(adminDb.store['users/player-1/decks/deck-del'], undefined);
});
