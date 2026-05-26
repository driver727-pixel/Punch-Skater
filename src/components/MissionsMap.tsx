import type { CSSProperties } from "react";
import type { ActiveDistrictRun, DistrictWorld, WorldContract, WorldEdge, WorldNode } from "../lib/sharedTypes";

interface MissionsMapProps {
  world: DistrictWorld;
  activeRun: ActiveDistrictRun | null;
  selectedContractId: string | null;
  onSelectContract: (contractId: string) => void;
}

// ── Colour palette ────────────────────────────────────────────────────────────

const NEON_CYAN = "#7de7ff";
const NEON_PINK = "#ff3af2";
const NEON_GREEN = "#7dffb6";
const NEON_GOLD = "#ffc94d";

const EDGE_COLOUR = "rgba(125,231,255,0.28)";
const EDGE_ACTIVE_COLOUR = "rgba(125,231,255,0.55)";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeById(nodes: WorldNode[], id: string): WorldNode | undefined {
  return nodes.find((n) => n.id === id);
}

function contractForNode(contracts: WorldContract[], nodeId: string): WorldContract | undefined {
  return contracts.find((c) => c.nodeId === nodeId);
}

function isActiveEdge(edge: WorldEdge, activeRun: ActiveDistrictRun | null, contracts: WorldContract[]): boolean {
  if (!activeRun) return false;
  const contract = contracts.find((c) => c.id === activeRun.contractId);
  if (!contract) return false;
  return edge.from === contract.nodeId || edge.to === contract.nodeId ||
    edge.from === "workshop" || edge.to === "workshop";
}

// ── Edge component ────────────────────────────────────────────────────────────

function MapEdge({
  edge,
  nodes,
  highlighted,
}: {
  edge: WorldEdge;
  nodes: WorldNode[];
  highlighted: boolean;
}) {
  const fromNode = nodeById(nodes, edge.from);
  const toNode = nodeById(nodes, edge.to);
  if (!fromNode || !toNode) return null;

  const x1 = `${fromNode.x}%`;
  const y1 = `${fromNode.y}%`;
  const x2 = `${toNode.x}%`;
  const y2 = `${toNode.y}%`;

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={highlighted ? EDGE_ACTIVE_COLOUR : EDGE_COLOUR}
      strokeWidth={highlighted ? 2 : 1.5}
      strokeDasharray={highlighted ? undefined : "4 3"}
    />
  );
}

// ── Junction node ─────────────────────────────────────────────────────────────

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

// ── Workshop marker ───────────────────────────────────────────────────────────

