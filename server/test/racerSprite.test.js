import test from 'node:test';
import assert from 'node:assert/strict';
import { registerImageRoutes } from '../routes/images.js';

function createAppHarness() {
  const routes = [];
  const app = { routes, use() {} };
  for (const method of ['get', 'post', 'put', 'delete']) {
    app[method] = (path, ...handlers) => {
      routes.push({ method: method.toUpperCase(), path, handlers });
    };
  }
  app.getRoute = (method, path) => routes.find((r) => r.method === method && r.path === path) || null;
  return app;
}

async function invokeRoute(route, { params = {}, body = {} } = {}) {
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.ended = true; return this; },
  };
  const req = { params, body };
  for (const handler of route.handlers) {
    await handler(req, res);
    if (res.ended) break;
  }
  return res;
}

function baseDeps(overrides = {}) {
  return {
    fal: {
      queue: {
        submit: async () => ({ request_id: 'job-123' }),
        status: async () => ({ status: 'IN_PROGRESS' }),
        result: async () => ({ images: [{ url: 'https://v3.fal.media/sheet.png' }] }),
      },
    },
    FAL_KEY: 'test-key',
    BIREFNET_URL: 'https://fal.run/fal-ai/birefnet',
    imageRateLimit: (_req, _res, next) => next && next(),
    boardImageStatusRateLimit: (_req, _res, next) => next && next(),
    authenticateFirebaseUser: async () => ({ uid: 'admin-1' }),
    sanitizeGenerateImageBody: (b) => b,
    sanitizeBoardImageBody: (b) => b,
    sanitizeBackgroundRemovalBody: (b) => b,
    sanitizeRacerSpriteBody: (b) => ({
      prompt: b.prompt,
      imageUrl: b.imageUrl,
      imageSize: b.imageSize,
    }),
    buildFalImageRequest: async (b) => b,
    normalizeFalProfile: (p) => p,
    resolveFalProfile: () => ({ modelUrl: 'https://fal.run/test', configUrl: '', defaultLoras: [] }),
    boardImageJobs: new Map(),
    pruneBoardImageJobs: () => {},
    racerSpriteJobs: new Map(),
    pruneRacerSpriteJobs: () => {},
    adminStorage: null,
    storageBucket: '',
    ...overrides,
  };
}

test('POST /api/generate-racer-sprite submits a nano-banana-2 job and tracks the owner', async () => {
  const app = createAppHarness();
  const racerSpriteJobs = new Map();
  let submitInput = null;
  const deps = baseDeps({
    racerSpriteJobs,
    fal: {
      queue: {
        submit: async (_model, { input }) => { submitInput = input; return { request_id: 'job-123' }; },
        status: async () => ({ status: 'IN_PROGRESS' }),
        result: async () => ({}),
      },
    },
  });
  registerImageRoutes(app, deps);

  const route = app.getRoute('POST', '/api/generate-racer-sprite');
  assert.ok(route, 'route should be registered');

  const res = await invokeRoute(route, {
    body: {
      prompt: 'sprite sheet prompt',
      imageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/char.png',
      imageSize: { width: 1024, height: 512 },
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.jobId, 'job-123');
  assert.deepEqual(submitInput.image_urls, [
    'https://firebasestorage.googleapis.com/v0/b/app/o/char.png',
  ]);
  assert.deepEqual(submitInput.image_size, { width: 1024, height: 512 });
  assert.equal(racerSpriteJobs.get('job-123').uid, 'admin-1');
});

test('GET /api/racer-sprite-status returns 404 when the caller does not own the job', async () => {
  const app = createAppHarness();
  const racerSpriteJobs = new Map([['job-123', { uid: 'someone-else', createdAt: Date.now() }]]);
  registerImageRoutes(app, baseDeps({ racerSpriteJobs }));

  const route = app.getRoute('GET', '/api/racer-sprite-status/:jobId');
  const res = await invokeRoute(route, { params: { jobId: 'job-123' } });

  assert.equal(res.statusCode, 404);
});

test('GET /api/racer-sprite-status reports completion with the persisted sheet URL', async () => {
  const app = createAppHarness();
  const racerSpriteJobs = new Map([['job-123', { uid: 'admin-1', createdAt: Date.now() }]]);
  const deps = baseDeps({
    racerSpriteJobs,
    fal: {
      queue: {
        submit: async () => ({ request_id: 'job-123' }),
        status: async () => ({ status: 'COMPLETED' }),
        result: async () => ({ images: [{ url: 'https://v3.fal.media/sheet.png' }] }),
      },
    },
  });
  registerImageRoutes(app, deps);

  const route = app.getRoute('GET', '/api/racer-sprite-status/:jobId');
  const res = await invokeRoute(route, { params: { jobId: 'job-123' } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'completed');
  // With no adminStorage the original fal URL is passed through unchanged.
  assert.equal(res.body.imageUrl, 'https://v3.fal.media/sheet.png');
  assert.equal(racerSpriteJobs.has('job-123'), false, 'completed job should be cleared');
});

test('GET /api/racer-sprite-status rejects malformed job ids', async () => {
  const app = createAppHarness();
  registerImageRoutes(app, baseDeps());

  const route = app.getRoute('GET', '/api/racer-sprite-status/:jobId');
  const res = await invokeRoute(route, { params: { jobId: 'bad id!' } });

  assert.equal(res.statusCode, 400);
});
