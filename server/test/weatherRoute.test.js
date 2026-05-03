import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackDistrictWeatherPayload,
  buildWeatherAccessRule,
  createDistrictWeatherService,
  registerWeatherRoutes,
  resolveWeatherSummary,
} from '../routes/weather.js';

function createAppHarness() {
  const routes = [];
  return {
    routes,
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
  };
}

async function invokeRoute(route) {
  const req = {};
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

test('resolveWeatherSummary prioritizes rain hazards before wind and heat', () => {
  assert.equal(resolveWeatherSummary({ rainMm: 7, weatherCode: 0, windSpeedKph: 0, temperatureC: 0 }), 'Heavy rain');
  assert.equal(resolveWeatherSummary({ rainMm: 0, weatherCode: 95, windSpeedKph: 0, temperatureC: 0 }), 'Heavy rain');
  assert.equal(resolveWeatherSummary({ rainMm: 0.2, weatherCode: 0, windSpeedKph: 60, temperatureC: 40 }), 'Rain');
  assert.equal(resolveWeatherSummary({ rainMm: 0, weatherCode: 0, windSpeedKph: 45, temperatureC: 40 }), 'Strong wind');
  assert.equal(resolveWeatherSummary({ rainMm: 0, weatherCode: 0, windSpeedKph: 10, temperatureC: 35 }), 'Heatwave');
  assert.equal(resolveWeatherSummary({ rainMm: null, weatherCode: null, windSpeedKph: null, temperatureC: null }), 'Clear');
});

test('buildWeatherAccessRule only restricts districts during heavy rain', () => {
  assert.equal(buildWeatherAccessRule('The Grid', 'Canberra', 'Rain'), null);
  assert.deepEqual(
    buildWeatherAccessRule('The Forest', 'Hobart', 'Heavy rain'),
    {
      requiredBoardType: 'Mountain',
      reason: 'Heavy rain over Hobart has turned The Forest into Mountain-board-only territory.',
      source: 'heavy-rain',
    },
  );
});

test('buildFallbackDistrictWeatherPayload returns offline entries for every district', () => {
  const payload = buildFallbackDistrictWeatherPayload();
  assert.equal(payload.stale, true);
  assert.equal(payload.source, 'fallback');
  assert.equal(payload.districts.length, 8);
  assert.equal(payload.districts.every((district) => district.summary === 'Weather uplink offline'), true);
  assert.equal(payload.districts.every((district) => district.accessRule === null), true);
});

test('registerWeatherRoutes serves district weather through rate limit middleware', async () => {
  const app = createAppHarness();
  let rateLimitCalls = 0;
  const expectedPayload = {
    generatedAt: '2026-04-28T00:00:00.000Z',
    stale: false,
    source: 'test',
    districts: [],
  };

  registerWeatherRoutes(app, {
    weatherRateLimit: (_req, _res, next) => {
      rateLimitCalls += 1;
      next();
    },
    districtWeatherService: {
      getDistrictWeatherPayload: async () => expectedPayload,
    },
  });

  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].path, '/api/district-weather');

  const res = await invokeRoute(app.routes[0]);
  assert.equal(rateLimitCalls, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, expectedPayload);
});

test('createDistrictWeatherService deduplicates concurrent cache-miss requests to a single upstream fetch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  let resolveUpstream;
  globalThis.fetch = async () => {
    fetchCallCount += 1;
    await new Promise((resolve) => {
      resolveUpstream = resolve;
    });
    return {
      ok: true,
      status: 200,
      json: async () =>
        Array.from({ length: 8 }, () => ({
          current: { temperature_2m: 20, wind_speed_10m: 5, rain: 0, weather_code: 0 },
        })),
    };
  };

  try {
    const service = createDistrictWeatherService();
    const [p1, p2, p3] = [
      service.getDistrictWeatherPayload(),
      service.getDistrictWeatherPayload(),
      service.getDistrictWeatherPayload(),
    ];
    resolveUpstream();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    assert.equal(fetchCallCount, 1, 'Only one upstream fetch should be made for concurrent cache-miss requests');
    assert.equal(r1.source, 'live');
    assert.deepEqual(r2.districts, r1.districts);
    assert.deepEqual(r3.districts, r1.districts);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createDistrictWeatherService fetches live weather and reuses fresh cache', async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url) => {
    fetchCalls.push(url.toString());
    return {
      ok: true,
      status: 200,
      json: async () =>
        Array.from({ length: 8 }, () => ({
          current: {
            temperature_2m: 24.44,
            wind_speed_10m: 12.34,
            rain: 0,
            weather_code: 0,
          },
        })),
    };
  };

  try {
    const service = createDistrictWeatherService();
    const first = await service.getDistrictWeatherPayload();
    const second = await service.getDistrictWeatherPayload();

    assert.equal(fetchCalls.length, 1);
    assert.equal(first.source, 'live');
    assert.equal(first.stale, false);
    assert.equal(first.districts.length, 8);
    assert.equal(first.districts.every((district) => district.summary === 'Clear'), true);
    assert.equal(first.districts[0].temperatureC, 24.4);
    assert.equal(first.districts[0].windSpeedKph, 12.3);
    assert.equal(second.source, 'cache');
    assert.equal(second.stale, false);
    assert.deepEqual(second.districts, first.districts);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createDistrictWeatherService deduplicates concurrent cache-miss requests into a single upstream fetch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  let resolveFetch;
  const fetchBlock = new Promise((resolve) => { resolveFetch = resolve; });

  globalThis.fetch = async () => {
    fetchCallCount += 1;
    await fetchBlock;
    return {
      ok: true,
      status: 200,
      json: async () =>
        Array.from({ length: 8 }, () => ({
          current: { temperature_2m: 20, wind_speed_10m: 10, rain: 0, weather_code: 0 },
        })),
    };
  };

  try {
    const service = createDistrictWeatherService();
    const p1 = service.getDistrictWeatherPayload();
    resolveFetch();
    const p2 = service.getDistrictWeatherPayload();
    const [first, second] = await Promise.all([p1, p2]);

    assert.equal(fetchCallCount, 1, 'upstream fetch should be called exactly once');
    assert.equal(first.source, 'live');
    assert.equal(second.source, 'live');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createDistrictWeatherService returns partial-live payload when one batch entry has no current data', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async () => {
    // Return an array where Electropolis (index 1) has a missing current block.
    return {
      ok: true,
      status: 200,
      json: async () =>
        Array.from({ length: 8 }, (_, i) => ({
          current:
            i === 1
              ? null
              : {
                  temperature_2m: 18,
                  wind_speed_10m: 8,
                  rain: 8,
                  weather_code: 63,
                },
        })),
    };
  };
  console.error = () => {};

  try {
    const service = createDistrictWeatherService();
    const payload = await service.getDistrictWeatherPayload();

    assert.equal(payload.source, 'partial-live');
    assert.equal(payload.stale, true);
    assert.equal(payload.districts.length, 8);
    assert.equal(payload.districts.find((district) => district.district === 'Electropolis').source, 'fallback');
    assert.equal(payload.districts.find((district) => district.district === 'Airaway').summary, 'Heavy rain');
    assert.deepEqual(payload.districts.find((district) => district.district === 'Airaway').accessRule, {
      requiredBoardType: 'Mountain',
      reason: 'Heavy rain over Brisbane has turned Airaway into Mountain-board-only territory.',
      source: 'heavy-rain',
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
