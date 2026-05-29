import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAdminRoutes } from '../routes/admin.js';

function createAppHarness() {
  const routes = [];
  const methods = ['get', 'post', 'put', 'delete'];
  const app = { routes };
  app.use = () => {};
  for (const method of methods) {
    app[method] = (path, ...handlers) => {
      routes.push({ method: method.toUpperCase(), path, handlers });
    };
  }
  return app;
}

function makeCollectionRef(path, store) {
  return {
    async get() {
      const docs = Object.entries(store)
        .filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
        .map(([key, value]) => ({
          id: key.split('/').pop(),
          data: () => value,
        }));
      return { docs };
    },
  };
}

function makeAdminDb(initialData = {}) {
  const store = { ...initialData };
  return {
    collection(name) {
      return makeCollectionRef(name, store);
    },
  };
}

async function invokeRoute(route) {
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.ended = true; return this; },
  };
  for (const handler of route.handlers) {
    await handler({}, res);
    if (res.ended) break;
  }
  return res;
}

test('GET /api/cyber-joust/sprites returns manifest from sprite collection docs', async () => {
  const app = createAppHarness();
  registerAdminRoutes(app, {
    adminAuth: {},
    adminDb: makeAdminDb({
      'cyberJoustSprites/body:neon-cyan--speedline': {
        kind: 'body',
        slug: 'neon-cyan--speedline',
        colorName: 'Neon Cyan',
        color: 0x00f0ff,
        deck: 'Speedline',
        imagePath: 'assets/fighters/body-neon-cyan--speedline.png',
        imageUrl: 'https://example.com/body.png',
      },
      'cyberJoustSprites/weapon:neon-cyan--crutch-lance': {
        kind: 'weapon',
        slug: 'neon-cyan--crutch-lance',
        colorName: 'Neon Cyan',
        color: 0x00f0ff,
        weapon: 'Crutch Lance',
        imagePath: 'assets/fighters/weapon-neon-cyan--crutch-lance.png',
        imageUrl: 'https://example.com/weapon.png',
      },
    }),
    authSyncRateLimit: (_req, _res, next) => next(),
    adminUserRateLimit: (_req, _res, next) => next(),
    authenticateFirebaseUser: async () => ({}),
    authenticateAdminRequest: async () => ({}),
    syncAdminClaim: async () => ({}),
    isStrongPassword: () => true,
    buildUserDisplayName: () => 'Admin',
    upsertUserLookupRecord: async () => {},
    reconcilePurchasedTierForUser: async () => {},
    deleteUserData: async () => {},
    migrateUserCards: async () => ({ migratedCount: 0 }),
    FieldValue: { serverTimestamp: () => '__SERVER_TS__' },
  });

  const route = app.routes.find((entry) => entry.method === 'GET' && entry.path === '/api/cyber-joust/sprites');
  assert.ok(route, 'route should exist');

  const response = await invokeRoute(route);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.version, 1);
  assert.equal(response.body.bodies.length, 1);
  assert.equal(response.body.weapons.length, 1);
  assert.equal(response.body.fighters.length, 1);
  assert.equal(response.body.fighters[0].bodySlug, 'neon-cyan--speedline');
});

test('GET /api/cyber-joust/sprites returns 503 without adminDb', async () => {
  const app = createAppHarness();
  registerAdminRoutes(app, {
    adminAuth: {},
    adminDb: null,
    authSyncRateLimit: (_req, _res, next) => next(),
    adminUserRateLimit: (_req, _res, next) => next(),
    authenticateFirebaseUser: async () => ({}),
    authenticateAdminRequest: async () => ({}),
    syncAdminClaim: async () => ({}),
    isStrongPassword: () => true,
    buildUserDisplayName: () => 'Admin',
    upsertUserLookupRecord: async () => {},
    reconcilePurchasedTierForUser: async () => {},
    deleteUserData: async () => {},
    migrateUserCards: async () => ({ migratedCount: 0 }),
    FieldValue: { serverTimestamp: () => '__SERVER_TS__' },
  });

  const route = app.routes.find((entry) => entry.method === 'GET' && entry.path === '/api/cyber-joust/sprites');
  const response = await invokeRoute(route);
  assert.equal(response.statusCode, 503);
});
