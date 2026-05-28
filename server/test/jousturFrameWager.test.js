import test from 'node:test';
import assert from 'node:assert/strict';
import { registerJousturRoutes } from '../routes/joustur.js';

const FieldValue = {
  serverTimestamp: () => '__server_timestamp__',
  increment: (value) => ({ __increment: value }),
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

function createFakeDb(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries).map(([path, value]) => [path, structuredClone(value)]));

  class FakeDocRef {
    constructor(path) {
      this.path = path;
    }
    collection(name) {
      return new FakeCollectionRef(`${this.path}/${name}`);
    }
    async get() {
      return createSnapshot(this.path, store.get(this.path));
    }
    set(data, options = {}) {
      const current = store.get(this.path) ?? {};
      store.set(this.path, options.merge ? { ...current, ...structuredClone(data) } : structuredClone(data));
    }
    delete() {
      store.delete(this.path);
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
    store,
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
        update(ref, data) {
          ref.set(data, { merge: true });
        },
        delete(ref) {
          ref.delete();
        },
      };
      return callback(tx);
    },
  };
}

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers.at(-1));
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers.at(-1));
    },
    delete(path, ...handlers) {
      routes.set(`DELETE ${path}`, handlers.at(-1));
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

function createCard(id, support = false) {
  return {
    id,
    identity: { name: id, crew: support ? 'Ne0n Legion' : 'Punch Skater™s' },
    class: { rarity: 'Apprentice' },
    joust: { traits: support ? ['boost'] : ['strike'] },
    board: {},
  };
}

function createHarness(balance = 150) {
  const riderIds = ['card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6'];
  const entries = {
    'jousturLineups/user-1': { uid: 'user-1', riderCardIds: riderIds, supportCardId: 'card-7', updatedAt: 'now' },
    'userProfiles/user-1': { unlocked_frames: [], updatedAt: 'now' },
    'wallets/user-1': { uid: 'user-1', currentBalance: balance, lifetimeEarned: balance, lifetimeSpent: 0, updatedAt: 'now' },
  };
  for (const cardId of [...riderIds, 'card-7']) {
    entries[`users/user-1/cards/${cardId}`] = createCard(cardId, cardId === 'card-7');
  }

  const adminDb = createFakeDb(entries);
  const app = createFakeApp();
  registerJousturRoutes(app, {
    adminDb,
    jousturRateLimit: (_req, _res, next) => next?.(),
    authenticateFirebaseUser: async () => ({ uid: 'user-1' }),
    randomUUID: () => 'fixed-id',
    FieldValue,
  });
  return { adminDb, route: app.routes.get('POST /api/joustur/high-stakes/solo') };
}

test('high-stakes solo frame wager debits Ozzies before creating the match', async () => {
  const { adminDb, route } = createHarness(150);
  const res = createMockResponse();

  await route({
    body: { targetCardId: 'card-1', frameId: 'chrome-singed', wagerType: 'ozzies', wagerAmount: 100 },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.wager.frameId, 'chrome-singed');
  assert.equal(res.body.wager.targetCardId, 'card-1');
  assert.equal(adminDb.store.get('wallets/user-1').currentBalance, 50);
  assert.equal(adminDb.store.get('wallets/user-1').lifetimeSpent, 100);
  assert.equal(adminDb.store.has('wallets/user-1/ledger/joustur-frame-wager:jm-fixed-id'), true);
  assert.equal(adminDb.store.get('jousturMatches/jm-fixed-id').status, 'active');
});

test('high-stakes solo frame wager rejects insufficient Ozzies without creating a match', async () => {
  const { adminDb, route } = createHarness(25);
  const res = createMockResponse();

  await route({
    body: { targetCardId: 'card-1', frameId: 'archive-neon', wagerType: 'ozzies', wagerAmount: 100 },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Insufficient Ozzies/);
  assert.equal(adminDb.store.has('jousturMatches/jm-fixed-id'), false);
});

test('high-stakes solo frame wager can lock the target card instead of spending Ozzies', async () => {
  const { adminDb, route } = createHarness(0);
  const res = createMockResponse();

  await route({
    body: { targetCardId: 'card-1', frameId: 'archive-neon', wagerType: 'card_lock' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(adminDb.store.get('users/user-1/cards/card-1').jousturFrameWagerLock, {
    status: 'locked',
    matchId: 'jm-fixed-id',
    frameId: 'archive-neon',
    lockedAt: adminDb.store.get('users/user-1/cards/card-1').jousturFrameWagerLock.lockedAt,
  });
  assert.equal(adminDb.store.get('wallets/user-1').currentBalance, 0);
});
