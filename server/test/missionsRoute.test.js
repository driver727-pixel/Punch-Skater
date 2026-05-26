import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionCardOutcomeUpdate, buildMissionResolutionRisk, registerMissionRoutes } from '../routes/missions.js';
import { createMissionBoardEntries } from '../lib/missions.js';

function createAppHarness() {
  const middleware = [];
  const routes = [];
  return {
    use(path, ...handlers) {
      middleware.push({ path, handlers });
    },
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
    getRoute(method, path) {
      const route = routes.find((candidate) => candidate.method === method && candidate.path === path);
      if (!route) return null;
      return {
        ...route,
        handlers: [
          ...middleware
            .filter((entry) => path === entry.path || path.startsWith(`${entry.path}/`))
            .flatMap((entry) => entry.handlers),
          ...route.handlers,
        ],
      };
    },
  };
}

async function invokeRoute(route, { body = {}, headers = {} } = {}) {
  const responseHeaders = new Map();
  const req = {
    body,
    headers,
    method: 'POST',
    ip: '127.0.0.1',
    app: { get: () => false },
  };
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      responseHeaders.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return responseHeaders.get(String(name).toLowerCase());
    },
    removeHeader(name) {
      responseHeaders.delete(String(name).toLowerCase());
    },
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

function registerMissionHarness(options = {}) {
  const app = createAppHarness();
  registerMissionRoutes(app, {
    adminDb: {},
    missionRateLimit: (_req, _res, next) => next(),
    authenticateFirebaseUser: async () => ({ uid: 'user-1' }),
    districtWeatherService: null,
    FAL_KEY: 'fal-secret',
    buildFalImageRequest: async (body) => body,
    normalizeFalProfile: () => 'default',
    resolveFalProfile: () => ({ modelUrl: 'https://fal.run/test-model' }),
    ...options,
  });
  return app;
}

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createSnapshot(value) {
  return {
    exists: value !== undefined,
    data: () => cloneData(value),
  };
}

function createFirestoreHarness(initialData = {}) {
  const store = new Map(Object.entries(initialData).map(([path, value]) => [path, cloneData(value)]));
  const writeLog = [];

  function createRef(path) {
    return {
      path,
      async get() {
        return createSnapshot(store.get(path));
      },
      async set(data, options = {}) {
        const previous = store.get(path);
        const next = options.merge
          ? { ...(previous ?? {}), ...cloneData(data) }
          : cloneData(data);
        store.set(path, next);
        writeLog.push({ path, data: next, options });
      },
      collection(name) {
        return createCollection(`${path}/${name}`);
      },
    };
  }

  function createCollection(path) {
    return {
      doc(id) {
        return createRef(`${path}/${id}`);
      },
    };
  }

  return {
    store,
    writeLog,
    collection: createCollection,
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          return createSnapshot(store.get(ref.path));
        },
        set(ref, data, options = {}) {
          const previous = store.get(ref.path);
          const next = options.merge
            ? { ...(previous ?? {}), ...cloneData(data) }
            : cloneData(data);
          store.set(ref.path, next);
          writeLog.push({ path: ref.path, data: next, options });
        },
      });
    },
  };
}

function buildCard(overrides = {}) {
  return {
    id: overrides.id ?? 'card-default',
    prompts: {
      archetype: 'The Knights Technarchy',
      district: 'The Grid',
      ...overrides.prompts,
    },
    identity: {
      name: 'Signal Flash',
      crew: 'The Knights Technarchy',
      ...overrides.identity,
    },
    stats: {
      speed: 8,
      range: 6,
      stealth: 4,
      grit: 5,
      ...overrides.stats,
    },
    board: {
      config: {
        boardType: 'Street',
        wheels: 'Urethane',
        ...overrides.board?.config,
      },
    },
    maintenance: {
      state: 'active',
      chargePct: 100,
      repairMinutes: 15,
      ...overrides.maintenance,
    },
  };
}

