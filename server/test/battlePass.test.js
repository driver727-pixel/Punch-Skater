import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBattlePassRoutes } from '../battlePass.js';

const FieldValue = {
  serverTimestamp: () => '__server_timestamp__',
};

function createFakeApp() {
  const routes = new Map();
  const register = (method) => (path, ...handlers) => {
    routes.set(`${method} ${path}`, handlers.at(-1));
  };
  return {
    use() {},
    get: register('GET'),
    post: register('POST'),
    routes,
  };
}

test('battle pass routes expose read + claim but never a client-trusted XP endpoint', () => {
  const app = createFakeApp();
  registerBattlePassRoutes(app, {
    adminDb: {},
    battlePassRateLimit: (_req, _res, next) => next?.(),
    authenticateFirebaseUser: async () => ({ uid: 'battle-pass-user' }),
    FieldValue,
  });

  // Reading state and claiming rewards (validated against the stored server
  // tier) remain available.
  assert.equal(app.routes.has('GET /api/battle-pass'), true);
  assert.equal(app.routes.has('POST /api/battle-pass/claim'), true);

  // The client-trusted XP endpoint that let any authenticated user mint tier
  // progression for free must not exist.
  assert.equal(app.routes.has('POST /api/battle-pass/xp'), false);
});
