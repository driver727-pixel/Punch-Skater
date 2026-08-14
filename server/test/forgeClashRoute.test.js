import test from 'node:test';
import assert from 'node:assert/strict';
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

    collection(name) {
      return new FakeCollectionRef(`${this.path}/${name}`);
    }

    async get() {
      return createSnapshot(this.path, store.get(this.path));
    }

    set(data, options = {}) {
      const current = store.get(this.path) ?? {};
      const next = options.merge ? { ...current, ...structuredClone(data) } : structuredClone(data);
      store.set(this.path, next);
    }
  }

  class FakeCollectionRef {
    constructor(path) {
      this.path = path;
    }

    doc(id) {
      return new FakeDocRef(`${this.path}/${id}`);
    }

    where(field, op, value) {
      if (op !== '==') {
        throw new Error(`Unsupported query operator: ${op}`);
      }
      const docs = this.listDocs().filter((snap) => snap.data()?.[field] === value);
      return {
        async get() {
          return { docs };
        },
      };
    }

    listDocs() {
      return [...store.entries()]
        .filter(([path]) => (
          path.startsWith(`${this.path}/`)
          && path.split('/').length === this.path.split('/').length + 1
        ))
        .map(([path]) => createSnapshot(path, store.get(path)));
    }

    async get() {
      return { docs: this.listDocs() };
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
    read(path) {
      const value = store.get(path);
      return value === undefined ? undefined : structuredClone(value);
    },
    write(path, value) {
      store.set(path, structuredClone(value));
    },
  };
}