function buildGridDeck(overrides = {}) {
  return {
    id: overrides.id ?? 'deck-grid-ready',
    name: overrides.name ?? 'Grid Ready Stack',
    cards: [
      buildCard({
        id: 'grid-runner-1',
        prompts: { archetype: 'The Knights Technarchy', district: 'The Grid' },
        identity: { crew: 'The Knights Technarchy', name: 'Trace Lead' },
        stats: { speed: 8, range: 8, stealth: 7, grit: 5 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
      }),
      buildCard({
        id: 'grid-runner-2',
        prompts: { archetype: 'Qu111s', district: 'The Grid' },
        identity: { crew: 'Qu111s', name: 'Ghost Pivot' },
        stats: { speed: 8, range: 7, stealth: 7, grit: 5 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
      }),
      buildCard({
        id: 'grid-runner-3',
        prompts: { archetype: 'The Knights Technarchy', district: 'The Grid' },
        identity: { crew: 'The Knights Technarchy', name: 'Camera Breaker' },
        stats: { speed: 7, range: 7, stealth: 6, grit: 5 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
      }),
      ...Array.from({ length: 3 }, (_, index) => buildCard({
        id: `grid-runner-extra-${index + 1}`,
        prompts: { archetype: 'Qu111s', district: 'The Grid' },
        identity: { crew: 'Qu111s', name: `Trace Support ${index + 1}` },
        stats: { speed: 6, range: 6, stealth: 5, grit: 5 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
      })),
    ],
    ...overrides,
  };
}

test('buildMissionCardOutcomeUpdate persists Grid fallout as an offline repair state', () => {
  const update = buildMissionCardOutcomeUpdate(
    { district: 'The Grid' },
    { id: 'deck-grid', cards: [buildCard({ id: 'grid-1' })] },
    '2026-05-08T16:33:38.982Z',
  );

  assert.equal(update?.affectedCard.maintenance.state, 'in_shop');
  assert.equal(update?.affectedCard.maintenance.chargePct, 0);
  assert.equal(update?.outcomes?.[0].outcomeKind, 'offline');
  assert.equal(update?.outcomes?.[0].recapDisposition, 'offline');
});

test('buildMissionResolutionRisk targets the live rider when a mission resolves badly', () => {
  const resolutionRisk = buildMissionResolutionRisk(
    { district: 'Glass City' },
    {
      id: 'deck-glass',
      cards: [
        buildCard({ id: 'card-a', identity: { name: 'First Rider' } }),
        buildCard({ id: 'card-b', identity: { name: 'Second Rider' } }),
      ],
    },
    { activeCardIds: ['card-b'] },
    { hardCutout: true, joustResult: null },
    '2026-05-08T16:33:38.982Z',
  );

  assert.equal(resolutionRisk?.affectedCard.id, 'card-b');
  assert.equal(resolutionRisk?.affectedCard.maintenance.state, 'impounded');
  assert.equal(resolutionRisk?.outcomes?.[0].outcomeKind, 'impound');
});

test('mission map proxy authenticates and forwards sanitized requests to the default FAL model', async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  let authCalls = 0;
  let requestBuilderCalls = 0;
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ images: [{ url: 'https://fal.media/map.png' }] }),
    };
  };

  try {
    const app = registerMissionHarness({
      authenticateFirebaseUser: async () => {
        authCalls += 1;
        return { uid: 'user-1' };
      },
      buildFalImageRequest: async (body) => {
        requestBuilderCalls += 1;
        return { ...body, built: true };
      },
    });
    const route = app.getRoute('POST', '/api/missions/map');

    const res = await invokeRoute(route, {
      body: {
        prompt: '  Neon route map  ',
        seed: '42',
        num_images: 9,
        output_format: 'jpeg',
        fal_profile: 'character',
      },
      headers: { authorization: 'Bearer firebase-token' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { images: [{ url: 'https://fal.media/map.png' }] });
    assert.equal(authCalls, 1);
    assert.equal(requestBuilderCalls, 1);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fal.run/test-model');
    assert.equal(fetchCalls[0].options.headers.Authorization, 'Key fal-secret');
    assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
      prompt: 'Neon route map',
      seed: 42,
      image_size: { width: 1024, height: 1024 },
      fal_profile: 'default',
      output_format: 'png',
      enable_safety_checker: true,
      num_images: 1,
      built: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mission courier token proxy returns Firebase auth errors before calling FAL', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  try {
    const app = registerMissionHarness({
      authenticateFirebaseUser: async () => {
        throw Object.assign(new Error('Invalid or expired ID token.'), { statusCode: 401 });
      },
    });
    const route = app.getRoute('POST', '/api/missions/courier-token');

    const res = await invokeRoute(route, { body: { prompt: 'Courier marker' } });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired ID token.' });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mission courier token proxy validates prompt before forwarding', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  try {
    const app = registerMissionHarness();
    const route = app.getRoute('POST', '/api/missions/courier-token');

    const res = await invokeRoute(route, { body: { prompt: '   ' } });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'prompt is required.' });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mission run forces blind-entry failureRisk fallout when traveling to an un-scanned node', async () => {
  const mission = {
    ...createMissionBoardEntries('user-1').find((entry) => entry.definitionId === 'grid-trace'),
    isScanned: false,
    gridPos: { x: 44, y: 38 },
  };
  const deck = buildGridDeck({ id: 'deck-blind-entry', name: 'Blind Entry Stack' });
  const adminDb = createFirestoreHarness({
    [`missions/${mission.id}`]: mission,
    'users/user-1/decks/deck-blind-entry': deck,
    'userProfiles/user-1': { missionXp: 10, missionOzzies: 20 },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/run');

  const res = await invokeRoute(route, {
    body: {
      missionId: mission.id,
      deckId: deck.id,
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.rewardGranted, false);
  assert.equal(res.body.awaitingChoice, undefined);
  assert.equal(res.body.mission.lastRunSucceeded, false);
  assert.equal(res.body.mission.activeRun, null);
  assert.match(res.body.mission.lastRunSummary, /Blind entry failed/i);
  assert.ok(res.body.mission.lastRunFailureReasons.some((reason) => /Blind entry/i.test(reason)));
  assert.equal(res.body.mission.lastRunCardOutcomes.length, 1);
  assert.equal(res.body.mission.lastRunCardOutcomes[0].cardId, 'grid-runner-1');

  const updatedDeck = adminDb.store.get('users/user-1/decks/deck-blind-entry');
  assert.equal(updatedDeck.cards[0].maintenance.state, 'in_shop');
  assert.equal(updatedDeck.cards[0].maintenance.repairMinutes, 15);
  assert.ok(adminDb.writeLog.some((write) => write.path === 'users/user-1/cards/grid-runner-1'));
});

test('mission run launches then resolves live encounter payloads through the transaction pipeline', async () => {
  const mission = {
    ...createMissionBoardEntries('user-1').find((entry) => entry.definitionId === 'grid-parent-trace'),
    isScanned: true,
    gridPos: { x: 50, y: 42 },
  };
  const deck = buildGridDeck({ id: 'deck-live-pipeline', name: 'Live Pipeline Stack' });
  const adminDb = createFirestoreHarness({
    [`missions/${mission.id}`]: mission,
    'users/user-1/decks/deck-live-pipeline': deck,
    'userProfiles/user-1': {
      missionXp: 10,
      missionOzzies: 20,
      districtReputation: 0,
      defeatedRivalIds: [],
      codexUnlockIds: [],
      rivalRecords: {},
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/run');

  const launch = await invokeRoute(route, {
    body: {
      missionId: mission.id,
      deckId: deck.id,
    },
  });

  assert.equal(launch.statusCode, 200);
  assert.equal(launch.body.awaitingChoice, true);
  assert.equal(launch.body.rewardGranted, false);
  assert.equal(launch.body.mission.activeRun.phase, 'event');
  assert.ok(launch.body.mission.activeRun.availableCounterOptionIds.includes('archive-heist'));

  const resolve = await invokeRoute(route, {
    body: {
      missionId: mission.id,
      deckId: deck.id,
      counterOptionId: 'archive-heist',
    },
  });

  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.body.rewardGranted, true);
  assert.equal(resolve.body.awaitingChoice, undefined);
  assert.equal(resolve.body.mission.status, 'completed');
  assert.equal(resolve.body.mission.selectedCounterOptionId, 'archive-heist');
  assert.equal(resolve.body.mission.activeRun.phase, 'resolved');
  assert.equal(resolve.body.mission.lastRunSucceeded, true);
  assert.equal(resolve.body.mission.lastRunRewardOzzies, 140);
  assert.equal(resolve.body.progression.missionXp, 330);
  assert.equal(resolve.body.progression.missionOzzies, 160);
  assert.ok(resolve.body.mission.lastRunStoryBeats.length > 0);

  const persistedMission = adminDb.store.get(`missions/${mission.id}`);
  assert.equal(persistedMission.status, 'completed');
  assert.equal(persistedMission.activeRun.selectedCounterOptionId, 'archive-heist');
});

test('district world run start returns an A* edge-valid route and checkpoint state', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const world = {
    worldId,
    boardDateKey,
    dailyResetAt: `${boardDateKey}T23:59:59.000Z`,
    nodes: [
      { id: 'workshop', kind: 'workshop', x: 10, y: 10, label: 'Workshop' },
      { id: 'junction-0', kind: 'junction', x: 25, y: 10, label: '' },
      { id: 'poi-0', kind: 'poi', x: 40, y: 10, label: 'Node One', contractId: 'contract-1' },
    ],
    edges: [
      { from: 'workshop', to: 'junction-0' },
      { from: 'junction-0', to: 'poi-0' },
    ],
    contracts: [
      {
        id: 'contract-1',
        nodeId: 'poi-0',
        definitionId: 'def-1',
        title: 'Contract One',
        tagline: 'First route',
        district: 'The Grid',
        rewardXp: 100,
        rewardOzzies: 80,
        visibility: 'visible',
        status: 'active',
      },
    ],
  };
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: world,
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/run');

  const res = await invokeRoute(route, {
    body: {
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
    },
  });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.activeRun.routeNodeIds, ['workshop', 'junction-0', 'poi-0']);
  assert.equal(res.body.activeRun.checkpointNodeIndex, 0);
});

test('district world checkpoint route persists sequential travel and marks poi arrival', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'outbound',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 0,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:00:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/checkpoint');

  const invalidSkip = await invokeRoute(route, {
    body: { runId, nodeId: 'poi-0', checkpointNodeIndex: 2 },
  });
  assert.equal(invalidSkip.statusCode, 400);

  const first = await invokeRoute(route, {
    body: { runId, nodeId: 'junction-0', checkpointNodeIndex: 1 },
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.activeRun.checkpointNodeIndex, 1);
  assert.equal(first.body.activeRun.phase, 'outbound');

  const second = await invokeRoute(route, {
    body: { runId, nodeId: 'poi-0', checkpointNodeIndex: 2 },
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.activeRun.phase, 'at_poi');
  assert.equal(second.body.activeRun.checkpointNodeIndex, 2);
});
