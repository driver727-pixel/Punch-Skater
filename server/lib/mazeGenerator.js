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

// ── Grid constants ────────────────────────────────────────────────────────────

const GRID_COLS = 7;
const GRID_ROWS = 7;
const GRID_TOTAL = GRID_COLS * GRID_ROWS;
const LOOP_EDGE_RATIO = 0.3;
const WORLD_SEED_VERSION = 'district-world-v2';
const SEED_STRATEGY = 'uid|boardDateKey|purpose';
const PLACEMENT_PREFERENCE = ['dead_end', 'intersection', 'corridor'];

/** Normalised [0, 100] coord for a grid column index. */
function colToX(col) {
  return Math.round(10 + (col / (GRID_COLS - 1)) * 80);
}
/** Normalised [0, 100] coord for a grid row index. */
function rowToY(row) {
  return Math.round(10 + (row / (GRID_ROWS - 1)) * 80);
}

function cellKey(col, row) {
  return `${col},${row}`;
}
function cellFromKey(key) {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}

// 4-connectivity neighbours
function neighbours(col, row) {
  return [
    [col - 1, row],
    [col + 1, row],
    [col, row - 1],
    [col, row + 1],
  ].filter(([c, r]) => c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS);
}

// ── Maze carving (recursive backtracker DFS) ──────────────────────────────────

/**
 * Carves a spanning tree on the grid using a randomised DFS.
 * Returns a Set of edge strings "c1,r1|c2,r2" (smaller key first).
 */
