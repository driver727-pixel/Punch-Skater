import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionCardOutcomeUpdate, buildMissionResolutionRisk, registerMissionRoutes } from '../routes/missions.js';
import { createMissionBoardEntries } from '../lib/missions.js';
import { selectWeightedEncounter } from '../lib/missionEncounterDefinitions.js';

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
      async delete() {
        store.delete(path);
        writeLog.push({ path, deleted: true });
      },
      collection(name) {
        return createCollection(`${path}/${name}`);
      },
    };
  }

    test('weighted encounter selection is deterministic and supports no-encounter rolls', () => {
    const candidates = [
      { weight: 10, encounter: { id: 'a', badge: 'A', prompt: 'A', threat: 'A', options: [{ id: 'go', label: 'Go', description: 'Go' }] } },
      { weight: 20, encounter: { id: 'b', badge: 'B', prompt: 'B', threat: 'B', options: [{ id: 'go', label: 'Go', description: 'Go' }] } },
    ];

    assert.deepEqual(
      selectWeightedEncounter(candidates, 'stable-seed', 0),
      selectWeightedEncounter(candidates, 'stable-seed', 0),
    );
    assert.equal(selectWeightedEncounter(candidates, 'stable-seed', 10_000), null);
  });

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

function createMissionVisualsDb({
  cardsByUser = {},
  decksByUser = {},
  visualsById = {},
  worldsById = {},
} = {}) {
  const cardStore = new Map(Object.entries(cardsByUser).map(([key, value]) => [key, cloneData(value)]));
  const deckStore = new Map(Object.entries(decksByUser).map(([key, value]) => [key, cloneData(value)]));
  const visualsStore = new Map(Object.entries(visualsById).map(([key, value]) => [key, cloneData(value)]));
  const worldsStore = new Map(Object.entries(worldsById).map(([key, value]) => [key, cloneData(value)]));
  const writeLog = [];

  return {
    writeLog,
    collection(name) {
      if (name === 'missionWorlds') {
        return {
          doc(id) {
            return {
              path: `missionWorlds/${id}`,
              async get() {
                return createSnapshot(worldsStore.get(id));
              },
            };
          },
        };
      }

      if (name === 'missionWorldVisuals') {
        return {
          doc(id) {
            return {
              path: `missionWorldVisuals/${id}`,
              async get() {
                return createSnapshot(visualsStore.get(id));
              },
              async set(data, options = {}) {
                const previous = visualsStore.get(id);
                const next = options.merge
                  ? { ...(previous ?? {}), ...cloneData(data) }
                  : cloneData(data);
                visualsStore.set(id, next);
                writeLog.push({ path: `missionWorldVisuals/${id}`, data: next, options });
              },
            };
          },
        };
      }

      if (name === 'users') {
        return {
          doc(uid) {
            return {
              collection(childName) {
                if (childName !== 'decks' && childName !== 'cards') throw new Error(`Unsupported subcollection: ${childName}`);
                return {
                  async get() {
                    const items = childName === 'decks'
                      ? deckStore.get(uid) ?? []
                      : cardStore.get(uid) ?? [];
                    return {
                      docs: items.map((item) => ({
                        data: () => cloneData(item),
                      })),
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unsupported collection: ${name}`);
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

test('mission visuals extraction carries saved character and skateboard layers for the map figurine', async () => {
  const boardDateKey = '2026-05-27';
  const worldId = `user-1_${boardDateKey}`;
  const savedCard = {
    ...buildCard(),
    characterSeed: 'scene-loadout-seed',
    characterImageUrl: 'https://example.com/character.png',
    characterPlacement: {
      xPercent: 52,
      yPercent: 57,
      scale: 1,
      rotationDeg: 0,
    },
    board: {
      ...buildCard().board,
      imageUrl: 'https://example.com/board.png',
      placement: {
        xPercent: 74,
        yPercent: 46,
        scale: 1,
        rotationDeg: 8,
      },
      layerOrder: 'behind-character',
    },
  };
  const adminDb = createMissionVisualsDb({
    worldsById: {
      [worldId]: {
        boardDateKey,
        contracts: [],
        nodes: [],
        edges: [],
      },
    },
    decksByUser: {
      'user-1': [
        {
          id: 'deck-1',
          name: 'Courier Stack',
          cards: [savedCard],
        },
      ],
    },
  });
  const app = registerMissionHarness({
    adminDb,
    FAL_KEY: '',
  });
  const route = app.getRoute('POST', '/api/missions/world/visuals');

  assert.ok(route);

  const response = await invokeRoute(route, {
    body: { boardDateKey },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.visuals.extraction.version, 'character-layer-contract-v2');
  assert.equal(response.body.visuals.extraction.characterImageUrl, savedCard.characterImageUrl);
  assert.equal(response.body.visuals.extraction.boardImageUrl, savedCard.board.imageUrl);
  assert.equal(response.body.visuals.extraction.boardLayerOrder, 'behind-character');
  assert.deepEqual(response.body.visuals.extraction.characterPlacement, savedCard.characterPlacement);
  assert.deepEqual(response.body.visuals.extraction.boardPlacement, savedCard.board.placement);
  assert.equal(response.body.visuals.extraction.sceneSeed, savedCard.characterSeed);
  assert.equal(response.body.visuals.sprite.fallback, true);
  assert.equal(adminDb.writeLog.length, 1);
});

test('mission visuals hydrate deck cards from the saved card forge collection before extracting layers', async () => {
  const boardDateKey = '2026-05-27';
  const worldId = `user-1_${boardDateKey}`;
  const staleDeckCard = {
    ...buildCard({ id: 'card-forge-1' }),
    characterImageUrl: 'https://example.com/stale-character.png',
  };
  const savedForgeCard = {
    ...staleDeckCard,
    characterImageUrl: 'https://example.com/forge-character.png',
    board: {
      ...staleDeckCard.board,
      imageUrl: 'https://example.com/forge-board.png',
      placement: {
        xPercent: 74,
        yPercent: 46,
        scale: 1,
        rotationDeg: 8,
      },
      layerOrder: 'behind-character',
    },
  };
  const adminDb = createMissionVisualsDb({
    worldsById: {
      [worldId]: {
        boardDateKey,
        contracts: [],
        nodes: [],
        edges: [],
      },
    },
    decksByUser: {
      'user-1': [
        {
          id: 'deck-1',
          name: 'Courier Stack',
          cards: [staleDeckCard],
        },
      ],
    },
    cardsByUser: {
      'user-1': [savedForgeCard],
    },
  });
  const app = registerMissionHarness({
    adminDb,
    FAL_KEY: '',
  });
  const route = app.getRoute('POST', '/api/missions/world/visuals');

  const response = await invokeRoute(route, {
    body: { boardDateKey },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.visuals.extraction.characterImageUrl, savedForgeCard.characterImageUrl);
  assert.equal(response.body.visuals.extraction.boardImageUrl, savedForgeCard.board.imageUrl);
  assert.equal(response.body.visuals.extraction.boardLayerOrder, 'behind-character');
});

test('mission visuals background-remove saved card forge character layers and keep the skateboard layer', async () => {
  const boardDateKey = '2026-05-27';
  const worldId = `user-1_${boardDateKey}`;
  const savedCard = {
    ...buildCard({ id: 'card-forge-2' }),
    characterImageUrl: 'https://example.com/forge-character-with-bg.png',
    board: {
      ...buildCard().board,
      imageUrl: 'https://example.com/forge-board.png',
      layerOrder: 'behind-character',
    },
  };
  const adminDb = createMissionVisualsDb({
    worldsById: {
      [worldId]: {
        boardDateKey,
        contracts: [],
        nodes: [],
        edges: [],
      },
    },
    visualsById: {
      [worldId]: {
        backdrop: {
          url: 'https://example.com/cached-backdrop.png',
          cacheKey: 'user-1:2026-05-27:missions-backdrop-v1',
          generatedAt: '2026-05-27T00:00:00.000Z',
          fallback: false,
        },
      },
    },
    decksByUser: {
      'user-1': [
        {
          id: 'deck-1',
          name: 'Courier Stack',
          cards: [savedCard],
        },
      ],
    },
    cardsByUser: {
      'user-1': [savedCard],
    },
  });
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (_url, options) => {
    fetchCalls.push(options);
    return {
      ok: true,
      async json() {
        return { image: { url: 'https://example.com/transparent-character.png' } };
      },
    };
  };

  try {
    const app = registerMissionHarness({
      adminDb,
      FAL_KEY: 'fal-secret',
    });
    const route = app.getRoute('POST', '/api/missions/world/visuals');

    const response = await invokeRoute(route, {
      body: { boardDateKey },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.visuals.extraction.characterImageUrl, 'https://example.com/transparent-character.png');
    assert.equal(response.body.visuals.extraction.extractionStatus, 'background_removed');
    assert.equal(response.body.visuals.extraction.boardImageUrl, savedCard.board.imageUrl);
    assert.equal(response.body.visuals.sprite.url, 'https://example.com/transparent-character.png');
    assert.equal(response.body.visuals.sprite.fallback, false);
    assert.equal(fetchCalls.length, 1);
    assert.equal(JSON.parse(fetchCalls[0].body).image_url, savedCard.characterImageUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test('district world run start rejects routes through dangling graph edges', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const world = {
    worldId,
    boardDateKey,
    dailyResetAt: `${boardDateKey}T23:59:59.000Z`,
    nodes: [
      { id: 'workshop', kind: 'workshop', x: 10, y: 10, label: 'Workshop' },
      { id: 'poi-0', kind: 'poi', x: 40, y: 10, label: 'Node One', contractId: 'contract-1' },
    ],
    edges: [
      { from: 'workshop', to: 'missing-junction' },
      { from: 'missing-junction', to: 'poi-0' },
    ],
    contracts: [
      {
        id: 'contract-1',
        nodeId: 'poi-0',
        definitionId: 'def-1',
        title: 'Contract One',
        tagline: 'Dangling route',
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

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'Unable to calculate a valid route to this contract.');
});

test('district world checkpoint route persists sequential travel and marks poi arrival', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: {
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
          tagline: 'Fork route',
          district: 'The Grid',
          rewardXp: 100,
          rewardOzzies: 80,
          visibility: 'visible',
          status: 'active',
          fork: {
            badge: 'Fork',
            prompt: 'Pick a fork.',
            options: [
              { id: 'archive-heist', label: 'Archive Heist', description: 'Pull the archive.', rewardXpDelta: 12, rewardOzziesDelta: 5 },
            ],
          },
        },
      ],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_OUTBOUND',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 0,
      encounterHistory: [{
        encounterId: 'already-cleared',
        resumePhase: 'TRAVELING_OUTBOUND',
        leg: 'outbound',
        triggeredAtNodeId: 'junction-previous',
        startedAt: `${boardDateKey}T01:00:30.000Z`,
        resolvedAt: `${boardDateKey}T01:00:40.000Z`,
        outcome: { resultType: 'travel_encounter', choiceId: 'safe' },
      }],
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
  assert.equal(first.body.activeRun.phase, 'TRAVELING_OUTBOUND');

  const second = await invokeRoute(route, {
    body: { runId, nodeId: 'poi-0', checkpointNodeIndex: 2 },
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.activeRun.phase, 'AT_POI_FORK');
  assert.equal(second.body.activeRun.checkpointNodeIndex, 2);
});

test('district world checkpoint can trigger a weighted encounter only at checkpoint moments', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldDocId = `user-1_${boardDateKey}`;
  const runId = 'user-1_test_run_1';
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldDocId}`]: {
      worldId: 'world-1',
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
          encounter: {
            id: 'contract-pressure',
            badge: '!',
            prompt: 'Contract pressure hits at the checkpoint.',
            threat: 'Pressure',
            options: [
              { id: 'safe', label: 'Safe Line', description: 'Keep the line safe.', rewardXpDelta: 3 },
            ],
          },
        },
      ],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_OUTBOUND',
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

  const res = await invokeRoute(route, {
    body: { runId, nodeId: 'junction-0', checkpointNodeIndex: 1 },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun.phase, 'ENCOUNTER_RESOLUTION');
  assert.equal(res.body.activeRun.checkpointNodeIndex, 1);
  assert.equal(res.body.activeRun.encounter.encounterId, 'contract-pressure');
  assert.equal(res.body.activeRun.encounter.triggeredAtNodeId, 'junction-0');

  const blocked = await invokeRoute(route, {
    body: { runId, nodeId: 'poi-0', checkpointNodeIndex: 2 },
  });
  assert.equal(blocked.statusCode, 409);
});

test('district world GET generates and persists a new world with workshop origin and 6 contracts', async () => {
  const adminDb = createFirestoreHarness();
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('GET', '/api/missions/world');
  assert.ok(route, 'GET /api/missions/world route must be registered');

  const res = await invokeRoute(route);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.world, 'world payload returned');
  assert.equal(typeof res.body.world.worldId, 'string');
  assert.ok(res.body.world.worldId.startsWith('user-1_'));
  assert.equal(typeof res.body.world.boardDateKey, 'string');

  const workshopNodes = res.body.world.nodes.filter((n) => n.kind === 'workshop');
  assert.equal(workshopNodes.length, 1, 'exactly one Workshop origin node');

  assert.equal(res.body.world.contracts.length, 6, 'six daily contract POIs');
  for (const contract of res.body.world.contracts) {
    assert.equal(typeof contract.nodeId, 'string');
    assert.ok(['visible', 'locked'].includes(contract.visibility));
  }

  // Clean separation: no active run yet returns null, world is its own document.
  assert.equal(res.body.activeRun, null);

  const worldWrites = adminDb.writeLog.filter((entry) => entry.path.startsWith('missionWorlds/'));
  assert.equal(worldWrites.length, 1, 'generated world persisted exactly once');
  const runWrites = adminDb.writeLog.filter((entry) => entry.path.startsWith('missionActiveRuns/'));
  assert.equal(runWrites.length, 0, 'no active-run writes on world hydration');
});

test('district world GET hydrates a cached world without regenerating it', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const cachedWorld = {
    worldId,
    boardDateKey,
    dailyResetAt: `${boardDateKey}T23:59:59.000Z`,
    nodes: [
      { id: 'workshop', kind: 'workshop', x: 50, y: 50, label: 'Workshop' },
      { id: 'poi-0', kind: 'poi', x: 60, y: 60, label: 'Cached POI', contractId: 'contract-cached' },
    ],
    edges: [{ from: 'workshop', to: 'poi-0' }],
    contracts: [
      {
        id: 'contract-cached',
        nodeId: 'poi-0',
        definitionId: 'def-cached',
        title: 'Cached Contract',
        tagline: 'Hydrated from cache',
        district: 'The Grid',
        rewardXp: 10,
        rewardOzzies: 20,
        visibility: 'visible',
        status: 'active',
      },
    ],
  };
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: cachedWorld,
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('GET', '/api/missions/world');

  const res = await invokeRoute(route);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.world.worldId, worldId);
  assert.equal(res.body.world.contracts.length, 1);
  assert.equal(res.body.world.contracts[0].id, 'contract-cached');
  assert.equal(res.body.activeRun, null);

  const worldWrites = adminDb.writeLog.filter((entry) => entry.path.startsWith('missionWorlds/'));
  assert.equal(worldWrites.length, 0, 'cached world must not be re-persisted');
});

test('district world GET restores a persisted ActiveDistrictRun alongside the world (refresh-safe)', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const cachedWorld = {
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
        tagline: 'Restore me',
        district: 'The Grid',
        rewardXp: 100,
        rewardOzzies: 80,
        visibility: 'visible',
        status: 'active',
      },
    ],
  };
  const persistedRun = {
    runId,
    uid: 'user-1',
    worldId,
    boardDateKey,
    contractId: 'contract-1',
    deckId: 'deck-1',
    deckName: 'Deck One',
    phase: 'outbound',
    routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
    checkpointNodeIndex: 1,
    launchedAt: `${boardDateKey}T01:00:00.000Z`,
    updatedAt: `${boardDateKey}T01:05:00.000Z`,
  };
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: cachedWorld,
    [`missionActiveRuns/${runId}`]: persistedRun,
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('GET', '/api/missions/world');

  const res = await invokeRoute(route);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.world.worldId, worldId, 'world hydrated from cache');
  assert.ok(res.body.activeRun, 'active run restored');
  assert.equal(res.body.activeRun.runId, runId);
  assert.equal(res.body.activeRun.contractId, 'contract-1');
  // Legacy 'outbound' is normalized to the canonical machine phase on read so
  // refresh restoration slots back into the explicit state machine.
  assert.equal(res.body.activeRun.phase, 'TRAVELING_OUTBOUND');
  assert.equal(res.body.activeRun.checkpointNodeIndex, 1);
  assert.deepEqual(res.body.activeRun.routeNodeIds, ['workshop', 'junction-0', 'poi-0']);

  assert.equal(adminDb.writeLog.length, 0, 'pure read must not mutate world or run documents');
});

test('district world checkpoint route rejects updates from non-travel phases', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: {
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
          title: 'C1',
          tagline: 't',
          district: 'The Grid',
          rewardXp: 10,
          rewardOzzies: 10,
          visibility: 'visible',
          status: 'active',
          encounter: {
            id: 'rival-ambush',
            badge: '!',
            prompt: 'Rival blocks the checkpoint.',
            threat: 'Rival ambush',
            options: [
              { id: 'duck', label: 'Duck', description: 'Duck the ambush.', rewardXpDelta: 6, rewardOzziesDelta: 2 },
            ],
          },
        },
      ],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'AT_POI_FORK',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 2,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:01:00.000Z`,
    },
    'users/user-1/decks/deck-1': buildGridDeck({ id: 'deck-1', challengerCardId: 'grid-runner-1' }),
    'users/user-1/cards/grid-runner-1': {
      ...buildCard({ id: 'grid-runner-1', identity: { name: 'Trace Lead' } }),
      xp: 10,
      ozzies: 5,
    },
    'userProfiles/user-1': { missionXp: 20, missionOzzies: 30 },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/checkpoint');

  // From AT_POI_FORK the only legal next phase is TRAVELING_INBOUND via the
  // POI resolve endpoint — direct checkpoint progression must be refused.
  const res = await invokeRoute(route, {
    body: { runId, nodeId: 'junction-0', checkpointNodeIndex: 1 },
  });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Checkpoint updates are not allowed/);
});

test('district world resolve-poi advances AT_POI_FORK to TRAVELING_INBOUND and records the choice', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: {
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
          tagline: 'Fork route',
          district: 'The Grid',
          rewardXp: 100,
          rewardOzzies: 80,
          visibility: 'visible',
          status: 'active',
          fork: {
            badge: 'Fork',
            prompt: 'Pick a fork.',
            options: [
              { id: 'archive-heist', label: 'Archive Heist', description: 'Pull the archive.', rewardXpDelta: 12, rewardOzziesDelta: 5 },
            ],
          },
        },
      ],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'AT_POI_FORK',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 2,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:01:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/resolve-poi');
  assert.ok(route, 'POST /api/missions/world/resolve-poi route must be registered');

  const res = await invokeRoute(route, {
    body: { runId, choiceId: 'archive-heist', outcome: { tokensEarned: 3 } },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun.phase, 'TRAVELING_INBOUND');
  assert.equal(res.body.activeRun.poiOutcome.choiceId, 'archive-heist');
  assert.equal(res.body.activeRun.poiOutcome.outcome.resultType, 'poi_resolution');
  assert.equal(res.body.activeRun.poiOutcome.outcome.rewardXpDelta, 12);
  assert.equal(res.body.activeRun.missionResults[0].choiceId, 'archive-heist');
});

test('district world resolve-poi rejects calls outside AT_POI_FORK', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_OUTBOUND',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 1,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:01:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/resolve-poi');
  const res = await invokeRoute(route, {
    body: { runId, choiceId: 'archive-heist' },
  });
  assert.equal(res.statusCode, 409);
});

test('district world encounter route brackets travel with start/resolve and survives refresh', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: {
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
          title: 'C1',
          tagline: 't',
          district: 'The Grid',
          rewardXp: 10,
          rewardOzzies: 10,
          visibility: 'visible',
          status: 'active',
          encounter: {
            id: 'rival-ambush',
            badge: '!',
            prompt: 'Rival blocks the checkpoint.',
            threat: 'Rival ambush',
            options: [
              { id: 'duck', label: 'Duck', description: 'Duck the ambush.', rewardXpDelta: 6, rewardOzziesDelta: 2 },
            ],
          },
        },
      ],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_OUTBOUND',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 1,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:01:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const encounterRoute = app.getRoute('POST', '/api/missions/world/encounter');
  assert.ok(encounterRoute, 'POST /api/missions/world/encounter route must be registered');

  const start = await invokeRoute(encounterRoute, {
    body: { runId, action: 'start', encounterId: 'rival-ambush', nodeId: 'junction-0' },
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.activeRun.phase, 'ENCOUNTER_RESOLUTION');
  assert.equal(start.body.activeRun.encounter.encounterId, 'rival-ambush');
  assert.equal(start.body.activeRun.encounter.resumePhase, 'TRAVELING_OUTBOUND');
  assert.equal(start.body.activeRun.encounter.contract.options[0].id, 'duck');

  // Refresh-safe restoration: a fresh GET must return the ENCOUNTER_RESOLUTION phase
  // and the persisted encounter record so the overlay can be re-shown after a reload.
  const worldId2 = `user-1_${boardDateKey}`;
  adminDb.store.set(`missionWorlds/${worldId2}`, {
    worldId: worldId2,
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
        id: 'contract-1', nodeId: 'poi-0', definitionId: 'def-1', title: 'C1',
        tagline: 't', district: 'The Grid', rewardXp: 10, rewardOzzies: 10,
        visibility: 'visible', status: 'active',
      },
    ],
  });
  const getRoute = app.getRoute('GET', '/api/missions/world');
  const refresh = await invokeRoute(getRoute);
  assert.equal(refresh.statusCode, 200);
  assert.equal(refresh.body.activeRun.phase, 'ENCOUNTER_RESOLUTION');
  assert.equal(refresh.body.activeRun.encounter.encounterId, 'rival-ambush');

  const resolve = await invokeRoute(encounterRoute, {
    body: { runId, action: 'resolve', choiceId: 'duck' },
  });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.body.activeRun.phase, 'TRAVELING_OUTBOUND');
  assert.equal(resolve.body.activeRun.encounter.encounterId, 'rival-ambush');
  assert.equal(resolve.body.activeRun.encounter.outcome.resultType, 'travel_encounter');
  assert.equal(resolve.body.activeRun.encounter.outcome.rewardXpDelta, 6);
  assert.equal(resolve.body.activeRun.encounterHistory.length, 1);
});

test('district world inbound travel reaching workshop finalizes rewards exactly once', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_INBOUND',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'junction-0', 'poi-0'],
      checkpointNodeIndex: 1,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:01:00.000Z`,
    },
    [`missionWorlds/${worldId}`]: {
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
      contracts: [{
        id: 'contract-1',
        nodeId: 'poi-0',
        definitionId: 'def-1',
        title: 'Contract One',
        tagline: 'Return route',
        district: 'The Grid',
        rewardXp: 100,
        rewardOzzies: 80,
        visibility: 'visible',
        status: 'active',
      }],
    },
    'users/user-1/decks/deck-1': buildGridDeck({ id: 'deck-1', challengerCardId: 'grid-runner-1' }),
    'users/user-1/cards/grid-runner-1': {
      ...buildCard({ id: 'grid-runner-1', identity: { name: 'Trace Lead' } }),
      xp: 10,
      ozzies: 5,
    },
    'userProfiles/user-1': { missionXp: 20, missionOzzies: 30 },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/checkpoint');

  const res = await invokeRoute(route, {
    body: { runId, nodeId: 'workshop', checkpointNodeIndex: 0 },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun.phase, 'MISSION_COMPLETE');
  assert.equal(res.body.activeRun.checkpointNodeIndex, 0);
  assert.ok(res.body.activeRun.completedAt, 'completedAt timestamp is recorded');
  assert.ok(res.body.activeRun.completionFinalizedAt, 'completion finalization timestamp is recorded');
  assert.equal(res.body.activeRun.debrief.totalRewardXp, 100);
  assert.equal(res.body.activeRun.debrief.totalRewardOzzies, 80);

  const persistedCard = adminDb.store.get('users/user-1/cards/grid-runner-1');
  assert.equal(persistedCard.xp, 110);
  assert.equal(persistedCard.ozzies, 85);
  assert.equal(persistedCard.missionStats.completedRuns, 1);
  assert.equal(persistedCard.missionRunRecords[0].runId, runId);
  assert.equal(persistedCard.missionRunRecords[0].success, true);
  assert.ok(adminDb.store.get(`missionRunArchives/${runId}`), 'completed run is archived');
  assert.equal(adminDb.store.get(`missionWorlds/${worldId}`).contracts[0].status, 'completed');

  const retry = await invokeRoute(route, {
    body: { runId, nodeId: 'workshop', checkpointNodeIndex: 0 },
  });
  assert.equal(retry.statusCode, 200);
  assert.equal(adminDb.store.get('users/user-1/cards/grid-runner-1').xp, 110);
});