function WorkshopMarker({ node }: { node: WorldNode }) {
  const cx = `${node.x}%`;
  const cy = `${node.y}%`;
  return (
    <g>
      {/* Outer glow ring */}
      <circle cx={cx} cy={cy} r={WORKSHOP_R + 6} fill="none" stroke={NEON_CYAN} strokeWidth={1} opacity={0.15} />
      <circle cx={cx} cy={cy} r={WORKSHOP_R + 3} fill="none" stroke={NEON_CYAN} strokeWidth={1} opacity={0.25} />
      {/* Body */}
      <circle cx={cx} cy={cy} r={WORKSHOP_R} fill={WORKSHOP_FILL} stroke={WORKSHOP_STROKE} strokeWidth={2} />
      {/* ⚙ icon approximation — two concentric rings */}
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={NEON_CYAN} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={2} fill={NEON_CYAN} />
      {/* Label */}
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

// ── POI marker ────────────────────────────────────────────────────────────────

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
  if (isCompleted) { fill = COMPLETED_FILL; stroke = COMPLETED_STROKE; }
  else if (isLocked) { fill = POI_LOCKED_FILL; stroke = POI_LOCKED_STROKE; }
  if (selected) stroke = POI_SELECTED_STROKE;

  const cx = `${node.x}%`;
  const cy = `${node.y}%`;

  return (
    <g
      style={{ cursor: isLocked ? "default" : "pointer" }}
      onClick={isLocked ? undefined : onClick}
      aria-label={isLocked ? "Locked contract" : (contract?.title ?? "Contract")}
    >
      {selected && (
        <circle cx={cx} cy={cy} r={POI_R + 6} fill="none" stroke={NEON_GOLD} strokeWidth={1} opacity={0.4} />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={POI_R}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {/* Icon */}
      {isCompleted ? (
        <text x={cx} y={`calc(${node.y}% + 4px)`} textAnchor="middle" fill={NEON_GREEN} fontSize={9} fontFamily="monospace">✓</text>
      ) : isLocked ? (
        <text x={cx} y={`calc(${node.y}% + 4px)`} textAnchor="middle" fill="rgba(180,180,220,0.5)" fontSize={9} fontFamily="monospace">?</text>
      ) : (
        <text x={cx} y={`calc(${node.y}% + 4px)`} textAnchor="middle" fill={NEON_PINK} fontSize={9} fontFamily="monospace">●</text>
      )}
      {/* Label — only for visible/completed */}
      {!isLocked && contract && (
        <text
          x={cx}
          y={`calc(${node.y}% + ${POI_R + 12}px)`}
          textAnchor="middle"
          fill={isCompleted ? NEON_GREEN : stroke}
          fontSize={9}
          fontFamily="monospace"
          letterSpacing="0.04em"
        >
          {contract.title.length > 18 ? contract.title.slice(0, 16) + "…" : contract.title}
        </text>
      )}
    </g>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

const legendEntries: Array<{ colour: string; label: string }> = [
  { colour: NEON_CYAN, label: "Workshop" },
  { colour: NEON_PINK, label: "Contract" },
  { colour: NEON_GOLD, label: "Selected" },
  { colour: NEON_GREEN, label: "Cleared" },
  { colour: "rgba(180,180,220,0.5)", label: "Locked" },
];

function MapLegend() {
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

// ── Active run banner ─────────────────────────────────────────────────────────

function ActiveRunBanner({ run, contracts }: { run: ActiveDistrictRun; contracts: WorldContract[] }) {
  const contract = contracts.find((c) => c.id === run.contractId);
  const phaseLabel: Record<string, string> = {
    outbound: "Outbound",
    at_poi: "At Contract",
    returning: "Returning",
    complete: "Complete",
    failed: "Failed",
  };
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(5,10,20,0.88)",
        border: `1px solid ${NEON_CYAN}`,
        borderRadius: 4,
        padding: "6px 16px",
        display: "flex",
        gap: 12,
        alignItems: "center",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: NEON_CYAN, fontSize: 10, fontFamily: "monospace", textTransform: "uppercase" }}>
        {phaseLabel[run.phase] ?? run.phase}
      </span>
      {contract && (
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: "monospace" }}>
          → {contract.title}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

export function MissionsMap({ world, activeRun, selectedContractId, onSelectContract }: MissionsMapProps) {
  const { nodes, edges, contracts } = world;

  const workshopNode = nodes.find((n) => n.kind === "workshop");
  const poiNodes = nodes.filter((n) => n.kind === "poi");
  const junctionNodes = nodes.filter((n) => n.kind === "junction");

  return (
    <div style={containerStyle}>
      {/* Scanline overlay */}
      <div style={{ ...containerStyle, background: SCANLINE_BG, pointerEvents: "none", opacity: 0.6 }} />

      <svg style={svgStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Edges — render under nodes */}
        {edges.map((edge, i) => (
          <MapEdge
            key={i}
            edge={edge}
            nodes={nodes}
            highlighted={isActiveEdge(edge, activeRun, contracts)}
          />
        ))}

        {/* Junction nodes */}
        {junctionNodes.map((node) => (
          <JunctionMarker key={node.id} node={node} />
        ))}

        {/* POI nodes */}
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

        {/* Workshop — render last (on top) */}
        {workshopNode && <WorkshopMarker node={workshopNode} />}
      </svg>

      {/* Active run banner */}
      {activeRun && activeRun.phase !== "complete" && activeRun.phase !== "failed" && (
        <ActiveRunBanner run={activeRun} contracts={contracts} />
      )}

      <MapLegend />
    </div>
  );
}