function createFakeApp() {
  const routes = new Map();
  const register = (method) => (path, ...handlers) => {
    routes.set(`${method} ${path}`, handlers);
  };
  return {
    use() {},
    get: register('GET'),
    post: register('POST'),
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

async function invokeHandlers(handlers, req, res, index = 0) {
  const handler = handlers[index];
  if (!handler) return;
  let nextPromise;
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
    nextPromise = invokeHandlers(handlers, req, res, index + 1);
    return nextPromise;
  };
  await handler(req, res, next);
  if (nextCalled) await nextPromise;
}

function buildCard(id, overrides = {}) {
  return {
    id,
    name: overrides.name ?? `Crew Rider ${id}`,
    prompts: {
      archetype: 'The Team',
      district: 'Batteryville',
      rarity: 'Punch Skater™',
    },
    identity: {
      name: overrides.name ?? `Crew Rider ${id}`,
      crew: 'The Team',
    },
    stats: {
      speed: 8,
      range: 7,
      rangeNm: 7,
      stealth: 5,
      grit: 7,
    },
    joust: {
      lance: 7,
      shield: 7,
      hype: 7,
      gear: {
        boardType: 'Street',
        lanceType: 'kinetic',
        shieldType: 'riot',
        armorTag: 'street shell',
      },
      traits: [],
    },
    xp: 5,
    ozzies: 2,
  };
}

function seedCards(db, ownerUid, count = 6) {
  const roster = [];
  for (let index = 1; index <= count; index += 1) {
    const cardId = `card-${index}`;
    db.write(`users/${ownerUid}/cards/${cardId}`, buildCard(cardId));
    roster.push({ cardId, ...(ownerUid === 'player-1' ? {} : { ownerUid }) });
  }
  return roster;
}

function createHarness() {
  const adminDb = createFakeDb();
  const app = createFakeApp();
  const uuidValues = ['match-1', 'seed-1', 'match-2', 'seed-2'];
  registerForgeRoutes(app, {
    adminDb,
    forgeRateLimit: (_req, _res, next) => next(),
    authenticateFirebaseUser: async (req) => {
      const authorization = req.headers?.authorization;
      if (typeof authorization !== 'string' || !authorization) {
        throw Object.assign(new Error('Missing Authorization header.'), { statusCode: 401 });
      }
      return { uid: authorization };
    },
    FieldValue,
    randomUUID: () => uuidValues.shift() ?? 'fallback-id',
  });

  return {
    adminDb,
    async invoke(method, path, {
      body = {},
      query = {},
      authorization = 'player-1',
    } = {}) {
      const handlers = app.routes.get(`${method} ${path}`);
      assert.ok(handlers, `Missing route ${method} ${path}`);
      const req = {
        body,
        query,
        headers: authorization ? { authorization } : {},
      };
      const res = createMockResponse();
      await invokeHandlers(handlers, req, res);
      return res;
    },
  };
}

test('Forge Clash start authenticates, validates the Crew, and hides Jax future tactics', async () => {
  const harness = createHarness();
  const roster = seedCards(harness.adminDb, 'player-1');

  const unauthenticated = await harness.invoke('POST', '/api/forge/clash/start', {
    body: { roster },
    authorization: '',
  });
  assert.equal(unauthenticated.statusCode, 401);

  const duplicated = await harness.invoke('POST', '/api/forge/clash/start', {
    body: { roster: Array(6).fill(roster[0]) },
  });
  assert.equal(duplicated.statusCode, 400);

  const started = await harness.invoke('POST', '/api/forge/clash/start', {
    body: { roster },
  });
  assert.equal(started.statusCode, 201);
  assert.equal(started.body.match.roster.length, 6);
  assert.equal(started.body.match.telegraph.intent, 'rush');
  assert.equal(started.body.match.telegraph.hint, 'Charge or Boost likely');
  assert.equal('seed' in started.body.match, false);
  assert.equal('rivalPattern' in started.body.match, false);
});

test('Forge Clash play rejects foreign, stale, locked, and cooling-down commands', async () => {
  const harness = createHarness();
  const roster = seedCards(harness.adminDb, 'player-1');
  const started = await harness.invoke('POST', '/api/forge/clash/start', { body: { roster } });
  const match = started.body.match;

  const foreign = await harness.invoke('POST', '/api/forge/clash/play', {
    authorization: 'player-2',
    body: {
      matchId: match.id,
      slotId: match.roster[0].slotId,
      tactic: 'charge',
      turn: 1,
    },
  });
  assert.equal(foreign.statusCode, 403);

  const stale = await harness.invoke('POST', '/api/forge/clash/play', {
    body: {
      matchId: match.id,
      slotId: match.roster[0].slotId,
      tactic: 'charge',
      turn: 2,
    },
  });
  assert.equal(stale.statusCode, 409);

  const locked = await harness.invoke('POST', '/api/forge/clash/play', {
    body: {
      matchId: match.id,
      slotId: match.roster[0].slotId,
      tactic: 'feint',
      turn: 1,
    },
  });
  assert.equal(locked.statusCode, 400);

  const played = await harness.invoke('POST', '/api/forge/clash/play', {
    body: {
      matchId: match.id,
      slotId: match.roster[0].slotId,
      tactic: 'charge',
      turn: 1,
    },
  });
  assert.equal(played.statusCode, 201);
  assert.equal(played.body.match.latestRound.cardId, 'card-1');

  const coolingDown = await harness.invoke('POST', '/api/forge/clash/play', {
    body: {
      matchId: match.id,
      slotId: match.roster[0].slotId,
      tactic: 'charge',
      turn: 2,
    },
  });
  assert.equal(coolingDown.statusCode, 409);
});

test('a completed Forge Clash pays first-clear rewards exactly once', async () => {
  const harness = createHarness();
  const roster = seedCards(harness.adminDb, 'player-1');
  harness.adminDb.write('wallets/player-1', {
    uid: 'player-1',
    currentBalance: 10,
    lifetimeEarned: 10,
    lifetimeSpent: 0,
  });
  const started = await harness.invoke('POST', '/api/forge/clash/start', { body: { roster } });
  const matchId = started.body.match.id;
  const matchPath = `forgeClashMatches/${matchId}`;
  harness.adminDb.write(matchPath, {
    ...harness.adminDb.read(matchPath),
    turn: 6,
    playerHp: 59,
    rivalHp: 10,
    cooldowns: {},
  });

  const request = {
    matchId,
    slotId: 'owned:card-1',
    tactic: 'charge',
    turn: 6,
  };
  const completed = await harness.invoke('POST', '/api/forge/clash/play', { body: request });
  assert.equal(completed.statusCode, 201);
  assert.equal(completed.body.duplicate, false);
  assert.equal(completed.body.match.status, 'completed');
  assert.equal(completed.body.match.result, 'win');
  assert.equal(completed.body.match.rewards.xp, 80);
  assert.equal(completed.body.match.rewards.frameId, 'breaker-crown');
  assert.equal(completed.body.match.rewards.wallet.currentBalance, 34);
  assert.equal(completed.body.match.rewards.winStreak, 1);
  assert.deepEqual(completed.body.match.rewards.bonuses, []);

  const profile = harness.adminDb.read('userProfiles/player-1');
  assert.equal(profile.missionXp, 80);
  assert.equal(profile.missionOzzies, 24);
  assert.equal(profile.battleParticipationCount, 1);
  assert.equal(profile.districtReputation, 40);
  assert.equal(profile.forgeClashWinStreak, 1);
  assert.deepEqual(profile.defeatedRivalIds, ['batteryville-jax-voltage']);
  assert.deepEqual(profile.codexUnlockIds, ['codex-rival-jax-voltage']);
  assert.equal(profile.unlocked_frames[0].cardId, 'card-1');

  const rewardedCard = harness.adminDb.read('users/player-1/cards/card-1');
  assert.equal(rewardedCard.xp, 45);
  assert.equal(rewardedCard.ozzies, 12);
  assert.equal(rewardedCard.combatHistory.totalBattles, 1);
  assert.equal(rewardedCard.combatHistory.joustWins, 1);

  const duplicate = await harness.invoke('POST', '/api/forge/clash/play', { body: request });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(harness.adminDb.read('wallets/player-1').currentBalance, 34);
  assert.equal(harness.adminDb.read('userProfiles/player-1').battleParticipationCount, 1);
  assert.equal(harness.adminDb.read('users/player-1/cards/card-1').xp, 45);
});

test('Forge Clash start enriches the rival card with forged skater art layers', async () => {
  const harness = createHarness();
  harness.adminDb.write('userProfiles/art-admin', { isAdmin: true });
  harness.adminDb.write('users/art-admin/cards/jax-art-card', {
    ...buildCard('jax-art-card', { name: 'Jax Voltage' }),
    characterImageUrl: 'https://cdn.example.com/jax-character.png',
    backgroundImageUrl: 'https://cdn.example.com/jax-background.png',
    frameImageUrl: 'https://cdn.example.com/jax-frame.png',
    weaponImageUrl: 'https://cdn.example.com/jax-weapon.png',
    board: { imageUrl: 'https://cdn.example.com/jax-board.png' },
  });
  const roster = seedCards(harness.adminDb, 'player-1');

  const started = await harness.invoke('POST', '/api/forge/clash/start', { body: { roster } });

  assert.equal(started.statusCode, 201);
  const { rival } = started.body.match;
  assert.equal(rival.id, 'batteryville-jax-voltage');
  assert.equal(rival.name, 'Jax Voltage');
  assert.equal(rival.characterImageUrl, 'https://cdn.example.com/jax-character.png');
  assert.equal(rival.backgroundImageUrl, 'https://cdn.example.com/jax-background.png');
  assert.equal(rival.frameImageUrl, 'https://cdn.example.com/jax-frame.png');
  assert.equal(rival.weaponImageUrl, 'https://cdn.example.com/jax-weapon.png');
  assert.equal(rival.board.imageUrl, 'https://cdn.example.com/jax-board.png');
  // Stat snapshot stays server-authoritative — art layers must not leak stats.
  assert.equal(rival.joust.lance, 8);
  assert.equal(rival.joust.shield, 5);
});

test('Forge Clash start falls back to the static rival card when no forged art exists', async () => {
  const harness = createHarness();
  harness.adminDb.write('userProfiles/art-admin', { isAdmin: true });
  harness.adminDb.write('users/art-admin/cards/other-rider', {
    ...buildCard('other-rider', { name: 'Mina Chrome' }),
    characterImageUrl: 'https://cdn.example.com/mina-character.png',
  });
  const roster = seedCards(harness.adminDb, 'player-1');

  const started = await harness.invoke('POST', '/api/forge/clash/start', { body: { roster } });

  assert.equal(started.statusCode, 201);
  const { rival } = started.body.match;
  assert.equal(rival.name, 'Jax Voltage');
  assert.equal(rival.characterImageUrl, undefined);
  assert.equal(rival.joust.lance, 8);
});

test('official all-loaner Crews can play without claiming a card cosmetic', async () => {
  const harness = createHarness();
  harness.adminDb.write('userProfiles/admin-crew', { isAdmin: true });
  const roster = seedCards(harness.adminDb, 'admin-crew');
  const started = await harness.invoke('POST', '/api/forge/clash/start', { body: { roster } });
  assert.equal(started.statusCode, 201);
  assert.equal(started.body.match.roster.every((slot) => slot.loaner), true);

  const matchId = started.body.match.id;
  const matchPath = `forgeClashMatches/${matchId}`;
  harness.adminDb.write(matchPath, {
    ...harness.adminDb.read(matchPath),
    turn: 6,
    playerHp: 60,
    rivalHp: 10,
    cooldowns: {},
  });
  const completed = await harness.invoke('POST', '/api/forge/clash/play', {
    body: {
      matchId,
      slotId: 'loaner:admin-crew:card-1',
      tactic: 'charge',
      turn: 6,
    },
  });

  assert.equal(completed.statusCode, 201);
  assert.equal(completed.body.match.rewards.firstClear, true);
  assert.equal(completed.body.match.rewards.mvpCardId, null);
  assert.equal(completed.body.match.rewards.frameId, null);
  assert.deepEqual(harness.adminDb.read('userProfiles/player-1').unlocked_frames, []);
});
