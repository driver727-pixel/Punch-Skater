import test from 'node:test';
import assert from 'node:assert/strict';
import { registerRewardRoutes } from '../routes/rewards.js';
import { toDateKey } from '../dailyRewards.js';

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
  const req = { body };
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

  for (let index = 0; index < route.handlers.length && !res.ended;) {
    const handler = route.handlers[index];
    if (handler.length >= 3) {
      let nextCalled = false;
      await handler(req, res, () => {
        nextCalled = true;
      });
      if (!nextCalled) break;
      index += 1;
      continue;
    }
    await handler(req, res);
    index += 1;
  }

  return res;
}

function makeSnapshot(data) {
  return {
    exists: data !== undefined,
    data: () => data,
  };
}

function makeDocRef(path) {
  return {
    path,
    collection(name) {
      return makeCollectionRef(`${path}/${name}`);
    },
  };
}

function makeCollectionRef(path) {
  return {
    path,
    doc(id) {
      return makeDocRef(`${path}/${id}`);
    },
  };
}

function makeAdminDb(snapshots = {}) {
  const snapshotMap = new Map(Object.entries(snapshots));
  const adminDb = {
    lastTransaction: null,
    collection(name) {
      return makeCollectionRef(name);
    },
    async runTransaction(callback) {
      const tx = {
        sets: [],
        get: async (ref) => snapshotMap.get(ref.path) ?? makeSnapshot(undefined),
        set(ref, data, options) {
          this.sets.push({ path: ref.path, data, options });
        },
      };
      adminDb.lastTransaction = tx;
      return callback(tx);
    },
  };
  return adminDb;
}

function createRareSignupCard(overrides = {}) {
  return {
    id: 'signup-card-1',
    prompts: { rarity: 'Rare' },
    class: { rarity: 'Rare' },
    ...overrides,
  };
}

function registerHarnessRoute(options) {
  const app = createAppHarness();
  let rateLimitCalls = 0;
  registerRewardRoutes(app, {
    rewardRateLimit: (_req, _res, next) => {
      rateLimitCalls += 1;
      next();
    },
    authenticateFirebaseUser: async () => ({ uid: 'user-1' }),
    ...options,
  });
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].path, '/api/player-rewards/sync');
  return { route: app.routes[0], getRateLimitCalls: () => rateLimitCalls };
}

test('player reward sync returns 503 when adminDb is unavailable', async () => {
  const { route, getRateLimitCalls } = registerHarnessRoute({ adminDb: null });

  const res = await invokeRoute(route, { body: { signupBonusCard: createRareSignupCard() } });

  assert.equal(getRateLimitCalls(), 1);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'Player rewards are not configured on this server.' });
});

test('player reward sync returns auth errors before touching reward state', async () => {
  const adminDb = makeAdminDb();
  const { route } = registerHarnessRoute({
    adminDb,
    authenticateFirebaseUser: async () => {
      throw Object.assign(new Error('Token expired.'), { statusCode: 401 });
    },
  });

  const res = await invokeRoute(route, { body: { signupBonusCard: createRareSignupCard() } });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Token expired.' });
  assert.equal(adminDb.lastTransaction, null);
});

test('player reward sync rejects invalid signup bonus cards before granting rewards', async () => {
  const originalConsoleError = console.error;
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ missionXp: 0, missionOzzies: 0 }),
    'dailyStreaks/user-1': makeSnapshot({}),
  });
  const { route } = registerHarnessRoute({ adminDb });
  console.error = () => {};

  try {
    const missingPayloadRes = await invokeRoute(route);
    assert.equal(missingPayloadRes.statusCode, 400);
    assert.deepEqual(missingPayloadRes.body, { error: 'signupBonusCard payload is required.' });
    assert.deepEqual(adminDb.lastTransaction.sets, []);

    const missingIdRes = await invokeRoute(route, {
      body: { signupBonusCard: createRareSignupCard({ id: '   ' }) },
    });
    assert.equal(missingIdRes.statusCode, 400);
    assert.deepEqual(missingIdRes.body, { error: 'signupBonusCard.id must be a non-empty string.' });
    assert.deepEqual(adminDb.lastTransaction.sets, []);

    const wrongRarityRes = await invokeRoute(route, {
      body: {
        signupBonusCard: createRareSignupCard({
          prompts: { rarity: 'Master' },
        }),
      },
    });

    assert.equal(wrongRarityRes.statusCode, 400);
    assert.deepEqual(wrongRarityRes.body, { error: 'Signup bonus cards must be Rare class cards.' });
    assert.deepEqual(adminDb.lastTransaction.sets, []);
  } finally {
    console.error = originalConsoleError;
  }
});

test('player reward sync grants first signup card and continuing daily streak', async () => {
  const yesterday = toDateKey(new Date(Date.now() - 86_400_000));
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ missionXp: 10, missionOzzies: 5 }),
    'dailyStreaks/user-1': makeSnapshot({
      currentStreak: 1,
      longestStreak: 1,
      totalClaims: 1,
      lastClaimDate: yesterday,
    }),
  });
  const { route } = registerHarnessRoute({ adminDb });
  const signupBonusCard = createRareSignupCard();

  const res = await invokeRoute(route, { body: { signupBonusCard } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.signupBonusGranted, true);
  assert.equal(res.body.signupBonusCardId, 'signup-card-1');
  assert.deepEqual(res.body.dailyReward, {
    claimed: true,
    currentStreak: 2,
    longestStreak: 2,
    totalClaims: 2,
    lastClaimDate: toDateKey(),
    rewardXp: 40,
    rewardOzzies: 16,
  });
  assert.deepEqual(res.body.progression, { missionXp: 50, missionOzzies: 21 });
  assert.ok(adminDb.lastTransaction.sets.some((write) => write.path === 'users/user-1/cards/signup-card-1'));
  assert.ok(adminDb.lastTransaction.sets.some((write) => write.path === 'dailyStreaks/user-1'));
  assert.ok(adminDb.lastTransaction.sets.some((write) => write.path === 'userProfiles/user-1'));
});

test('player reward sync is idempotent after signup and same-day reward are already claimed', async () => {
  const today = toDateKey();
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({
      signupRareCardClaimedAt: 'timestamp',
      signupBonusCardId: 'existing-card',
      missionXp: 99,
      missionOzzies: 77,
    }),
    'dailyStreaks/user-1': makeSnapshot({
      currentStreak: 3,
      longestStreak: 4,
      totalClaims: 9,
      lastClaimDate: today,
    }),
  });
  const { route } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(route);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.signupBonusGranted, false);
  assert.equal(res.body.signupBonusCardId, 'existing-card');
  assert.deepEqual(res.body.dailyReward, {
    claimed: false,
    currentStreak: 3,
    longestStreak: 4,
    totalClaims: 9,
    lastClaimDate: today,
    rewardXp: 0,
    rewardOzzies: 0,
  });
  assert.deepEqual(res.body.progression, { missionXp: 99, missionOzzies: 77 });
  assert.deepEqual(adminDb.lastTransaction.sets, []);
});
