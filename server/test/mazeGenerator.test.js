import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDistrictWorld } from '../lib/mazeGenerator.js';

const POI_COUNT = 6;

function buildContracts(count = POI_COUNT) {
  return Array.from({ length: count }, (_, i) => ({
    id: `contract-${i}`,
    definitionId: `def-${i}`,
    title: `Contract ${i}`,
    tagline: `Tagline for contract ${i}`,
    district: 'Batteryville',
    rewardXp: 100 + i * 10,
    rewardOzzies: 50 + i * 5,
    status: 'active',
  }));
}

function buildAdjacency(edges) {
  const adj = new Map();
  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from).push(to);
    adj.get(to).push(from);
  }
  return adj;
}

function bfsReachable(adj, start) {
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const nb of (adj.get(current) ?? [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return visited;
}

test('generateDistrictWorld returns a world with the correct structure', () => {
  const contracts = buildContracts();
  const world = generateDistrictWorld('user-abc', '2026-05-26', contracts, '2026-05-27T00:00:00.000Z');

  assert.equal(world.worldId, 'user-abc_2026-05-26');
  assert.equal(world.boardDateKey, '2026-05-26');
  assert.equal(world.dailyResetAt, '2026-05-27T00:00:00.000Z');
  assert.ok(Array.isArray(world.nodes));
  assert.ok(Array.isArray(world.edges));
  assert.ok(Array.isArray(world.contracts));
});

test('generateDistrictWorld includes exactly one Workshop node', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  const workshopNodes = world.nodes.filter((n) => n.kind === 'workshop');
  assert.equal(workshopNodes.length, 1);
  assert.equal(workshopNodes[0].id, 'workshop');
  assert.equal(workshopNodes[0].label, 'Workshop');
});

test('generateDistrictWorld includes exactly 6 POI nodes and 6 contracts', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  const poiNodes = world.nodes.filter((n) => n.kind === 'poi');
  assert.equal(poiNodes.length, POI_COUNT);
  assert.equal(world.contracts.length, POI_COUNT);
});

test('generateDistrictWorld: all POI nodes are reachable from Workshop', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  const adj = buildAdjacency(world.edges);
  const reachable = bfsReachable(adj, 'workshop');
  const poiNodes = world.nodes.filter((n) => n.kind === 'poi');
  for (const poi of poiNodes) {
    assert.ok(reachable.has(poi.id), `POI ${poi.id} is not reachable from Workshop`);
  }
});

test('generateDistrictWorld: the graph is connected (all nodes reachable from Workshop)', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  const adj = buildAdjacency(world.edges);
  const reachable = bfsReachable(adj, 'workshop');
  for (const node of world.nodes) {
    assert.ok(reachable.has(node.id), `Node ${node.id} (${node.kind}) is not reachable from Workshop`);
  }
});

test('generateDistrictWorld: contracts have 4 visible and 2 locked', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  const visible = world.contracts.filter((c) => c.visibility === 'visible');
  const locked = world.contracts.filter((c) => c.visibility === 'locked');
  assert.equal(visible.length, 4);
  assert.equal(locked.length, 2);
});

test('generateDistrictWorld: locked contracts have a lockHint', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  for (const contract of world.contracts.filter((c) => c.visibility === 'locked')) {
    assert.ok(typeof contract.lockHint === 'string' && contract.lockHint.length > 0,
      `Locked contract ${contract.id} is missing lockHint`);
  }
});

test('generateDistrictWorld is deterministic for the same uid and dateKey', () => {
  const contracts = buildContracts();
  const resetAt = '2026-05-27T00:00:00.000Z';
  const w1 = generateDistrictWorld('user-xyz', '2026-05-26', contracts, resetAt);
  const w2 = generateDistrictWorld('user-xyz', '2026-05-26', contracts, resetAt);
  assert.deepEqual(w1, w2);
});

test('generateDistrictWorld produces different worlds for different users on the same day', () => {
  const contracts = buildContracts();
  const resetAt = '2026-05-27T00:00:00.000Z';
  const w1 = generateDistrictWorld('user-aaa', '2026-05-26', contracts, resetAt);
  const w2 = generateDistrictWorld('user-bbb', '2026-05-26', contracts, resetAt);
  // Different worldIds at minimum
  assert.notEqual(w1.worldId, w2.worldId);
  // Node positions should differ for different seeds
  const w1Nodes = JSON.stringify(w1.nodes);
  const w2Nodes = JSON.stringify(w2.nodes);
  assert.notEqual(w1Nodes, w2Nodes);
});

test('generateDistrictWorld produces different worlds for the same user on different days', () => {
  const contracts = buildContracts();
  const w1 = generateDistrictWorld('user-abc', '2026-05-25', contracts, '2026-05-26T00:00:00.000Z');
  const w2 = generateDistrictWorld('user-abc', '2026-05-26', contracts, '2026-05-27T00:00:00.000Z');
  assert.notEqual(w1.worldId, w2.worldId);
  const w1Nodes = JSON.stringify(w1.nodes);
  const w2Nodes = JSON.stringify(w2.nodes);
  assert.notEqual(w1Nodes, w2Nodes);
});

test('generateDistrictWorld throws when not given exactly 6 contracts', () => {
  assert.throws(
    () => generateDistrictWorld('user-abc', '2026-05-26', buildContracts(5), '2026-05-27T00:00:00.000Z'),
    /exactly 6 contracts/,
  );
  assert.throws(
    () => generateDistrictWorld('user-abc', '2026-05-26', buildContracts(7), '2026-05-27T00:00:00.000Z'),
    /exactly 6 contracts/,
  );
});

test('generateDistrictWorld: every contract is referenced by exactly one POI node', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  for (const contract of world.contracts) {
    const poiNode = world.nodes.find((n) => n.kind === 'poi' && n.contractId === contract.id);
    assert.ok(poiNode, `Contract ${contract.id} has no corresponding POI node`);
    assert.equal(contract.nodeId, poiNode.id);
  }
});

test('generateDistrictWorld: all node coordinates are within [0, 100]', () => {
  const world = generateDistrictWorld('user-abc', '2026-05-26', buildContracts(), '2026-05-27T00:00:00.000Z');
  for (const node of world.nodes) {
    assert.ok(node.x >= 0 && node.x <= 100, `Node ${node.id} x=${node.x} out of range`);
    assert.ok(node.y >= 0 && node.y <= 100, `Node ${node.id} y=${node.y} out of range`);
  }
});
