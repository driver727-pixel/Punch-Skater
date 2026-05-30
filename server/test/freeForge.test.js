import test from 'node:test';
import assert from 'node:assert/strict';
import { claimFreeForge, getFreeForgeState, FREE_FORGE_COOLDOWN_MS } from '../lib/freeForge.js';
import { registerForgeRoutes } from '../routes/forge.js';

const FieldValue = {
  serverTimestamp: () => '__server_timestamp__',
};

function createSnapshot(path, value) {
  return {
    id: path.split('/').at(-1),
    exists: value !== undefined,
    data() {
      return value === undefined ? undefined : structuredClone(value);
    },
    ref: { path },
  };
}

function createFakeDb() {
  const store = new Map();

  class FakeDocRef {
    constructor(path) {
      this.path = path;
    }

    async get() {
      return createSnapshot(this.path, store.get(this.path));
    }

    set(data, options = {}) {
      const current = store.get(this.path) ?? {};
      store.set(this.path, options.merge ? { ...current, ...structuredClone(data) } : structuredClone(data));
    }
  }

  class FakeCollectionRef {
    constructor(path) {
      this.path = path;
    }

    doc(id) {
      return new FakeDocRef(`${this.path}/${id}`);
    }
  }

  return {
    collection(name) {
      return new FakeCollectionRef(name);
    },
    async runTransaction(callback) {
      const tx = {
        get(ref) {
          return ref.get();
        },
        set(ref, data, options) {
          ref.set(data, options);
        },
      };
      return callback(tx);
    },
  };
}

function createFakeApp() {
  const routes = new Map();
  return {
    use() {},
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers.at(-1));
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers.at(-1));
    },
    routes,
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('claimFreeForge records the cooldown and blocks repeat claims until it elapses', async () => {
  const adminDb = createFakeDb();
  const start = 1_000_000;

  const first = await claimFreeForge(adminDb, { uid: 'skater-1', FieldValue, now: start });
  assert.equal(first.used, true);
  assert.equal(first.canForge, false);
  assert.equal(first.nextReadyAt, start + FREE_FORGE_COOLDOWN_MS);

  // A second claim while still on cooldown is rejected — this is the loophole fix:
  // clearing localStorage cannot mint another free card.
  await assert.rejects(
    claimFreeForge(adminDb, { uid: 'skater-1', FieldValue, now: start + 1000 }),
    (error) => error?.statusCode === 429 && error?.nextReadyAt === start + FREE_FORGE_COOLDOWN_MS,
  );

  // Once the cooldown elapses the next free forge is allowed again.
  const afterCooldown = await claimFreeForge(adminDb, {
    uid: 'skater-1',
    FieldValue,
    now: start + FREE_FORGE_COOLDOWN_MS,
  });
  assert.equal(afterCooldown.used, true);
});

test('getFreeForgeState reports availability without mutating the record', async () => {
  const adminDb = createFakeDb();

  const fresh = await getFreeForgeState(adminDb, 'skater-2');
  assert.equal(fresh.used, false);
  assert.equal(fresh.canForge, true);
  assert.equal(fresh.nextReadyAt, null);

  const start = 5_000_000;
  await claimFreeForge(adminDb, { uid: 'skater-2', FieldValue, now: start });

  const onCooldown = await getFreeForgeState(adminDb, 'skater-2', start + 10);
  assert.equal(onCooldown.used, true);
  assert.equal(onCooldown.canForge, false);
});

test('forge routes require authentication and expose status + claim', async () => {
  const adminDb = createFakeDb();
  const app = createFakeApp();
  registerForgeRoutes(app, {
    adminDb,
    forgeRateLimit: (_req, _res, next) => next?.(),
    authenticateFirebaseUser: async (req) => {
      if (req.headers?.authorization === '******') {
        return { uid: 'forge-user' };
      }
      throw Object.assign(new Error('Missing Authorization header.'), { statusCode: 401 });
    },
    FieldValue,
  });

  // Unauthenticated callers are rejected.
  const unauthRes = createMockResponse();
  await app.routes.get('POST /api/forge/free-claim')({ headers: {} }, unauthRes);
  assert.equal(unauthRes.statusCode, 401);

  // First claim succeeds.
  const claimRes = createMockResponse();
  await app.routes.get('POST /api/forge/free-claim')({ headers: { authorization: '******' } }, claimRes);
  assert.equal(claimRes.statusCode, 201);
  assert.equal(claimRes.body.used, true);

  // Second immediate claim is throttled by the cooldown.
  const repeatRes = createMockResponse();
  await app.routes.get('POST /api/forge/free-claim')({ headers: { authorization: '******' } }, repeatRes);
  assert.equal(repeatRes.statusCode, 429);
  assert.equal(typeof repeatRes.body.nextReadyAt, 'number');

  // Status reflects the consumed free forge.
  const statusRes = createMockResponse();
  await app.routes.get('GET /api/forge/free-status')({ headers: { authorization: '******' } }, statusRes);
  assert.equal(statusRes.statusCode, 200);
  assert.equal(statusRes.body.used, true);
  assert.equal(statusRes.body.canForge, false);
});
