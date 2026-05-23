import test from 'node:test';
import assert from 'node:assert/strict';
import { registerRewardRoutes } from '../routes/rewards.js';
import { toDateKey } from '../dailyRewards.js';
import {
  COLLECTION_REWARD_CATALOG,
  COLLECTION_REROLL_TOKEN_CAP,
  evaluateCollectionRewards,
} from '../lib/collectionRewards.js';

function createAppHarness() {
  const routes = [];
  return {
    routes,
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
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

function makeQuerySnapshot(docs = []) {
  return {
    docs: docs.map((data, index) => ({
      id: data?.id ?? `doc-${index}`,
      data: () => data,
    })),
  };
}

function makeDocRef(path, snapshotMap) {
  return {
    path,
    get: async () => snapshotMap.get(path) ?? makeSnapshot(undefined),
    collection(name) {
      return makeCollectionRef(`${path}/${name}`, snapshotMap);
    },
  };
}

function makeCollectionRef(path, snapshotMap) {
  return {
    path,
    get: async () => snapshotMap.get(path) ?? makeQuerySnapshot([]),
    doc(id) {
      return makeDocRef(`${path}/${id}`, snapshotMap);
    },
  };
}

function makeAdminDb(snapshots = {}) {
  const snapshotMap = new Map(Object.entries(snapshots));
  const adminDb = {
    lastTransaction: null,
    collection(name) {
      return makeCollectionRef(name, snapshotMap);
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

function createRewardCard(index, overrides = {}) {
  const rarity = overrides.rarity ?? 'Rare';
  return {
    id: `card-${index}`,
    identity: {
      name: `Skater ${index}`,
      crew: 'Punch Skater™s',
      serialNumber: `PS-${index}`,
      ...overrides.identity,
    },
    prompts: {
      rarity,
      archetype: 'The Team',
      district: 'Airaway',
      ...overrides.prompts,
    },
    class: {
      rarity,
      badgeLabel: rarity,
      multiplier: 1,
      ...overrides.class,
    },
    stats: overrides.stats ?? { speed: 10, range: 10, rangeNm: 10, stealth: 10, grit: 10 },
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
  return {
    app,
    route: app.routes.find((route) => route.path === '/api/player-rewards/sync'),
    getRoute: (path) => app.routes.find((route) => route.path === path),
    getRateLimitCalls: () => rateLimitCalls,
  };
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
    claimedToday: true,
    currentStreak: 2,
    longestStreak: 2,
    totalClaims: 2,
    lastClaimDate: toDateKey(),
    rewardXp: 40,
    rewardOzzies: 16,
    nextRewardXp: 50,
    nextRewardOzzies: 20,
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
    claimedToday: true,
    currentStreak: 3,
    longestStreak: 4,
    totalClaims: 9,
    lastClaimDate: today,
    rewardXp: 0,
    rewardOzzies: 0,
    nextRewardXp: 60,
    nextRewardOzzies: 24,
  });
  assert.deepEqual(res.body.progression, { missionXp: 99, missionOzzies: 77 });
  assert.deepEqual(adminDb.lastTransaction.sets, []);
});

test('collection reward catalogue never grants combat power', () => {
  const forbiddenKinds = new Set(['stat_boost', 'deck_power', 'rarity_upgrade', 'legendary_access', 'battle_advantage']);
  for (const reward of COLLECTION_REWARD_CATALOG) {
    assert.equal(forbiddenKinds.has(reward.kind), false, `${reward.id} should not grant combat power`);
    if (reward.kind === 'reroll_token') {
      assert.equal(reward.safetyTier, 'controlled');
      continue;
    }
    assert.equal(reward.safetyTier, 'safe');
  }

  const capped = evaluateCollectionRewards(
    Array.from({ length: 12 }, (_, index) => createRewardCard(index)),
    { rerollTokens: 999, claimedMilestoneIds: [], badgeIds: [], titleIds: [], frameIds: [], loreIds: [] },
  );
  assert.equal(capped.state.rerollTokens, COLLECTION_REROLL_TOKEN_CAP);
});

test('collection reward preview evaluates unique cards without changing stat power', async () => {
  const cards = Array.from({ length: 5 }, (_, index) => createRewardCard(index));
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: {} }),
    'dailyStreaks/user-1': makeSnapshot({ currentStreak: 1 }),
    'users/user-1/cards': makeQuerySnapshot(cards),
  });
  const { getRoute } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(getRoute('/api/collection-rewards'));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.evaluation.uniqueCardCount, 5);
  const starter = res.body.evaluation.milestones.find((entry) => entry.milestone.id === 'collection-unique-5');
  assert.equal(starter.eligible, true);
  assert.deepEqual(cards.map((card) => card.stats.speed), [10, 10, 10, 10, 10]);
});

