import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_STYLE_CARD_COUNT,
  assertCollectionStyleSourceVariety,
  buildCollectionStyleCards,
  buildTrainingDatasetZip,
  extractFalLoraUrl,
  normalizeCollectionStyleSourceIds,
} from '../lib/collectionStyle.js';
import { registerCollectionStyleRoutes } from '../routes/collectionStyle.js';

function createSnapshot(ref, value) {
  return {
    id: ref.id,
    ref,
    exists: value !== undefined,
    data() {
      return value === undefined ? undefined : structuredClone(value);
    },
  };
}

function createFakeDb() {
  const store = new Map();

  class FakeDocRef {
    constructor(path) {
      this.path = path;
      this.id = path.split('/').at(-1);
    }

    collection(name) {
      return new FakeCollectionRef(`${this.path}/${name}`);
    }

    async get() {
      return createSnapshot(this, store.get(this.path));
    }

    set(value, options = {}) {
      const current = store.get(this.path) ?? {};
      store.set(this.path, options.merge
        ? { ...current, ...structuredClone(value) }
        : structuredClone(value));
    }
  }

  class FakeCollectionRef {
    constructor(path) {
      this.path = path;
    }

    doc(id) {
      return new FakeDocRef(`${this.path}/${id}`);
    }

    async get() {
      const depth = this.path.split('/').length + 1;
      return {
        docs: [...store.keys()]
          .filter((path) => path.startsWith(`${this.path}/`) && path.split('/').length === depth)
          .sort()
          .map((path) => {
            const ref = new FakeDocRef(path);
            return createSnapshot(ref, store.get(path));
          }),
      };
    }
  }

  return {
    collection(name) {
      return new FakeCollectionRef(name);
    },
    batch() {
      const writes = [];
      return {
        set(ref, value, options) {
          writes.push({ ref, value, options });
          return this;
        },
        async commit() {
          for (const write of writes) write.ref.set(write.value, write.options);
        },
      };
    },
    async runTransaction(callback) {
      const transaction = {
        get(ref) {
          return ref.get();
        },
        set(ref, value, options) {
          ref.set(value, options);
        },
      };
      return callback(transaction);
    },
    read(path) {
      const value = store.get(path);
      return value === undefined ? undefined : structuredClone(value);
    },
    write(path, value) {
      store.set(path, structuredClone(value));
    },
    list(path) {
      return [...store.entries()]
        .filter(([entryPath]) => entryPath.startsWith(`${path}/`))
        .map(([entryPath, value]) => ({ path: entryPath, value: structuredClone(value) }));
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

function createResponse() {
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

async function invoke(app, route, req = {}) {
  const handlers = app.routes.get(route);
  assert.ok(handlers, `Missing ${route}`);
  const response = createResponse();
  let index = 0;
  const next = async () => {
    const handler = handlers[index];
    index += 1;
    if (handler) await handler(req, response, next);
  };
  await next();
  return response;
}

test('collection-style card plans use 64 unique lore names and static support layers', () => {
  const cards = buildCollectionStyleCards({
    batchId: 'collection-batch-test',
    profileVersion: 'style-v1',
    createdAt: '2026-08-23T00:00:00.000Z',
  });

  assert.equal(cards.length, COLLECTION_STYLE_CARD_COUNT);
  assert.equal(new Set(cards.map((card) => card.identity.name)).size, COLLECTION_STYLE_CARD_COUNT);
  assert.ok(cards.every((card) => card.backgroundImageUrl.startsWith('/assets/backgrounds/')));
  assert.ok(cards.every((card) => card.frameImageUrl.startsWith('/assets/frames/')));
  assert.ok(cards.every((card) => card.board.imageUrl.startsWith('/assets/boards/approved/')));
  assert.ok(cards.every((card) => card.weaponImageUrl.startsWith('/assets/weapons/')));
  assert.ok(cards.every((card) => card.characterImageUrl === undefined));
  assert.ok(cards.every((card) => card.collectionStyle.profileVersion === 'style-v1'));
});

test('collection-style curation requires enough unique sources and varied attributes', () => {
  assert.throws(
    () => normalizeCollectionStyleSourceIds(['one', 'two']),
    /Choose 12-64 unique character-layer Boss Assets/,
  );

  const variedCards = Array.from({ length: 12 }, (_, index) => ({
    prompts: {
      archetype: `archetype-${index % 3}`,
      district: `district-${index % 3}`,
      style: `style-${index % 3}`,
    },
  }));
  assert.doesNotThrow(() => assertCollectionStyleSourceVariety(variedCards));

  assert.throws(
    () => assertCollectionStyleSourceVariety(variedCards.map((card) => ({
      prompts: { ...card.prompts, style: 'single-style' },
    }))),
    /at least three archetypes, districts, and styles/,
  );
});

test('training dataset ZIP contains paired image and caption entries', () => {
  const archive = buildTrainingDatasetZip([
    { name: '001-source.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    { name: '001-source.txt', data: Buffer.from('punchskater_style, adult courier') },
  ], new Date('2026-08-23T00:00:00.000Z'));

  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
  assert.ok(archive.includes(Buffer.from('001-source.png')));
  assert.ok(archive.includes(Buffer.from('001-source.txt')));
});

test('completed training extracts only an approved Fal LoRA URL', () => {
  assert.equal(
    extractFalLoraUrl({ data: { diffusers_lora_file: { url: 'https://v3b.fal.media/files/style.safetensors' } } }),
    'https://v3b.fal.media/files/style.safetensors',
  );
  assert.equal(
    extractFalLoraUrl({ data: { lora_url: 'https://untrusted.example/style.safetensors' } }),
    null,
  );
});

test('training only packages selected character layers and stores the completed profile server-side', async () => {
  const app = createFakeApp();
  const adminDb = createFakeDb();
  const savedDatasets = [];
  let uuidCounter = 0;
  const randomUUID = () => `collection-training-${++uuidCounter}`;
  const sourceIds = Array.from({ length: 12 }, (_, index) => `source-card-${index}`);
  for (const [index, id] of sourceIds.entries()) {
    adminDb.write(`adminBossAssets/${id}`, {
      id,
      characterImageUrl: `https://v3b.fal.media/files/${id}.png`,
      prompts: {
        archetype: `archetype-${index % 3}`,
        district: `district-${index % 3}`,
        style: `style-${index % 3}`,
        gender: 'Adult',
      },
    });
  }

  let submittedInput = null;
  registerCollectionStyleRoutes(app, {
    adminDb,
    adminStorage: {
      bucket() {
        return {
          file(path) {
            return {
              async save(data, options) {
                savedDatasets.push({ path, data, options });
              },
            };
          },
        };
      },
    },
    storageBucket: 'test-bucket',
    FAL_KEY: 'test-key',
    fal: {
      queue: {
        async submit(_model, request) {
          submittedInput = request.input;
          return { request_id: 'fal-training-request' };
        },
        async status() {
          return { status: 'COMPLETED' };
        },
        async result() {
          return {
            data: {
              version: 'style-v1',
              diffusers_lora_file: { url: 'https://v3b.fal.media/files/style-v1.safetensors' },
            },
          };
        },
      },
    },
    authenticateAdminRequest: async () => ({ uid: 'admin-user' }),
    resolveFalProfile: () => ({ modelUrl: 'https://fal.run/test-character' }),
    buildFalImageRequest: async (body) => body,
    randomUUID,
    now: () => Date.parse('2026-08-23T00:00:00.000Z'),
    fetchImpl: async () => ({
      ok: true,
      headers: { get: (name) => (name === 'content-type' ? 'image/png' : null) },
      arrayBuffer: async () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer,
    }),
  });

  const started = await invoke(app, 'POST /api/admin/collection-style/training', {
    body: {
      sourceCardIds: sourceIds,
      triggerToken: 'punchskater_collection_style',
      ownershipConfirmed: true,
      characterLayersConfirmed: true,
    },
  });
  assert.equal(started.statusCode, 202);
  assert.equal(submittedInput.is_style, true);
  assert.equal(submittedInput.trigger_word, 'punchskater_collection_style');
  assert.equal(savedDatasets.length, 1);
  assert.ok(savedDatasets[0].data.includes(Buffer.from('001-source-card-0.png')));
  assert.ok(savedDatasets[0].data.includes(Buffer.from('001-source-card-0.txt')));

  const completed = await invoke(app, 'GET /api/admin/collection-style/training/:jobId', {
    params: { jobId: started.body.jobId },
  });
  assert.equal(completed.statusCode, 200);
  assert.equal(completed.body.profile.loraUrl, 'https://v3b.fal.media/files/style-v1.safetensors');
  assert.equal(
    adminDb.read('adminCollectionStyleProfiles/collection-style').triggerToken,
    'punchskater_collection_style',
  );
});

test('batch generation gates production on approval and recovers persisted Boss Assets', async () => {
  const app = createFakeApp();
  const adminDb = createFakeDb();
  let uuidCounter = 0;
  const randomUUID = () => `collection-batch-${++uuidCounter}`;
  let now = Date.parse('2026-08-23T00:00:00.000Z');
  const nextNow = () => {
    now += 1_000;
    return now;
  };
  let generationCalls = 0;
  const persistedStoragePaths = [];

  adminDb.write('adminCollectionStyleProfiles/collection-style', {
    id: 'collection-style',
    status: 'ready',
    version: 'style-v1',
    loraUrl: 'https://v3b.fal.media/files/style.safetensors',
    loraScale: 0.9,
    triggerToken: 'punchskater_collection_style',
    modelUrl: 'https://fal.run/test-character',
  });

  registerCollectionStyleRoutes(app, {
    adminDb,
    adminStorage: {},
    storageBucket: 'test-bucket',
    FAL_KEY: 'test-key',
    fal: { queue: {} },
    authenticateAdminRequest: async () => ({ uid: 'admin-user' }),
    resolveFalProfile: () => ({ modelUrl: 'https://fal.run/test-character' }),
    buildFalImageRequest: async (body) => body,
    randomUUID,
    now: nextNow,
    persistImageToStorage: async (_storage, _sourceUrl, _bucket, storagePath) => {
      persistedStoragePaths.push(storagePath);
      return 'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/character.png?token=stable';
    },
    fetchImpl: async (url) => {
      generationCalls += 1;
      if (url === 'https://fal.run/test-character') {
        return {
          ok: true,
          json: async () => ({ images: [{ url: 'https://v3b.fal.media/files/raw.png' }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({ image: { url: 'https://v3b.fal.media/files/transparent.png' } }),
      };
    },
  });

  const create = await invoke(app, 'POST /api/admin/collection-style/batches', { body: {} });
  assert.equal(create.statusCode, 201);
  const batchId = create.body.batch.id;
  assert.equal(create.body.batch.totalCards, 64);
  assert.equal(adminDb.list(`adminCollectionStyleBatches/${batchId}/cards`).length, 64);

  const firstGeneration = await invoke(
    app,
    'POST /api/admin/collection-style/batches/:batchId/generate-next',
    { body: {}, params: { batchId } },
  );
  assert.equal(firstGeneration.statusCode, 200);
  assert.equal(firstGeneration.body.status, 'completed');
  const firstCardId = firstGeneration.body.item.resultCardId;
  assert.ok(adminDb.read(`adminBossAssets/${firstCardId}`).characterImageUrl);
  assert.deepEqual(
    persistedStoragePaths[0],
    `generatedImages/collection-style/${batchId}/${firstCardId}.png`,
  );

  const callsBeforeRecovery = generationCalls;
  const firstItemPath = `adminCollectionStyleBatches/${batchId}/cards/${firstCardId}`;
  adminDb.write(firstItemPath, {
    ...adminDb.read(firstItemPath),
    status: 'pending',
  });
  const recovered = await invoke(
    app,
    'POST /api/admin/collection-style/batches/:batchId/generate-next',
    { body: {}, params: { batchId } },
  );
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.body.recovered, true);
  assert.equal(generationCalls, callsBeforeRecovery);

  const earlyApproval = await invoke(
    app,
    'POST /api/admin/collection-style/batches/:batchId/approve',
    { body: {}, params: { batchId } },
  );
  assert.equal(earlyApproval.statusCode, 409);

  for (let index = 0; index < 3; index += 1) {
    const generated = await invoke(
      app,
      'POST /api/admin/collection-style/batches/:batchId/generate-next',
      { body: {}, params: { batchId } },
    );
    assert.equal(generated.statusCode, 200);
  }

  const approval = await invoke(
    app,
    'POST /api/admin/collection-style/batches/:batchId/approve',
    { body: {}, params: { batchId } },
  );
  assert.equal(approval.statusCode, 200);
  assert.equal(approval.body.batch.phase, 'production');

  const production = await invoke(
    app,
    'POST /api/admin/collection-style/batches/:batchId/generate-next',
    { body: {}, params: { batchId } },
  );
  assert.equal(production.statusCode, 200);
  assert.equal(production.body.status, 'completed');
});
