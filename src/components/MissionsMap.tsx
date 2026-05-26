import type { CSSProperties } from "react";
import type { ActiveDistrictRun, DistrictWorld, WorldContract, WorldEdge, WorldNode } from "../lib/sharedTypes";

interface MissionsMapProps {
  world: DistrictWorld;
  activeRun: ActiveDistrictRun | null;
  selectedContractId: string | null;
  onSelectContract: (contractId: string) => void;
  routeNodeIds: string[];
  backdropUrl?: string | null;
  spriteUrl?: string | null;
  tokenPosition?: { x: number; y: number } | null;
}

const NEON_CYAN = "#7de7ff";
const NEON_PINK = "#ff3af2";
const NEON_GREEN = "#7dffb6";
const NEON_GOLD = "#ffc94d";

const EDGE_COLOUR = "rgba(125,231,255,0.28)";
const EDGE_ACTIVE_COLOUR = "rgba(125,231,255,0.55)";
const ROUTE_EDGE_COLOUR = "rgba(255,201,77,0.95)";

const WORKSHOP_FILL = "#0a1520";
const WORKSHOP_STROKE = NEON_CYAN;
const POI_VISIBLE_FILL = "#0d1a2a";
const POI_VISIBLE_STROKE = NEON_PINK;
const POI_LOCKED_FILL = "#0d0d14";
const POI_LOCKED_STROKE = "rgba(180,180,220,0.35)";
const POI_SELECTED_STROKE = NEON_GOLD;
const JUNCTION_FILL = "rgba(125,231,255,0.08)";
const JUNCTION_STROKE = "rgba(125,231,255,0.18)";
const COMPLETED_STROKE = NEON_GREEN;
const COMPLETED_FILL = "#0a1a12";

const WORKSHOP_R = 14;
const POI_R = 11;
const JUNCTION_R = 4;
const TOKEN_R = 2.2;
const POI_TITLE_MAX_LENGTH = 18;
const POI_TITLE_TRUNCATE_AT = 16;

function nodeById(nodes: WorldNode[], id: string): WorldNode | undefined {
  return nodes.find((n) => n.id === id);
}

function contractForNode(contracts: WorldContract[], nodeId: string): WorldContract | undefined {
  return contracts.find((c) => c.nodeId === nodeId);
}

function buildRouteEdgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function buildRouteEdgeSet(routeNodeIds: string[]): Set<string> {
  const routeEdges = new Set<string>();
  for (let i = 1; i < routeNodeIds.length; i += 1) {
    routeEdges.add(buildRouteEdgeKey(routeNodeIds[i - 1], routeNodeIds[i]));
  }
  return routeEdges;
}

function isActiveEdge(edge: WorldEdge, activeRun: ActiveDistrictRun | null, contracts: WorldContract[]): boolean {
  if (!activeRun) return false;
  const contract = contracts.find((c) => c.id === activeRun.contractId);
  if (!contract) return false;
  return edge.from === contract.nodeId || edge.to === contract.nodeId || edge.from === "workshop" || edge.to === "workshop";
}

function MapEdge({
  edge,
  nodes,
  highlighted,
  routeHighlighted,
}: {
  edge: WorldEdge;
  nodes: WorldNode[];
  highlighted: boolean;
  routeHighlighted: boolean;
}) {
  const fromNode = nodeById(nodes, edge.from);
  const toNode = nodeById(nodes, edge.to);
  if (!fromNode || !toNode) return null;

  return (
    <line
      x1={`${fromNode.x}%`}
      y1={`${fromNode.y}%`}
      x2={`${toNode.x}%`}
      y2={`${toNode.y}%`}
      stroke={routeHighlighted ? ROUTE_EDGE_COLOUR : highlighted ? EDGE_ACTIVE_COLOUR : EDGE_COLOUR}
      strokeWidth={routeHighlighted ? 3 : highlighted ? 2 : 1.5}
      strokeDasharray={routeHighlighted ? undefined : highlighted ? undefined : "4 3"}
      opacity={routeHighlighted ? 1 : undefined}
    />
  );
}

function JunctionMarker({ node }: { node: WorldNode }) {
  return (
    <circle
      cx={`${node.x}%`}
      cy={`${node.y}%`}
      r={JUNCTION_R}
      fill={JUNCTION_FILL}
      stroke={JUNCTION_STROKE}
      strokeWidth={1}
    />
  );
}

function WorkshopMarker({ node }: { node: WorldNode }) {
  const cx = `${node.x}%`;
  const cy = `${node.y}%`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={WORKSHOP_R + 6} fill="none" stroke={NEON_CYAN} strokeWidth={1} opacity={0.15} />
      <circle cx={cx} cy={cy} r={WORKSHOP_R + 3} fill="none" stroke={NEON_CYAN} strokeWidth={1} opacity={0.25} />
      <circle cx={cx} cy={cy} r={WORKSHOP_R} fill={WORKSHOP_FILL} stroke={WORKSHOP_STROKE} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={NEON_CYAN} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={2} fill={NEON_CYAN} />
      <text
        x={cx}
        y={`calc(${node.y}% + ${WORKSHOP_R + 12}px)`}
        textAnchor="middle"
        fill={NEON_CYAN}
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
        letterSpacing="0.05em"
      >
        WORKSHOP
      </text>
    </g>
  );
}

