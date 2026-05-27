import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCraftlinguaExploreUrl,
  createCraftlinguaService,
  getCraftlinguaDistrictLanguage,
  getCraftlinguaDistrictLanguageByShareCode,
  translateCraftlinguaText,
} from '../lib/craftlingua.js';
import { registerCraftlinguaRoutes } from '../routes/craftlingua.js';

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

async function invokeRoute(route, req = {}) {
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

test('buildCraftlinguaExploreUrl builds partner deep links from share codes', () => {
  assert.equal(
    buildCraftlinguaExploreUrl('CL-GRID-MESH'),
    'https://craftlingua.app/share/CL-GRID-MESH',
  );
});

test('district lookup resolves by district name, slug, and share code', () => {
  assert.equal(getCraftlinguaDistrictLanguage('The Grid')?.language.name, 'Cipher Mesh');
  assert.equal(getCraftlinguaDistrictLanguage('the-grid')?.shareCode, 'CL-GRID-MESH');
  assert.equal(getCraftlinguaDistrictLanguageByShareCode('cl-grid-mesh')?.district, 'The Grid');
});

test('translateCraftlinguaText prefers exact phrasebook matches', () => {
  const grid = getCraftlinguaDistrictLanguage('The Grid');
  assert.equal(
    translateCraftlinguaText('thumb drive', grid),
    'ghost key',
  );
});

test('createCraftlinguaService returns cached public district summaries and translations', () => {
  const service = createCraftlinguaService();
  const districts = service.getDistricts();
  assert.equal(districts.length, 6);
  assert.equal(districts.every((entry) => !('vocabulary' in entry)), true);

  const translated = service.translate({ district: 'Nightshade', text: 'thumb drive' });
  assert.deepEqual(translated, {
    shareCode: 'CL-NIGHTSHADE-MURK',
    district: 'Nightshade',
    language: { name: 'Murk Argot', code: 'MURK' },
    exploreUrl: 'https://craftlingua.app/share/CL-NIGHTSHADE-MURK',
    translatedText: 'tag shard',
  });
});

test('registerCraftlinguaRoutes serves districts, share-code validation, and translation routes', async () => {
  const app = createAppHarness();
  let rateLimitCalls = 0;
  registerCraftlinguaRoutes(app, {
    craftlinguaRateLimit: (_req, _res, next) => {
      rateLimitCalls += 1;
      next();
    },
  });

  const listRoute = app.routes.find((route) => route.path === '/api/craftlingua/districts');
  const shareRoute = app.routes.find((route) => route.path === '/api/craftlingua/resolve-share-code');
  const translateRoute = app.routes.find((route) => route.path === '/api/craftlingua/translate');

  const listRes = await invokeRoute(listRoute, {});
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.districts.length, 6);

  const shareRes = await invokeRoute(shareRoute, { body: { shareCode: 'CL-FOREST-CANOPY' } });
  assert.equal(shareRes.statusCode, 200);
  assert.equal(shareRes.body.district.language.name, 'Canopy Tongue');

  const translateRes = await invokeRoute(translateRoute, {
    body: { district: 'The Grid', text: 'thumb drive' },
  });
  assert.equal(translateRes.statusCode, 200);
  assert.equal(translateRes.body.translatedText, 'ghost key');
  assert.equal(rateLimitCalls, 3);
});
