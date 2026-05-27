import test from 'node:test';
import assert from 'node:assert/strict';
import { creditWallet, getWallet, spendWallet } from '../lib/wallet.js';
import { registerWalletRoutes } from '../routes/wallet.js';

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

  class FakeQuery {
    constructor(path, orderField = null, orderDirection = 'asc', limitCount = null) {
      this.path = path;
      this.orderField = orderField;
      this.orderDirection = orderDirection;
      this.limitCount = limitCount;
    }

    orderBy(field, direction = 'asc') {
      return new FakeQuery(this.path, field, direction, this.limitCount);
    }

    limit(count) {
      return new FakeQuery(this.path, this.orderField, this.orderDirection, count);
    }

    async get() {
      let docs = Array.from(store.entries())
        .filter(([key]) => key.startsWith(`${this.path}/`) && !key.slice(this.path.length + 1).includes('/'))
        .map(([key, value]) => createSnapshot(key, value));

      if (this.orderField) {
        docs = docs.sort((left, right) => {
          const leftValue = left.data()?.[this.orderField] ?? '';
          const rightValue = right.data()?.[this.orderField] ?? '';
          const delta = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
          return this.orderDirection === 'desc' ? -delta : delta;
        });
      }

      if (typeof this.limitCount === 'number') {
        docs = docs.slice(0, this.limitCount);
      }

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
      };
    }
  }

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

  class FakeCollectionRef extends FakeQuery {
    constructor(path) {
      super(path);
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

test('creditWallet tracks balance, lifetime totals, and duplicate idempotency keys', async () => {
  const adminDb = createFakeDb();

  const firstCredit = await creditWallet(adminDb, {
    uid: 'skater-1',
    amount: 50,
    sourceType: 'mission',
    sourceId: 'glass-city-lifeline-case',
    description: 'Mission reward',
    idempotencyKey: 'mission-1',
    FieldValue,
  });
  const duplicateCredit = await creditWallet(adminDb, {
    uid: 'skater-1',
    amount: 50,
    sourceType: 'mission',
    sourceId: 'glass-city-lifeline-case',
    description: 'Mission reward',
    idempotencyKey: 'mission-1',
    FieldValue,
  });

  assert.equal(firstCredit.wallet.currentBalance, 50);
  assert.equal(firstCredit.wallet.lifetimeEarned, 50);
  assert.equal(firstCredit.wallet.lifetimeSpent, 0);
  assert.equal(duplicateCredit.duplicate, true);
  assert.equal(duplicateCredit.wallet.currentBalance, 50);
});

test('spendWallet blocks insufficient funds and updates lifetime spent on success', async () => {
  const adminDb = createFakeDb();
  await creditWallet(adminDb, {
    uid: 'skater-2',
    amount: 30,
    sourceType: 'mission',
    sourceId: 'grid-black-badge',
    description: 'Mission reward',
    idempotencyKey: 'mission-2',
    FieldValue,
  });

  const spend = await spendWallet(adminDb, {
    uid: 'skater-2',
    amount: 25,
    sourceType: 'card_forge',
    sourceId: 'card_forge',
    description: 'Card Forge spend',
    idempotencyKey: 'forge-1',
    FieldValue,
  });

  assert.equal(spend.wallet.currentBalance, 5);
  assert.equal(spend.wallet.lifetimeSpent, 25);

  await assert.rejects(
    spendWallet(adminDb, {
      uid: 'skater-2',
      amount: 10,
      sourceType: 'card_forge',
      sourceId: 'card_forge',
      description: 'Card Forge spend',
      idempotencyKey: 'forge-2',
      FieldValue,
    }),
    (error) => error?.statusCode === 409 && /Insufficient Ozzies/.test(error.message),
  );
});

test('getWallet returns recent transactions in descending order', async () => {
  const adminDb = createFakeDb();
  await creditWallet(adminDb, {
    uid: 'skater-3',
    amount: 25,
    sourceType: 'mission',
    sourceId: 'airaway-skybridge-pizza-lift',
    description: 'Mission reward',
    idempotencyKey: 'reward-a',
    FieldValue,
  });
  await creditWallet(adminDb, {
    uid: 'skater-3',
    amount: 30,
    sourceType: 'mission',
    sourceId: 'roads-grease-mile',
    description: 'Mission reward',
    idempotencyKey: 'reward-b',
    FieldValue,
  });

  const wallet = await getWallet(adminDb, 'skater-3', 5);
  assert.equal(wallet.wallet.currentBalance, 55);
  assert.deepEqual(
    new Set(wallet.recentTransactions.map((entry) => entry.id)),
    new Set(['reward-a', 'reward-b']),
  );
});

test('wallet routes credit mission rewards, debit forge spends, and enforce auth', async () => {
  const adminDb = createFakeDb();
  const app = createFakeApp();
  registerWalletRoutes(app, {
    adminDb,
    walletRateLimit: (_req, _res, next) => next?.(),
    authenticateFirebaseUser: async (req) => {
      // Tests intentionally use a single mock header value instead of real JWT parsing.
      if (req.headers?.authorization === '******') {
        return { uid: 'wallet-user' };
      }
      throw Object.assign(new Error('Missing Authorization header.'), { statusCode: 401 });
    },
    FieldValue,
  });

  const rewardReq = {
    headers: { authorization: '******' },
    body: { missionId: 'glass-city-lifeline-case', idempotencyKey: 'mission-credit-1' },
  };
  const rewardRes = createMockResponse();
  await app.routes.get('POST /api/wallet/rewards/mission')(rewardReq, rewardRes);
  assert.equal(rewardRes.statusCode, 201);
  assert.equal(rewardRes.body.wallet.currentBalance, 50);

  const spendRes = createMockResponse();
  await app.routes.get('POST /api/wallet/spend')({
    headers: { authorization: '******' },
    body: { sink: 'card_forge', idempotencyKey: 'forge-spend-1' },
  }, spendRes);
  assert.equal(spendRes.statusCode, 201);
  assert.equal(spendRes.body.wallet.currentBalance, 25);

  const getRes = createMockResponse();
  await app.routes.get('GET /api/wallet')({
    headers: { authorization: '******' },
  }, getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.recentTransactions.length, 2);

  const unauthenticatedRes = createMockResponse();
  await app.routes.get('GET /api/wallet')({
    headers: {},
  }, unauthenticatedRes);
  assert.equal(unauthenticatedRes.statusCode, 401);
});
