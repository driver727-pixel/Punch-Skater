import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionCardOutcomeUpdate, buildMissionResolutionRisk, registerMissionRoutes } from '../routes/missions.js';

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

function buildCard(overrides = {}) {
  return {
    id: overrides.id ?? 'card-default',
    identity: {
      name: 'Signal Flash',
      ...overrides.identity,
    },
    maintenance: {
      state: 'active',
      chargePct: 100,
      repairMinutes: 15,
      ...overrides.maintenance,
    },
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
