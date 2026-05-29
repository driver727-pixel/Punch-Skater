/**
 * mazeGenerator.js
 *
 * Generates a deterministic per-user/per-day district world graph consisting of:
 *   - One Workshop node (run origin, always reachable)
 *   - 6 POI contract nodes (daily contracts, placed at dead ends / intersections)
 *   - Junction nodes (path intersections with no contract)
 *   - Edges connecting all nodes into a single connected graph
 *
 * All POIs are guaranteed reachable from the Workshop via the edge set.
 * The same uid + boardDateKey always produces the same world.
 */

import { DAILY_MISSION_BOARD_COUNT } from './missions.js';

// ── PRNG (Mulberry32, matching src/lib/prng.ts) ──────────────────────────────

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function createRng(seed) {
  const next = mulberry32(seedFromString(seed));
  return {
    next,
    /** float in [0, 1) */
    float: () => next(),
    /** integer in [min, max] inclusive */
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    /** shuffle array in-place (Fisher-Yates) */
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    /** pick one item */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// ── Static map track constants ────────────────────────────────────────────────

const STATIC_MAP_IMAGE = '/game-map-best-big.jpg';
const WORLD_SEED_VERSION = 'district-world-static-map-v1';
const SEED_STRATEGY = 'uid|boardDateKey|purpose';
const PLACEMENT_PREFERENCE = ['intersection', 'corridor', 'dead_end'];
const STATIC_MAP_GRAPH = {
  algorithm: 'static-game-map-road-track',
  grid: { cols: 100, rows: 100 },
  loopEdgeRatio: 0,
  workshopNodeId: 'workshop',
  poiCount: DAILY_MISSION_BOARD_COUNT,
  placementPreference: PLACEMENT_PREFERENCE,
  reachableFromWorkshop: true,
  backdropUrl: STATIC_MAP_IMAGE,
};

const STATIC_TRACK_NODES = [
  { id: 'workshop', kind: 'workshop', x: 56, y: 29, label: 'Workshop', placementRole: 'workshop' },
  { id: 'poi-0', kind: 'poi', x: 24, y: 39, placementRole: 'intersection' },
  { id: 'poi-1', kind: 'poi', x: 78, y: 30, placementRole: 'intersection' },
  { id: 'poi-2', kind: 'poi', x: 35, y: 56, placementRole: 'intersection' },
  { id: 'poi-3', kind: 'poi', x: 73, y: 54, placementRole: 'intersection' },
  { id: 'poi-4', kind: 'poi', x: 43, y: 74, placementRole: 'corridor' },
  { id: 'poi-5', kind: 'poi', x: 72, y: 76, placementRole: 'corridor' },
  { id: 'junction-0', kind: 'junction', x: 16, y: 20, label: '', placementRole: 'corridor' },
  { id: 'junction-1', kind: 'junction', x: 38, y: 14, label: '', placementRole: 'corridor' },
  { id: 'junction-2', kind: 'junction', x: 92, y: 18, label: '', placementRole: 'corridor' },
  { id: 'junction-3', kind: 'junction', x: 13, y: 47, label: '', placementRole: 'corridor' },
  { id: 'junction-4', kind: 'junction', x: 52, y: 45, label: '', placementRole: 'intersection' },
  { id: 'junction-5', kind: 'junction', x: 92, y: 44, label: '', placementRole: 'corridor' },
  { id: 'junction-6', kind: 'junction', x: 18, y: 63, label: '', placementRole: 'corridor' },
  { id: 'junction-7', kind: 'junction', x: 55, y: 64, label: '', placementRole: 'intersection' },
  { id: 'junction-8', kind: 'junction', x: 87, y: 62, label: '', placementRole: 'corridor' },
  { id: 'junction-9', kind: 'junction', x: 23, y: 82, label: '', placementRole: 'corridor' },
  { id: 'junction-10', kind: 'junction', x: 55, y: 84, label: '', placementRole: 'intersection' },
  { id: 'junction-11', kind: 'junction', x: 88, y: 88, label: '', placementRole: 'corridor' },
];

const STATIC_TRACK_EDGES = [
  ['junction-0', 'junction-1'],
  ['junction-1', 'workshop'],
  ['workshop', 'junction-2'],
  ['junction-0', 'poi-0'],
  ['poi-0', 'workshop'],
  ['workshop', 'poi-1'],
  ['poi-1', 'junction-2'],
  ['poi-0', 'junction-3'],
  ['poi-0', 'junction-4'],
  ['workshop', 'junction-4'],
  ['poi-1', 'junction-5'],
  ['junction-4', 'poi-2'],
  ['junction-4', 'poi-3'],
  ['poi-2', 'junction-3'],
  ['poi-2', 'junction-6'],
  ['poi-2', 'junction-7'],
  ['poi-3', 'junction-5'],
  ['poi-3', 'junction-7'],
  ['poi-3', 'junction-8'],
  ['junction-6', 'poi-4'],
  ['junction-7', 'poi-4'],
  ['junction-7', 'poi-5'],
  ['junction-8', 'poi-5'],
  ['poi-4', 'junction-9'],
  ['poi-4', 'junction-10'],
  ['poi-5', 'junction-10'],
  ['poi-5', 'junction-11'],
  ['junction-9', 'junction-10'],
  ['junction-10', 'junction-11'],
];

const STATIC_NODE_BY_ID = new Map(STATIC_TRACK_NODES.map((node) => [node.id, node]));
const POI_COUNT = DAILY_MISSION_BOARD_COUNT;

function cloneStaticEdges() {
  return STATIC_TRACK_EDGES.map(([from, to]) => ({ from, to }));
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

function buildDegreeMap(edges) {
  const degree = new Map();
  for (const { from, to } of edges) {
    degree.set(from, (degree.get(from) ?? 0) + 1);
    degree.set(to, (degree.get(to) ?? 0) + 1);
  }
  return degree;
}

function assignVisibility(poiIds, workshopId, adj) {
  const depths = new Map();
  const visited = new Set([workshopId]);
  const queue = [[workshopId, 0]];
  while (queue.length > 0) {
    const [id, depth] = queue.shift();
    depths.set(id, depth);
    for (const nb of (adj.get(id) ?? [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push([nb, depth + 1]);
      }
    }
  }

  const sorted = [...poiIds].sort((a, b) => (depths.get(b) ?? 0) - (depths.get(a) ?? 0));
  const locked = new Set(sorted.slice(0, 2));
  return { locked, depths };
}

function buildSeedMetadata(uid, boardDateKey) {
  return {
    version: WORLD_SEED_VERSION,
    strategy: SEED_STRATEGY,
    stableFor: 'same-user-and-utc-day',
    uidScoped: true,
    boardDateKey,
    purposes: {
      world: `${uid}|${boardDateKey}|static-road-track`,
      tree: `${uid}|${boardDateKey}|static-road-track`,
      loops: `${uid}|${boardDateKey}|static-road-track`,
      poi: `${uid}|${boardDateKey}|static-road-track`,
      contractAssign: `${uid}|${boardDateKey}|contract-assign`,
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic district world for a given user and date.
 *
 * @param {string} uid
 * @param {string} boardDateKey  YYYY-MM-DD
 * @param {Array<{id:string, definitionId:string, title:string, tagline:string, district:string, rewardXp:number, rewardOzzies:number, status:string}>} contracts
 *   Exactly 6 MissionBoardEntry-shaped objects (the daily board slice).
 * @returns {{ worldId:string, boardDateKey:string, dailyResetAt:string, nodes:Array, edges:Array, contracts:Array }}
 */
export function generateDistrictWorld(uid, boardDateKey, contracts, dailyResetAt) {
  if (!Array.isArray(contracts) || contracts.length !== POI_COUNT) {
    throw new Error(`generateDistrictWorld requires exactly ${POI_COUNT} contracts; got ${contracts?.length ?? 0}.`);
  }

  const edges = cloneStaticEdges();
  const adj = buildAdjacency(edges);
  const degree = buildDegreeMap(edges);
  const shuffledContracts = createRng(`${uid}|${boardDateKey}|contract-assign`).shuffle([...contracts]);
  const poiIds = STATIC_TRACK_NODES.filter((node) => node.kind === 'poi').map((node) => node.id);
  const { locked, depths } = assignVisibility(poiIds, 'workshop', adj);

  const nodes = STATIC_TRACK_NODES.map((node) => {
    if (node.kind !== 'poi') {
      return {
        ...node,
        graphDegree: degree.get(node.id) ?? 0,
        graphDepth: depths.get(node.id) ?? 0,
      };
    }

    const poiIndex = Number(node.id.replace('poi-', ''));
    const contract = shuffledContracts[poiIndex];
    return {
      ...node,
      label: contract.title,
      contractId: contract.id,
      graphDegree: degree.get(node.id) ?? 0,
      graphDepth: depths.get(node.id) ?? 0,
    };
  });

  const worldContracts = poiIds.map((nodeId, index) => {
    const node = STATIC_NODE_BY_ID.get(nodeId);
    const contract = shuffledContracts[index];
    const isLocked = locked.has(nodeId);
    const graphDepth = depths.get(nodeId) ?? 0;
    const graphDegree = degree.get(nodeId) ?? 0;
    const placementRole = node?.placementRole ?? 'corridor';
    const worldContract = {
      id: contract.id,
      nodeId,
      definitionId: contract.definitionId,
      title: contract.title,
      tagline: contract.tagline,
      district: contract.district,
      rewardXp: contract.rewardXp,
      rewardOzzies: contract.rewardOzzies,
      visibility: isLocked ? 'locked' : 'visible',
      visibilityReason: isLocked
        ? 'Deep district node reserved behind progression.'
        : 'Daily board contract available from the Workshop.',
      graphDepth,
      graphDegree,
      placementRole,
      status: contract.status ?? 'active',
    };
    if (contract.encounter) worldContract.encounter = contract.encounter;
    if (contract.streetsEncounter) worldContract.streetsEncounter = contract.streetsEncounter;
    if (contract.fork) worldContract.fork = contract.fork;
    if (isLocked) {
      worldContract.lockHint = 'Complete closer contracts to unlock this deeper node.';
      worldContract.unlockCondition = {
        kind: 'complete_visible_contracts',
        requiredVisibleCompletions: 2,
        depth: graphDepth,
        message: 'Complete closer visible contracts to reveal this deeper route.',
      };
    }
    return worldContract;
  });

  return {
    worldId: `${uid}_${boardDateKey}`,
    boardDateKey,
    dailyResetAt,
    seed: buildSeedMetadata(uid, boardDateKey),
    graph: STATIC_MAP_GRAPH,
    nodes,
    edges,
    contracts: worldContracts,
  };
}
