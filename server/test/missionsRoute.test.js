import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionCardOutcomeUpdate, buildMissionResolutionRisk } from '../routes/missions.js';

function buildCard(overrides = {}) {
  return {
    id: overrides.id ?? 'card-default',
    identity: {
      name: 'Skids Flash',
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