function carveSpanningTree(startCol, startRow, rng) {
  const visited = new Set();
  const edgeSet = new Set();

  function edgeString(c1, r1, c2, r2) {
    const a = cellKey(c1, r1);
    const b = cellKey(c2, r2);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function dfs(col, row) {
    visited.add(cellKey(col, row));
    const dirs = rng.shuffle([[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]);
    for (const [nc, nr] of dirs) {
      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
      if (visited.has(cellKey(nc, nr))) continue;
      edgeSet.add(edgeString(col, row, nc, nr));
      dfs(nc, nr);
    }
  }

  dfs(startCol, startRow);
  return edgeSet;
}

/**
 * Add ~30 % extra edges to create loops (so the map looks like streets not a tree).
 */
function addLoopEdges(edgeSet, rng) {
  const extraCount = Math.floor(GRID_TOTAL * LOOP_EDGE_RATIO);
  let attempts = 0;
  while (edgeSet.size < GRID_TOTAL - 1 + extraCount && attempts < 200) {
    attempts++;
    const col = rng.int(0, GRID_COLS - 1);
    const row = rng.int(0, GRID_ROWS - 1);
    const nbrs = neighbours(col, row);
    if (nbrs.length === 0) continue;
    const [nc, nr] = rng.pick(nbrs);
    const a = cellKey(col, row);
    const b = cellKey(nc, nr);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    edgeSet.add(key);
  }
}

// ── POI placement ─────────────────────────────────────────────────────────────

/**
 * Score each cell: dead ends (1 neighbour in edge set) score highest,
 * then intersections (3+ neighbours), then corridors (2 neighbours).
 * Returns cells sorted best-first.
 */
function scoreCells(edgeSet) {
  // Build adjacency count per cell
  const degree = buildDegreeMap(edgeSet);

  const scored = [];
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const key = cellKey(col, row);
      scored.push({
        col,
        row,
        key,
        degree: degree.get(key) ?? 0,
        placementRole: placementRoleForDegree(degree.get(key) ?? 0),
        score: placementScoreForDegree(degree.get(key) ?? 0),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.col - b.col || a.row - b.row);
  return scored;
}

function buildDegreeMap(edgeSet) {
  const degree = new Map();
  for (const key of edgeSet) {
    const [a, b] = key.split('|');
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  return degree;
}

function placementRoleForDegree(degree) {
  if (degree === 1) return 'dead_end';
  if (degree >= 3) return 'intersection';
  return 'corridor';
}

function placementScoreForDegree(degree) {
  if (degree === 1) return 3;       // dead end — best
  if (degree >= 3) return 2;        // intersection
  return 1;                         // corridor
}

/**
 * Pick POI_COUNT cells for POIs, ensuring they are spread across the grid
 * (no two POIs share the same 2×2 quadrant unless forced).
 */
function pickPoiCells(scoredCells, workshopKey, rng, count) {
  const quadrantOf = ({ col, row }) => `${Math.floor(col / 2)},${Math.floor(row / 2)}`;

  // Group by score tier; within each tier shuffle for randomness
  const tiers = new Map();
  for (const cell of scoredCells) {
    if (cell.key === workshopKey) continue;
    if (!tiers.has(cell.score)) tiers.set(cell.score, []);
    tiers.get(cell.score).push(cell);
  }
  for (const arr of tiers.values()) rng.shuffle(arr);

  const candidates = [
    ...(tiers.get(3) ?? []),
    ...(tiers.get(2) ?? []),
    ...(tiers.get(1) ?? []),
  ];

  const picked = [];
  const usedQuadrants = new Set();

  // First pass: enforce quadrant spread
  for (const cell of candidates) {
    if (picked.length >= count) break;
    const q = quadrantOf(cell);
    if (!usedQuadrants.has(q)) {
      picked.push(cell);
      usedQuadrants.add(q);
    }
  }
  // Second pass: fill remaining without quadrant constraint
  for (const cell of candidates) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.key === cell.key)) {
      picked.push(cell);
    }
  }

  return picked.slice(0, count);
}

// ── Connectivity check (BFS) ──────────────────────────────────────────────────

function buildAdjacency(edgeSet) {
  const adj = new Map();
  for (const key of edgeSet) {
    const [a, b] = key.split('|');
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  return adj;
}

function bfsReachable(adj, startKey) {
  const visited = new Set([startKey]);
  const queue = [startKey];
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

/**
 * Ensure all POI cells are reachable from workshopKey.
 * If any are isolated (shouldn't happen with a spanning tree, but guards against
 * edge cases), add direct edges to the nearest reachable cell.
 */
function ensureReachability(edgeSet, workshopKey, poiKeys) {
  const adj = buildAdjacency(edgeSet);
  const reachable = bfsReachable(adj, workshopKey);

  for (const pk of poiKeys) {
    if (reachable.has(pk)) continue;
    // Find the nearest reachable cell (Manhattan) and add a direct edge
    const { col: pc, row: pr } = cellFromKey(pk);
    let bestKey = null;
    let bestDist = Infinity;
    for (const rk of reachable) {
      const { col: rc, row: rr } = cellFromKey(rk);
      const d = Math.abs(pc - rc) + Math.abs(pr - rr);
      if (d < bestDist) { bestDist = d; bestKey = rk; }
    }
    if (bestKey) {
      const a = pk < bestKey ? `${pk}|${bestKey}` : `${bestKey}|${pk}`;
      edgeSet.add(a);
      reachable.add(pk);
    }
  }
}

// ── Prune unreachable cells (keep only cells that appear in edges) ─────────────

function reachableCellKeys(edgeSet, workshopKey) {
  const adj = buildAdjacency(edgeSet);
  return bfsReachable(adj, workshopKey);
}

// ── Contract visibility assignment ────────────────────────────────────────────

const POI_COUNT = DAILY_MISSION_BOARD_COUNT; // 6

/**
 * Assign visibility to contracts.
 * Rule: 4 visible immediately, 2 locked.
 * Locked contracts are the ones placed deepest in the graph (furthest from Workshop).
 */
function assignVisibility(poiKeys, workshopKey, adj) {
  const depths = new Map();
  const visited = new Set([workshopKey]);
  const queue = [[workshopKey, 0]];
  while (queue.length > 0) {
    const [key, depth] = queue.shift();
    depths.set(key, depth);
    for (const nb of (adj.get(key) ?? [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push([nb, depth + 1]);
      }
    }
  }

  const sorted = [...poiKeys].sort((a, b) => (depths.get(b) ?? 0) - (depths.get(a) ?? 0));
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
      world: `${uid}|${boardDateKey}|world`,
      tree: `${uid}|${boardDateKey}|tree`,
      loops: `${uid}|${boardDateKey}|loops`,
      poi: `${uid}|${boardDateKey}|poi`,
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

  const rng = createRng(`${uid}|${boardDateKey}|world`);

  // ── Place Workshop near centre with slight jitter ──────────────────────────
  const workshopCol = 3 + rng.int(-1, 1);
  const workshopRow = 3 + rng.int(-1, 1);
  const workshopKey = cellKey(workshopCol, workshopRow);

  // ── Carve spanning tree + add loops ───────────────────────────────────────
  const rngTree = createRng(`${uid}|${boardDateKey}|tree`);
  const edgeSet = carveSpanningTree(workshopCol, workshopRow, rngTree);
  addLoopEdges(edgeSet, createRng(`${uid}|${boardDateKey}|loops`));

  // ── Pick POI cells ─────────────────────────────────────────────────────────
  const scoredCells = scoreCells(edgeSet);
  const poiCells = pickPoiCells(scoredCells, workshopKey, createRng(`${uid}|${boardDateKey}|poi`), POI_COUNT);
  const poiKeys = poiCells.map((c) => c.key);

  // ── Guarantee reachability ─────────────────────────────────────────────────
  ensureReachability(edgeSet, workshopKey, poiKeys);

  // ── Determine visible cells (prune disconnected cells) ────────────────────
  const reachableKeys = reachableCellKeys(edgeSet, workshopKey);

  // ── Build adjacency for visibility ────────────────────────────────────────
  const adj = buildAdjacency(edgeSet);
  const degree = buildDegreeMap(edgeSet);
  const { locked, depths } = assignVisibility(poiKeys, workshopKey, adj);

  // ── Assign contracts to POI cells in depth order ──────────────────────────
  // Shuffle contracts deterministically then assign by ascending depth so
  // shallower (visible) nodes get contracts in a stable order.
  const shuffledContracts = createRng(`${uid}|${boardDateKey}|contract-assign`).shuffle([...contracts]);
  const poiByDepth = [...poiCells].sort((a, b) => (depths.get(a.key) ?? 0) - (depths.get(b.key) ?? 0));

  // ── Build nodes ───────────────────────────────────────────────────────────
  const nodes = [];

  // Workshop node
  nodes.push({
    id: 'workshop',
    kind: 'workshop',
    x: colToX(workshopCol),
    y: rowToY(workshopRow),
    label: 'Workshop',
    graphDegree: degree.get(workshopKey) ?? 0,
    graphDepth: 0,
    placementRole: 'workshop',
  });

  // POI nodes
  poiByDepth.forEach((cell, index) => {
    const contract = shuffledContracts[index];
    nodes.push({
      id: `poi-${index}`,
      kind: 'poi',
      x: colToX(cell.col),
      y: rowToY(cell.row),
      label: contract.title,
      contractId: contract.id,
      graphDegree: degree.get(cell.key) ?? 0,
      graphDepth: depths.get(cell.key) ?? 0,
      placementRole: placementRoleForDegree(degree.get(cell.key) ?? 0),
    });
  });

  // Junction nodes (reachable, not Workshop, not POI)
  const poiKeySet = new Set(poiKeys);
  let junctionIndex = 0;
  for (const key of reachableKeys) {
    if (key === workshopKey || poiKeySet.has(key)) continue;
    const { col, row } = cellFromKey(key);
    nodes.push({
      id: `junction-${junctionIndex}`,
      kind: 'junction',
      x: colToX(col),
      y: rowToY(row),
      label: '',
      graphDegree: degree.get(key) ?? 0,
      graphDepth: depths.get(key) ?? 0,
      placementRole: placementRoleForDegree(degree.get(key) ?? 0),
    });
    junctionIndex++;
  }

  // ── Build node id lookup by cell key ─────────────────────────────────────
  const nodeIdByKey = new Map();
  nodeIdByKey.set(workshopKey, 'workshop');
  poiByDepth.forEach((cell, index) => nodeIdByKey.set(cell.key, `poi-${index}`));
  let jIdx = 0;
  for (const key of reachableKeys) {
    if (key === workshopKey || poiKeySet.has(key)) continue;
    nodeIdByKey.set(key, `junction-${jIdx}`);
    jIdx++;
  }

  // ── Build edges (only between reachable cells) ────────────────────────────
  const edges = [];
  const seenEdge = new Set();
  for (const edgeKey of edgeSet) {
    const [aKey, bKey] = edgeKey.split('|');
    if (!reachableKeys.has(aKey) || !reachableKeys.has(bKey)) continue;
    const fromId = nodeIdByKey.get(aKey);
    const toId = nodeIdByKey.get(bKey);
    if (!fromId || !toId) continue;
    const canonical = fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`;
    if (seenEdge.has(canonical)) continue;
    seenEdge.add(canonical);
    edges.push({ from: fromId, to: toId });
  }

  // ── Build world contracts ─────────────────────────────────────────────────
  const worldContracts = poiByDepth.map((cell, index) => {
    const contract = shuffledContracts[index];
    const isLocked = locked.has(cell.key);
    const graphDepth = depths.get(cell.key) ?? 0;
    const graphDegree = degree.get(cell.key) ?? 0;
    const placementRole = placementRoleForDegree(graphDegree);
    const worldContract = {
      id: contract.id,
      nodeId: `poi-${index}`,
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
    graph: {
      algorithm: 'randomized-dfs-spanning-tree-with-loop-edges',
      grid: { cols: GRID_COLS, rows: GRID_ROWS },
      loopEdgeRatio: LOOP_EDGE_RATIO,
      workshopNodeId: 'workshop',
      poiCount: POI_COUNT,
      placementPreference: PLACEMENT_PREFERENCE,
      reachableFromWorkshop: true,
    },
    nodes,
    edges,
    contracts: worldContracts,
  };
}