test('collection reward claim rejects incomplete milestones', async () => {
  const cards = Array.from({ length: 4 }, (_, index) => createRewardCard(index));
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: {} }),
    'dailyStreaks/user-1': makeSnapshot({}),
    'users/user-1/cards': makeQuerySnapshot(cards),
  });
  const { getRoute } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(getRoute('/api/collection-rewards/claim'), {
    body: { milestoneId: 'collection-unique-5' },
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Collection reward milestone is not complete yet.' });
  assert.equal(adminDb.lastTransaction, null);
});

test('collection reward claim is idempotent and stores account-level rewards', async () => {
  const cards = Array.from({ length: 5 }, (_, index) => createRewardCard(index));
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: {} }),
    'dailyStreaks/user-1': makeSnapshot({}),
    'users/user-1/cards': makeQuerySnapshot(cards),
  });
  const { getRoute } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(getRoute('/api/collection-rewards/claim'), {
    body: { milestoneId: 'collection-unique-5' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.claimed, true);
  assert.equal(res.body.rewards[0].kind, 'badge');
  const profileWrite = adminDb.lastTransaction.sets.find((write) => write.path === 'userProfiles/user-1');
  const claimWrite = adminDb.lastTransaction.sets.find((write) => write.path === 'users/user-1/rewardClaims/collection-unique-5');
  assert.ok(profileWrite);
  assert.ok(claimWrite);
  assert.deepEqual(profileWrite.data.collectionRewards.badgeIds, ['badge-starter-stack']);
  assert.deepEqual(profileWrite.data.collectionRewards.claimedMilestoneIds, ['collection-unique-5']);
  assert.equal(claimWrite.data.source, 'collection_rewards');

  const duplicateDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: profileWrite.data.collectionRewards }),
    'dailyStreaks/user-1': makeSnapshot({}),
    'users/user-1/cards': makeQuerySnapshot(cards),
  });
  const { getRoute: getDuplicateRoute } = registerHarnessRoute({ adminDb: duplicateDb });
  const duplicateRes = await invokeRoute(getDuplicateRoute('/api/collection-rewards/claim'), {
    body: { milestoneId: 'collection-unique-5' },
  });

  assert.equal(duplicateRes.statusCode, 200);
  assert.equal(duplicateRes.body.claimed, false);
  assert.equal(duplicateRes.body.alreadyClaimed, true);
  assert.deepEqual(duplicateDb.lastTransaction.sets, []);
});

test('collection reroll spend rejects unknown actions', async () => {
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: { rerollTokens: 3 } }),
    'dailyStreaks/user-1': makeSnapshot({}),
    'users/user-1/cards': makeQuerySnapshot([]),
  });
  const { getRoute } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(getRoute('/api/collection-rewards/reroll'), {
    body: { actionId: 'not-real' },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Unknown cosmetic reroll action.' });
  assert.equal(adminDb.lastTransaction, null);
});

test('collection reroll spend enforces token balance', async () => {
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: { rerollTokens: 1 } }),
    'dailyStreaks/user-1': makeSnapshot({}),
    'users/user-1/cards': makeQuerySnapshot([]),
  });
  const { getRoute } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(getRoute('/api/collection-rewards/reroll'), {
    body: { actionId: 'full' },
  });

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'You need 2 reroll tokens for full reroll.' });
  assert.deepEqual(adminDb.lastTransaction.sets, []);
});

test('collection reroll spend decrements tokens and returns updated evaluation', async () => {
  const cards = Array.from({ length: 5 }, (_, index) => createRewardCard(index));
  const adminDb = makeAdminDb({
    'userProfiles/user-1': makeSnapshot({ collectionRewards: { rerollTokens: 3, badgeIds: [], titleIds: [], frameIds: [], loreIds: [], claimedMilestoneIds: [] } }),
    'dailyStreaks/user-1': makeSnapshot({}),
    'users/user-1/cards': makeQuerySnapshot(cards),
  });
  const { getRoute } = registerHarnessRoute({ adminDb });

  const res = await invokeRoute(getRoute('/api/collection-rewards/reroll'), {
    body: { actionId: 'board' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.action.id, 'board');
  assert.equal(res.body.evaluation.state.rerollTokens, 2);
  const profileWrite = adminDb.lastTransaction.sets.find((write) => write.path === 'userProfiles/user-1');
  assert.ok(profileWrite);
  assert.equal(profileWrite.data.collectionRewards.rerollTokens, 2);
});