function PoiMarker({
  node,
  contract,
  selected,
  onClick,
}: {
  node: WorldNode;
  contract: WorldContract | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const isLocked = !contract || contract.visibility === "locked";
  const isCompleted = contract?.status === "completed";

  let fill = POI_VISIBLE_FILL;
  let stroke = POI_VISIBLE_STROKE;
  if (isCompleted) {
    fill = COMPLETED_FILL;
    stroke = COMPLETED_STROKE;
  } else if (isLocked) {
    fill = POI_LOCKED_FILL;
    stroke = POI_LOCKED_STROKE;
  }
  if (selected) stroke = POI_SELECTED_STROKE;

  return (
    <g
      style={{ cursor: isLocked ? "default" : "pointer" }}
      onClick={isLocked ? undefined : onClick}
      aria-label={isLocked ? "Locked contract" : (contract?.title ?? "Contract")}
    >
      {selected && <circle cx={`${node.x}%`} cy={`${node.y}%`} r={POI_R + 6} fill="none" stroke={NEON_GOLD} strokeWidth={1} opacity={0.4} />}
      <circle
        cx={`${node.x}%`}
        cy={`${node.y}%`}
        r={POI_R}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {isCompleted ? (
        <text x={`${node.x}%`} y={`calc(${node.y}% + 4px)`} textAnchor="middle" fill={NEON_GREEN} fontSize={9} fontFamily="monospace">✓</text>
      ) : isLocked ? (
        <text x={`${node.x}%`} y={`calc(${node.y}% + 4px)`} textAnchor="middle" fill="rgba(180,180,220,0.5)" fontSize={9} fontFamily="monospace">?</text>
      ) : (
        <text x={`${node.x}%`} y={`calc(${node.y}% + 4px)`} textAnchor="middle" fill={NEON_PINK} fontSize={9} fontFamily="monospace">●</text>
      )}
      {!isLocked && contract && (
        <text
          x={`${node.x}%`}
          y={`calc(${node.y}% + ${POI_R + 12}px)`}
          textAnchor="middle"
          fill={isCompleted ? NEON_GREEN : stroke}
          fontSize={9}
          fontFamily="monospace"
          letterSpacing="0.04em"
        >
          {contract.title.length > POI_TITLE_MAX_LENGTH ? `${contract.title.slice(0, POI_TITLE_TRUNCATE_AT)}…` : contract.title}
        </text>
      )}
    </g>
  );
}

function MapLegend() {
  const legendEntries = [
    { colour: NEON_CYAN, label: "Workshop" },
    { colour: NEON_PINK, label: "Contract" },
    { colour: NEON_GOLD, label: "Route" },
    { colour: NEON_GREEN, label: "Cleared" },
    { colour: "rgba(180,180,220,0.5)", label: "Locked" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "rgba(5,10,20,0.75)",
        border: "1px solid rgba(125,231,255,0.2)",
        borderRadius: 4,
        padding: "8px 12px",
        pointerEvents: "none",
      }}
    >
      {legendEntries.map(({ colour, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: colour, flexShrink: 0 }} />
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "monospace" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  background: "radial-gradient(ellipse at 50% 40%, #071020 0%, #03070e 100%)",
  overflow: "hidden",
};

const svgStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

const SCANLINE_BG = `repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(125,231,255,0.015) 2px,
  rgba(125,231,255,0.015) 4px
)`;

export function MissionsMap({
  world,
  activeRun,
  selectedContractId,
  onSelectContract,
  routeNodeIds,
  backdropUrl,
  spriteUrl,
  tokenPosition,
}: MissionsMapProps) {
  const { nodes, edges, contracts } = world;
  const routeEdgeSet = buildRouteEdgeSet(routeNodeIds);
  const workshopNode = nodes.find((n) => n.kind === "workshop");
  const poiNodes = nodes.filter((n) => n.kind === "poi");
  const junctionNodes = nodes.filter((n) => n.kind === "junction");
  const displayTokenPosition = tokenPosition ?? (workshopNode ? { x: workshopNode.x, y: workshopNode.y } : null);

  return (
    <div style={containerStyle}>
      {backdropUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${backdropUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.35,
            filter: "saturate(1.15) contrast(1.05)",
          }}
        />
      ) : null}
      <div style={{ ...containerStyle, background: SCANLINE_BG, pointerEvents: "none", opacity: 0.6 }} />
      <svg style={svgStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map((edge, i) => {
          const routeHighlighted = routeEdgeSet.has(buildRouteEdgeKey(edge.from, edge.to));
          return (
            <MapEdge
              key={i}
              edge={edge}
              nodes={nodes}
              highlighted={isActiveEdge(edge, activeRun, contracts)}
              routeHighlighted={routeHighlighted}
            />
          );
        })}
        {junctionNodes.map((node) => <JunctionMarker key={node.id} node={node} />)}
        {poiNodes.map((node) => {
          const contract = contractForNode(contracts, node.id);
          return (
            <PoiMarker
              key={node.id}
              node={node}
              contract={contract}
              selected={selectedContractId === contract?.id}
              onClick={() => contract && onSelectContract(contract.id)}
            />
          );
        })}
        {workshopNode && <WorkshopMarker node={workshopNode} />}
        {displayTokenPosition ? (
          spriteUrl ? (
            <image
              href={spriteUrl}
              x={`${displayTokenPosition.x - TOKEN_R}%`}
              y={`${displayTokenPosition.y - TOKEN_R}%`}
              width={`${TOKEN_R * 2}%`}
              height={`${TOKEN_R * 2}%`}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <g>
              <circle
                cx={`${displayTokenPosition.x}%`}
                cy={`${displayTokenPosition.y}%`}
                r={TOKEN_R + 3}
                fill="none"
                stroke="rgba(255,58,242,0.5)"
                strokeWidth={1}
              />
              <circle
                cx={`${displayTokenPosition.x}%`}
                cy={`${displayTokenPosition.y}%`}
                r={TOKEN_R}
                fill="rgba(255,58,242,0.22)"
                stroke={NEON_PINK}
                strokeWidth={1.5}
              />
            </g>
          )
        ) : null}
      </svg>
      <MapLegend />
    </div>
  );
}