test('district world fail route records non-punitive card history without rewards', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: {
      worldId,
      boardDateKey,
      dailyResetAt: `${boardDateKey}T23:59:59.000Z`,
      nodes: [
        { id: 'workshop', kind: 'workshop', x: 10, y: 10, label: 'Workshop' },
        { id: 'poi-0', kind: 'poi', x: 40, y: 10, label: 'Node One', contractId: 'contract-1' },
      ],
      edges: [{ from: 'workshop', to: 'poi-0' }],
      contracts: [{
        id: 'contract-1',
        nodeId: 'poi-0',
        definitionId: 'def-1',
        title: 'Contract One',
        tagline: 'Failed route',
        district: 'The Grid',
        rewardXp: 100,
        rewardOzzies: 80,
        visibility: 'visible',
        status: 'active',
      }],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_OUTBOUND',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'poi-0'],
      checkpointNodeIndex: 0,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:00:00.000Z`,
    },
    'users/user-1/decks/deck-1': buildGridDeck({ id: 'deck-1', challengerCardId: 'grid-runner-1' }),
    'users/user-1/cards/grid-runner-1': {
      ...buildCard({ id: 'grid-runner-1', identity: { name: 'Trace Lead' } }),
      xp: 10,
      ozzies: 5,
    },
    'userProfiles/user-1': { missionXp: 20, missionOzzies: 30 },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/fail');
  assert.ok(route, 'POST /api/missions/world/fail route must be registered');

  const res = await invokeRoute(route, {
    body: { runId, reason: 'Player bailed before return.' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun.phase, 'MISSION_FAILED');
  assert.equal(res.body.activeRun.debrief.success, false);
  assert.equal(res.body.activeRun.debrief.totalRewardXp, 0);
  assert.equal(res.body.activeRun.debrief.totalRewardOzzies, 0);
  const persistedCard = adminDb.store.get('users/user-1/cards/grid-runner-1');
  assert.equal(persistedCard.xp, 10);
  assert.equal(persistedCard.ozzies, 5);
  assert.equal(persistedCard.missionStats, undefined);
  assert.equal(persistedCard.missionRunRecords, undefined);
  assert.equal(persistedCard.missionFailureHistory[0].success, false);
  assert.equal(persistedCard.missionFailureHistory[0].recordType, 'mission_failure');
  const persistedDeck = adminDb.store.get('users/user-1/decks/deck-1');
  assert.equal(persistedDeck.missionRunRecords, undefined);
  assert.equal(persistedDeck.missionFailureHistory[0].runId, runId);
  assert.equal(adminDb.store.get('userProfiles/user-1').missionXp, 20);
  assert.ok(adminDb.store.get(`missionRunArchives/${runId}`), 'failed run is archived');
});

test('district world fail route does not convert completed success into failure history', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'MISSION_COMPLETE',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'poi-0'],
      checkpointNodeIndex: 0,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:10:00.000Z`,
      completedAt: `${boardDateKey}T01:10:00.000Z`,
      completionFinalizedAt: `${boardDateKey}T01:10:00.000Z`,
    },
    [`missionWorlds/${worldId}`]: {
      worldId,
      boardDateKey,
      dailyResetAt: `${boardDateKey}T23:59:59.000Z`,
      nodes: [
        { id: 'workshop', kind: 'workshop', x: 10, y: 10, label: 'Workshop' },
        { id: 'poi-0', kind: 'poi', x: 40, y: 10, label: 'Node One', contractId: 'contract-1' },
      ],
      edges: [{ from: 'workshop', to: 'poi-0' }],
      contracts: [{
        id: 'contract-1',
        nodeId: 'poi-0',
        definitionId: 'def-1',
        title: 'Contract One',
        tagline: 'Completed route',
        district: 'The Grid',
        rewardXp: 100,
        rewardOzzies: 80,
        visibility: 'visible',
        status: 'completed',
      }],
    },
    'users/user-1/decks/deck-1': buildGridDeck({ id: 'deck-1', challengerCardId: 'grid-runner-1' }),
    'users/user-1/cards/grid-runner-1': {
      ...buildCard({ id: 'grid-runner-1', identity: { name: 'Trace Lead' } }),
      xp: 110,
      ozzies: 85,
      missionStats: { completedRuns: 1, missionXp: 100, missionOzzies: 80 },
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/fail');

  const res = await invokeRoute(route, {
    body: { runId, reason: 'Late retry after success.' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun.phase, 'MISSION_COMPLETE');
  const persistedCard = adminDb.store.get('users/user-1/cards/grid-runner-1');
  assert.equal(persistedCard.xp, 110);
  assert.equal(persistedCard.ozzies, 85);
  assert.equal(persistedCard.missionStats.completedRuns, 1);
  assert.equal(persistedCard.missionFailureHistory, undefined);
});

test('district world launch route allows a fresh contract after MISSION_FAILED', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionWorlds/${worldId}`]: {
      worldId,
      boardDateKey,
      dailyResetAt: `${boardDateKey}T23:59:59.000Z`,
      nodes: [
        { id: 'workshop', kind: 'workshop', x: 10, y: 10, label: 'Workshop' },
        { id: 'poi-0', kind: 'poi', x: 40, y: 10, label: 'Node One', contractId: 'contract-1' },
      ],
      edges: [{ from: 'workshop', to: 'poi-0' }],
      contracts: [{
        id: 'contract-1',
        nodeId: 'poi-0',
        definitionId: 'def-1',
        title: 'Contract One',
        tagline: 'Try again',
        district: 'The Grid',
        rewardXp: 100,
        rewardOzzies: 80,
        visibility: 'visible',
        status: 'active',
      }],
    },
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'MISSION_FAILED',
      contractId: 'contract-1',
      deckId: 'deck-1',
      deckName: 'Deck One',
      routeNodeIds: ['workshop', 'poi-0'],
      checkpointNodeIndex: 0,
      launchedAt: `${boardDateKey}T01:00:00.000Z`,
      updatedAt: `${boardDateKey}T01:01:00.000Z`,
      completedAt: `${boardDateKey}T01:01:00.000Z`,
      completionFinalizedAt: `${boardDateKey}T01:01:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/run');

  const res = await invokeRoute(route, {
    body: { contractId: 'contract-1', deckId: 'deck-1', deckName: 'Deck One' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.activeRun.phase, 'TRAVELING_OUTBOUND');
  assert.equal(res.body.activeRun.checkpointNodeIndex, 0);
  assert.equal(res.body.activeRun.completionFinalizedAt, undefined,
    'fresh launch must not inherit the prior terminal finalization stamp');
  const persistedRun = adminDb.store.get(`missionActiveRuns/${runId}`);
  assert.equal(persistedRun.phase, 'TRAVELING_OUTBOUND');
  assert.equal(persistedRun.completionFinalizedAt, undefined);
});

test('district world acknowledge route deletes a finalized terminal run', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'MISSION_COMPLETE',
      contractId: 'contract-1',
      completedAt: `${boardDateKey}T01:10:00.000Z`,
      completionFinalizedAt: `${boardDateKey}T01:10:00.000Z`,
      archivedAt: `${boardDateKey}T01:10:00.000Z`,
    },
    [`missionRunArchives/${runId}`]: {
      runId,
      uid: 'user-1',
      phase: 'MISSION_COMPLETE',
      archivedAt: `${boardDateKey}T01:10:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/acknowledge');
  assert.ok(route, 'POST /api/missions/world/acknowledge route must be registered');

  const res = await invokeRoute(route, { body: { runId } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun, null);
  assert.equal(res.body.acknowledged, true);
  assert.equal(adminDb.store.get(`missionActiveRuns/${runId}`), undefined,
    'active-run document is removed after acknowledge');
  assert.ok(adminDb.store.get(`missionRunArchives/${runId}`),
    'archive copy survives acknowledge');
});

test('district world acknowledge route is idempotent when the run was already dropped', async () => {
  const adminDb = createFirestoreHarness({});
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/acknowledge');

  const res = await invokeRoute(route, { body: { runId: 'missing_run' } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeRun, null);
  assert.equal(res.body.acknowledged, true);
});

test('district world acknowledge route refuses to drop runs that are still mid-flight', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-1_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-1',
      boardDateKey,
      phase: 'TRAVELING_INBOUND',
      contractId: 'contract-1',
      routeNodeIds: ['workshop', 'poi-0'],
      checkpointNodeIndex: 1,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/acknowledge');

  const res = await invokeRoute(route, { body: { runId } });

  assert.equal(res.statusCode, 409);
  assert.ok(adminDb.store.get(`missionActiveRuns/${runId}`),
    'in-flight run is preserved when acknowledge is rejected');
});

test('district world acknowledge route rejects runs owned by another user', async () => {
  const boardDateKey = new Date().toISOString().slice(0, 10);
  const worldId = `user-2_${boardDateKey}`;
  const runId = `${worldId}_run`;
  const adminDb = createFirestoreHarness({
    [`missionActiveRuns/${runId}`]: {
      runId,
      uid: 'user-2',
      boardDateKey,
      phase: 'MISSION_COMPLETE',
      contractId: 'contract-1',
      completionFinalizedAt: `${boardDateKey}T01:10:00.000Z`,
    },
  });
  const app = registerMissionHarness({ adminDb });
  const route = app.getRoute('POST', '/api/missions/world/acknowledge');

  const res = await invokeRoute(route, { body: { runId } });

  assert.equal(res.statusCode, 403);
  assert.ok(adminDb.store.get(`missionActiveRuns/${runId}`),
    'foreign-owned run is not deleted');
});
