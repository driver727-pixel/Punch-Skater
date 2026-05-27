import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  getBoardPlacementBox,
  getCharacterPlacementBox,
  normalizeBoardPlacement,
  normalizeCharacterPlacement,
  resolveBoardLayerOrder,
} from "../lib/boardPlacement";
import {
  MISSION_PHASE,
  MISSION_PHASE_LABELS,
  isTerminalMissionPhase,
  normalizeMissionPhase,
} from "../lib/missionPhaseMachine";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";
import type {
  ActiveDistrictRun,
  CharacterLayerExtractionContract,
  DistrictWorld,
  WorldContract,
  WorldEdge,
  WorldNode,
} from "../lib/sharedTypes";

interface MissionsMapProps {
  world: DistrictWorld;
  activeRun: ActiveDistrictRun | null;
  selectedContractId: string | null;
  onSelectContract: (contractId: string) => void;
  routeNodeIds: string[];
  backdropUrl?: string | null;
  spriteUrl?: string | null;
  spriteExtraction?: CharacterLayerExtractionContract | null;
  tokenPosition?: { x: number; y: number } | null;
}

// ── Palette ────────────────────────────────────────────────────────────────
const NEON_CYAN = "#7de7ff";
const NEON_PINK = "#ff3af2";
const NEON_GREEN = "#7dffb6";
const NEON_GOLD = "#ffc94d";

const EDGE_COLOUR = "rgba(125,231,255,0.22)";
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

// ── Marker sizes (px relative to SVG pixel coordinate space) ──────────────
const WORKSHOP_R = 14;
const POI_R = 11;
const JUNCTION_R = 4;
const TOKEN_R = 10;
// Sprite tokens are rendered larger than the fallback circle so the character
// art remains legible at the map scale.
const SPRITE_TOKEN_HALF = 44;
const FIGURINE_TOKEN_W = 136;
const FIGURINE_TOKEN_H = 136;
const FIGURINE_CHARACTER_SCALE = 0.9;
const LABEL_OFFSET = 15;
const POI_TITLE_MAX_LENGTH = 18;
const POI_TITLE_TRUNCATE_AT = 16;

// Initial SVG dimensions used before the ResizeObserver fires on first render.
// These are replaced immediately once the container mounts and reports its size.
const DEFAULT_SVG_W = 800;
const DEFAULT_SVG_H = 600;

// ── Coordinate projection ──────────────────────────────────────────────────
// Nodes store x/y as 0-100 percentages; project to actual SVG pixel coords
// so the viewBox matches the container and all markers stay circular.
function spx(pct: number, dim: number): number {
  return (pct / 100) * dim;
}

