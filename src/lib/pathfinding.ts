export interface PathfindingNode {
  id: string;
  x: number;
  y: number;
}

export interface PathfindingEdge {
  from: string;
  to: string;
}

export interface PathfindingGraph {
  nodes: PathfindingNode[];
  edges: PathfindingEdge[];
}

function toNodeMap(nodes: PathfindingNode[]): Map<string, PathfindingNode> {
  const nodesById = new Map<string, PathfindingNode>();
  for (const node of nodes) {
    if (node?.id) nodesById.set(node.id, node);
  }
  return nodesById;
}

function edgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function toAdjacency(edges: PathfindingEdge[], nodeIds: ReadonlySet<string>): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set<string>());
  }
  for (const edge of edges) {
    if (!edge?.from || !edge?.to || edge.from === edge.to) continue;
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }
  return adjacency;
}

function manhattanDistance(a: PathfindingNode | undefined, b: PathfindingNode | undefined): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const ax = Number.isFinite(a.x) ? a.x : 0;
  const ay = Number.isFinite(a.y) ? a.y : 0;
  const bx = Number.isFinite(b.x) ? b.x : 0;
  const by = Number.isFinite(b.y) ? b.y : 0;
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function reconstructPath(cameFrom: Map<string, string>, endId: string): string[] {
  const path = [endId];
  let current = endId;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}

export function findAStarRoute(graph: PathfindingGraph, startId: string, goalId: string): string[] {
  if (!startId || !goalId || startId === goalId) {
    return startId && goalId && startId === goalId ? [startId] : [];
  }

  const nodesById = toNodeMap(graph.nodes);
  const startNode = nodesById.get(startId);
  const goalNode = nodesById.get(goalId);
  if (!startNode || !goalNode) return [];

  const nodeIds = new Set(nodesById.keys());
  const adjacency = toAdjacency(graph.edges, nodeIds);

  const openSet = new Set<string>([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startId, 0]]);
  const fScore = new Map<string, number>([[startId, manhattanDistance(startNode, goalNode)]]);

  while (openSet.size > 0) {
    let currentId: string | null = null;
    let currentF = Number.POSITIVE_INFINITY;
    for (const nodeId of openSet) {
      const score = fScore.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (score < currentF) {
        currentF = score;
        currentId = nodeId;
      }
    }
    if (!currentId) break;

    if (currentId === goalId) {
      const route = reconstructPath(cameFrom, goalId);
      return routeUsesValidEdges(graph.edges, route, nodeIds) ? route : [];
    }

    openSet.delete(currentId);
    const neighbors = adjacency.get(currentId);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      const neighborNode = nodesById.get(neighborId);
      if (!neighborNode) continue;
      const currentG = gScore.get(currentId) ?? Number.POSITIVE_INFINITY;
      const tentativeG = currentG + 1;
      if (tentativeG >= (gScore.get(neighborId) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborId, currentId);
      gScore.set(neighborId, tentativeG);
      fScore.set(neighborId, tentativeG + manhattanDistance(neighborNode, goalNode));
      openSet.add(neighborId);
    }
  }

  return [];
}

export function routeUsesValidEdges(
  edges: PathfindingEdge[],
  routeNodeIds: string[],
  validNodeIds?: ReadonlySet<string>,
): boolean {
  if (!Array.isArray(routeNodeIds)) return false;
  if (routeNodeIds.length < 2) return true;
  const edgeSet = new Set<string>();
  for (const edge of Array.isArray(edges) ? edges : []) {
    if (!edge?.from || !edge?.to || edge.from === edge.to) continue;
    if (validNodeIds && (!validNodeIds.has(edge.from) || !validNodeIds.has(edge.to))) continue;
    edgeSet.add(edgeKey(edge.from, edge.to));
  }
  for (let i = 1; i < routeNodeIds.length; i += 1) {
    const from = routeNodeIds[i - 1];
    const to = routeNodeIds[i];
    if (!from || !to || from === to) return false;
    if (validNodeIds && (!validNodeIds.has(from) || !validNodeIds.has(to))) return false;
    if (!edgeSet.has(edgeKey(from, to))) return false;
  }
  return true;
}

export function routeUsesGraphEdges(graph: PathfindingGraph, routeNodeIds: string[]): boolean {
  const nodeIds = new Set(toNodeMap(graph.nodes).keys());
  return routeUsesValidEdges(graph.edges, routeNodeIds, nodeIds);
}
