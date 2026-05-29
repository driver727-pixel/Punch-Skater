import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHypeRoutes } from '../routes/hype.js';

function createAppHarness() {
  const routes = [];
  const app = { routes };
  app.get = (path, ...handlers) => {
    routes.push({ method: 'GET', path, handlers });
  };
  return app;
}

async function invokeRoute(route) {
  const req = {};
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    ended: false,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(payload) { this.body = payload; this.ended = true; return this; },
  };

  for (let index = 0; index < route.handlers.length && !res.ended;) {
    const handler = route.handlers[index];
    if (handler.length >= 3) {
      let nextCalled = false;
      await handler(req, res, () => { nextCalled = true; });
      if (!nextCalled) break;
      index += 1;
      continue;
    }
    await handler(req, res);
    index += 1;
  }
  return res;
}

function makeDocRef(path, store) {
  return {
    collection(name) {
      return makeCollectionRef(`${path}/${name}`, store);
    },
  };
}

function makeCollectionRef(path, store) {
  function makeQuery(predicate = null) {
    return {
      async get() {
        let docs = Object.entries(store)
          .filter(([k]) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
          .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v }));
        if (predicate) docs = docs.filter(({ data }) => predicate(data()));
        return { docs };
      },
      where(field, _op, value) {
        return makeQuery((d) => (predicate ? predicate(d) : true) && d[field] === value);
      },
    };
  }

  return {
    ...makeQuery(),
    doc(id) {
      return makeDocRef(`${path}/${id}`, store);
    },
  };
}

function makeAdminDb(initialData = {}) {
  const store = { ...initialData };
  return {
    collection(name) {
      return makeCollectionRef(name, store);
    },
  };
}

test('GET /api/hype/crew-faceoff returns cached Cassidy and Garibaldi card decks', async () => {
  const app = createAppHarness();
  const adminDb = makeAdminDb({
    'userProfiles/admin-1': { isAdmin: true },
    'users/admin-1/decks/cassidy': {
      name: "Cassidy's Crew",
      cards: [{ id: 'cassidy-1', identity: { name: 'Cassidy Ace' }, unlockedFrameIds: ['secret'] }],
    },
    'users/admin-1/decks/garibaldi': {
      name: "Garibaldi's Crew",
      cards: [{ id: 'garibaldi-1', identity: { name: 'Garibaldi Bruiser' } }],
    },
  });

  registerHypeRoutes(app, { adminDb });
  const route = app.routes.find((r) => r.method === 'GET' && r.path === '/api/hype/crew-faceoff');

  const first = await invokeRoute(route);
  const second = await invokeRoute(route);

  assert.equal(first.statusCode, 200);
  assert.equal(first.body.crews.cassidy.cards[0].id, 'cassidy-1');
  assert.equal(first.body.crews.cassidy.cards[0].unlockedFrameIds, undefined);
  assert.equal(first.body.crews.garibaldi.cards[0].id, 'garibaldi-1');
  assert.equal(first.body.source, 'live');
  assert.equal(second.body.source, 'cache');
  assert.equal(first.headers['Cache-Control'], 'public, max-age=300, stale-while-revalidate=300');
});