function renderFigurineLayer(
  extraction: CharacterLayerExtractionContract,
  centerX: number,
  centerY: number,
) {
  const tokenLeft = centerX - FIGURINE_TOKEN_W / 2;
  const tokenTop = centerY - FIGURINE_TOKEN_H / 2;
  const scene = resolveBoardPoseScene(extraction.sceneSeed ?? extraction.sourceCardId ?? "missions-map");
  const boardPlacement = normalizeBoardPlacement(scene.key, extraction.boardPlacement);
  const boardBox = getBoardPlacementBox(scene.key, boardPlacement.scale);
  const characterPlacement = normalizeCharacterPlacement(extraction.characterPlacement);
  const characterBox = getCharacterPlacementBox(characterPlacement.scale);
  const resolvedBoardLayerOrder = resolveBoardLayerOrder(extraction.boardLayerOrder);
  const boardW = (boardBox.widthPercent / 100) * FIGURINE_TOKEN_W;
  const boardH = (boardBox.heightPercent / 100) * FIGURINE_TOKEN_H;
  const boardX = (boardPlacement.xPercent / 100) * FIGURINE_TOKEN_W - boardW / 2;
  const boardY = (boardPlacement.yPercent / 100) * FIGURINE_TOKEN_H - boardH / 2;
  const characterTargetW = (characterBox.widthPercent / 100) * FIGURINE_TOKEN_W;
  const characterTargetH = (characterBox.heightPercent / 100) * FIGURINE_TOKEN_H;
  const characterW = characterTargetW * FIGURINE_CHARACTER_SCALE;
  const characterH = characterTargetH * FIGURINE_CHARACTER_SCALE;
  const characterTargetX = (characterPlacement.xPercent / 100) * FIGURINE_TOKEN_W - characterTargetW / 2;
  const characterTargetY = (characterPlacement.yPercent / 100) * FIGURINE_TOKEN_H - characterTargetH / 2;
  const characterX = characterTargetX + (characterTargetW - characterW) / 2;
  const characterY = characterTargetY + characterTargetH - characterH;
  const hasBoard = Boolean(extraction.boardImageUrl);
  const hasCharacter = Boolean(extraction.characterImageUrl);

  if (!hasBoard && !hasCharacter) return null;

  return (
    <g transform={`translate(${tokenLeft} ${tokenTop})`}>
      {resolvedBoardLayerOrder === "behind-character" && extraction.boardImageUrl && (
        <image
          href={extraction.boardImageUrl}
          x={boardX}
          y={boardY}
          width={boardW}
          height={boardH}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      {extraction.characterImageUrl && (
        <image
          href={extraction.characterImageUrl}
          x={characterX}
          y={characterY}
          width={characterW}
          height={characterH}
          preserveAspectRatio="xMidYMax meet"
        />
      )}
      {resolvedBoardLayerOrder === "in-front" && extraction.boardImageUrl && (
        <image
          href={extraction.boardImageUrl}
          x={boardX}
          y={boardY}
          width={boardW}
          height={boardH}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </g>
  );
}

// ── Graph helpers ──────────────────────────────────────────────────────────
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
  return edge.from === contract.nodeId || edge.to === contract.nodeId ||
    edge.from === "workshop" || edge.to === "workshop";
}

// ── SVG defs (filters + grid) ──────────────────────────────────────────────
function MapDefs() {
  return (
    <defs>
      <filter id="mm-glow-cyan" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="mm-glow-pink" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="mm-glow-gold" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <pattern id="mm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(125,231,255,0.045)" strokeWidth="0.5" />
      </pattern>
    </defs>
  );
}

// ── Sub-components (all take svgW/svgH for pixel projection) ──────────────

function MapEdge({
  edge,
  nodes,
  highlighted,
  routeHighlighted,
  svgW,
  svgH,
}: {
  edge: WorldEdge;
  nodes: WorldNode[];
  highlighted: boolean;
  routeHighlighted: boolean;
  svgW: number;
  svgH: number;
}) {
  const fromNode = nodeById(nodes, edge.from);
  const toNode = nodeById(nodes, edge.to);
  if (!fromNode || !toNode) return null;

  return (
    <line
      x1={spx(fromNode.x, svgW)}
      y1={spx(fromNode.y, svgH)}
      x2={spx(toNode.x, svgW)}
      y2={spx(toNode.y, svgH)}
      stroke={routeHighlighted ? ROUTE_EDGE_COLOUR : highlighted ? EDGE_ACTIVE_COLOUR : EDGE_COLOUR}
      strokeWidth={routeHighlighted ? 3 : highlighted ? 2 : 1.5}
      strokeDasharray={routeHighlighted ? undefined : highlighted ? undefined : "5 4"}
      filter={routeHighlighted ? "url(#mm-glow-gold)" : undefined}
    />
  );
}

function JunctionMarker({ node, svgW, svgH }: { node: WorldNode; svgW: number; svgH: number }) {
  return (
    <circle
      cx={spx(node.x, svgW)}
      cy={spx(node.y, svgH)}
      r={JUNCTION_R}
      fill={JUNCTION_FILL}
      stroke={JUNCTION_STROKE}
      strokeWidth={1}
    />
  );
}

function WorkshopMarker({ node, svgW, svgH }: { node: WorldNode; svgW: number; svgH: number }) {
  const cx = spx(node.x, svgW);
  const cy = spx(node.y, svgH);
  return (
    <g filter="url(#mm-glow-cyan)">
      <circle cx={cx} cy={cy} r={WORKSHOP_R + 8} fill="none" stroke={NEON_CYAN} strokeWidth={1} opacity={0.1} />
      <circle cx={cx} cy={cy} r={WORKSHOP_R + 4} fill="none" stroke={NEON_CYAN} strokeWidth={1} opacity={0.2} />
      <circle cx={cx} cy={cy} r={WORKSHOP_R} fill={WORKSHOP_FILL} stroke={WORKSHOP_STROKE} strokeWidth={2} />
      {/* Crosshair forge icon */}
      <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={NEON_CYAN} strokeWidth={1.2} opacity={0.8} />
      <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={NEON_CYAN} strokeWidth={1.2} opacity={0.8} />
      <circle cx={cx} cy={cy} r={2.5} fill={NEON_CYAN} />
      <text
        x={cx}
        y={cy + WORKSHOP_R + LABEL_OFFSET}
        textAnchor="middle"
        fill={NEON_CYAN}
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
        letterSpacing="0.06em"
      >
        WORKSHOP
      </text>
    </g>
  );
}

// Simplified padlock icon at (cx, cy) for locked POIs.
// Arc: "a rx ry x-rotation large-arc-flag sweep-flag dx dy"
// sweep-flag=1 draws the arch clockwise (top of the shackle).
function LockIcon({ cx, cy, stroke }: { cx: number; cy: number; stroke: string }) {
  const bw = 7, bh = 6, bx = cx - bw / 2, by = cy - 1;
  // archR controls the shackle radius; diameter matches body width
  const archR = bw / 2 - 0.2;
  return (
    <g>
      <rect x={bx} y={by} width={bw} height={bh} rx={1} fill="none" stroke={stroke} strokeWidth={1.2} />
      {/* Shackle arch: starts at left edge, sweeps clockwise to right edge */}
      <path
        d={`M ${cx - archR} ${by} a ${archR} ${archR} 0 0 1 ${archR * 2} 0`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <circle cx={cx} cy={by + bh * 0.55} r={1.1} fill={stroke} />
    </g>
  );
}

// Diamond icon for visible/active POIs
function DiamondIcon({ cx, cy, stroke }: { cx: number; cy: number; stroke: string }) {
  const s = 4.5;
  return (
    <path
      d={`M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`}
      fill="none"
      stroke={stroke}
      strokeWidth={1.3}
    />
  );
}

function PoiMarker({
  node,
  contract,
  selected,
  onClick,
  svgW,
  svgH,
}: {
  node: WorldNode;
  contract: WorldContract | undefined;
  selected: boolean;
  onClick: () => void;
  svgW: number;
  svgH: number;
}) {
  const cx = spx(node.x, svgW);
  const cy = spx(node.y, svgH);
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

  const title = contract?.title ?? "";
  const displayTitle = title.length > POI_TITLE_MAX_LENGTH
    ? `${title.slice(0, POI_TITLE_TRUNCATE_AT)}…`
    : title;

  return (
    <g
      style={{ cursor: isLocked ? "default" : "pointer" }}
      onClick={isLocked ? undefined : onClick}
      aria-label={isLocked ? "Locked contract" : (contract?.title ?? "Contract")}
      filter={isLocked ? undefined : "url(#mm-glow-pink)"}
    >
      {selected && (
        <circle cx={cx} cy={cy} r={POI_R + 7} fill="none" stroke={NEON_GOLD} strokeWidth={1} opacity={0.35} />
      )}
      <circle cx={cx} cy={cy} r={POI_R} fill={fill} stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} />
      {isCompleted ? (
        <text x={cx} y={cy + 4} textAnchor="middle" fill={NEON_GREEN} fontSize={10} fontFamily="monospace">✓</text>
      ) : isLocked ? (
        <LockIcon cx={cx} cy={cy} stroke={POI_LOCKED_STROKE} />
      ) : (
        <DiamondIcon cx={cx} cy={cy} stroke={selected ? NEON_GOLD : NEON_PINK} />
      )}
      {!isLocked && contract && (
        <text
          x={cx}
          y={cy + POI_R + LABEL_OFFSET - 2}
          textAnchor="middle"
          fill={isCompleted ? NEON_GREEN : stroke}
          fontSize={10}
          fontFamily="monospace"
          letterSpacing="0.04em"
        >
          {displayTitle}
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
    { colour: "rgba(180,180,220,0.4)", label: "Locked" },
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
        background: "rgba(5,10,20,0.82)",
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

const PHASE_LABELS: Record<string, string> = MISSION_PHASE_LABELS;

function ActiveRunBanner({ activeRun, contracts }: { activeRun: ActiveDistrictRun; contracts: WorldContract[] }) {
  const normalizedPhase = normalizeMissionPhase(activeRun.phase);
  if (normalizedPhase === MISSION_PHASE.IDLE_AT_BASE) return null;
  const phase = PHASE_LABELS[normalizedPhase];
  if (!phase) return null;
  const contract = contracts.find((c) => c.id === activeRun.contractId);
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 30,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px",
        background: "rgba(5,10,20,0.88)",
        borderBottom: "1px solid rgba(125,231,255,0.18)",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: NEON_CYAN }}>
        {phase}
      </span>
      {contract && (
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.04em" }}>
          {contract.title}
        </span>
      )}
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
  spriteExtraction,
  tokenPosition,
}: MissionsMapProps) {
  const { nodes, edges, contracts } = world;
  const routeEdgeSet = buildRouteEdgeSet(routeNodeIds);
  const workshopNode = nodes.find((n) => n.kind === "workshop");
  const poiNodes = nodes.filter((n) => n.kind === "poi");
  const junctionNodes = nodes.filter((n) => n.kind === "junction");
  const displayTokenPosition = tokenPosition ?? (workshopNode ? { x: workshopNode.x, y: workshopNode.y } : null);

  // Track container pixel dimensions so the SVG viewBox matches the real
  // container size — this keeps all markers circular regardless of aspect ratio.
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(DEFAULT_SVG_W);
  const [svgH, setSvgH] = useState(DEFAULT_SVG_H);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) setSvgW(width);
      if (height > 0) setSvgH(height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showBanner = activeRun !== null && !isTerminalMissionPhase(activeRun.phase);

  return (
    <div ref={containerRef} style={containerStyle}>
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
      {/* Scanline overlay — must be absolute so it doesn't affect layout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: SCANLINE_BG,
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />
      {/* SVG graph: viewBox matches container pixels so circles stay round */}
      <svg style={svgStyle} viewBox={`0 0 ${svgW} ${svgH}`}>
        <MapDefs />
        {/* Subtle cyberpunk grid — only visible without a backdrop */}
        {!backdropUrl && <rect width={svgW} height={svgH} fill="url(#mm-grid)" />}
        {edges.map((edge, i) => {
          const routeHighlighted = routeEdgeSet.has(buildRouteEdgeKey(edge.from, edge.to));
          return (
            <MapEdge
              key={i}
              edge={edge}
              nodes={nodes}
              highlighted={isActiveEdge(edge, activeRun, contracts)}
              routeHighlighted={routeHighlighted}
              svgW={svgW}
              svgH={svgH}
            />
          );
        })}
        {junctionNodes.map((node) => (
          <JunctionMarker key={node.id} node={node} svgW={svgW} svgH={svgH} />
        ))}
        {poiNodes.map((node) => {
          const contract = contractForNode(contracts, node.id);
          return (
            <PoiMarker
              key={node.id}
              node={node}
              contract={contract}
              selected={selectedContractId === contract?.id}
              onClick={() => contract && onSelectContract(contract.id)}
              svgW={svgW}
              svgH={svgH}
            />
          );
        })}
        {workshopNode && <WorkshopMarker node={workshopNode} svgW={svgW} svgH={svgH} />}
        {displayTokenPosition ? (
          spriteExtraction?.characterImageUrl || spriteExtraction?.boardImageUrl ? (
            renderFigurineLayer(
              spriteExtraction,
              spx(displayTokenPosition.x, svgW),
              spx(displayTokenPosition.y, svgH),
            )
          ) : spriteUrl ? (
            <image
              href={spriteUrl}
              x={spx(displayTokenPosition.x, svgW) - SPRITE_TOKEN_HALF}
              y={spx(displayTokenPosition.y, svgH) - SPRITE_TOKEN_HALF}
              width={SPRITE_TOKEN_HALF * 2}
              height={SPRITE_TOKEN_HALF * 2}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <g filter="url(#mm-glow-pink)">
              <circle
                cx={spx(displayTokenPosition.x, svgW)}
                cy={spx(displayTokenPosition.y, svgH)}
                r={TOKEN_R + 4}
                fill="none"
                stroke="rgba(255,58,242,0.45)"
                strokeWidth={1}
              />
              <circle
                cx={spx(displayTokenPosition.x, svgW)}
                cy={spx(displayTokenPosition.y, svgH)}
                r={TOKEN_R}
                fill="rgba(255,58,242,0.18)"
                stroke={NEON_PINK}
                strokeWidth={1.5}
              />
            </g>
          )
        ) : null}
      </svg>
      {showBanner && activeRun && (
        <ActiveRunBanner activeRun={activeRun} contracts={contracts} />
      )}
      <MapLegend />
    </div>
  );
}
