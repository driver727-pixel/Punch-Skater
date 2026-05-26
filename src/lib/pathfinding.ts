import type { WorldEdge, WorldNode } from "./sharedTypes";

export interface PathfindingGraph {
  nodes: WorldNode[];
  edges: WorldEdge[];
}

function toAdjacency(edges: WorldEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set<string>());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set<string>());
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }
  return adjacency;
}

function manhattanDistance(a: WorldNode, b: WorldNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const startNode = nodesById.get(startId);
  const goalNode = nodesById.get(goalId);
  if (!startNode || !goalNode) return [];

  const adjacency = toAdjacency(graph.edges);
  if (!adjacency.has(startId) || !adjacency.has(goalId)) return [];

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
      return reconstructPath(cameFrom, goalId);
    }

    openSet.delete(currentId);
    const neighbors = adjacency.get(currentId);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      const currentG = gScore.get(currentId) ?? Number.POSITIVE_INFINITY;
      const tentativeG = currentG + 1;
      if (tentativeG >= (gScore.get(neighborId) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborId, currentId);
      gScore.set(neighborId, tentativeG);
      const neighborNode = nodesById.get(neighborId);
      if (!neighborNode) continue;
      fScore.set(neighborId, tentativeG + manhattanDistance(neighborNode, goalNode));
      openSet.add(neighborId);
    }
  }

  return [];
}

export function routeUsesValidEdges(edges: WorldEdge[], routeNodeIds: string[]): boolean {
  if (routeNodeIds.length < 2) return true;
  const edgeSet = new Set<string>();
  for (const edge of edges) {
    const key = edge.from < edge.to ? `${edge.from}|${edge.to}` : `${edge.to}|${edge.from}`;
    edgeSet.add(key);
  }
  for (let i = 1; i < routeNodeIds.length; i += 1) {
    const from = routeNodeIds[i - 1];
    const to = routeNodeIds[i];
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (!edgeSet.has(key)) return false;
  }
  return true;
}
