import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isEnabled } from "../lib/featureFlags";
import { findAStarRoute, routeUsesGraphEdges } from "../lib/pathfinding";
import type { ActiveDistrictRun, DistrictWorld, DistrictWorldVisuals, WorldContract } from "../lib/sharedTypes";
import { getDistrictWorld, getDistrictWorldVisuals, persistDistrictCheckpoint, startDistrictRun } from "../services/missions";
import { MissionsMap } from "../components/MissionsMap";
import { MissionsPanel } from "../components/MissionsPanel";

const PANEL_WIDTH = 320;
const SEGMENT_DURATION_MS = 700;

/** Smoothstep easing — eliminates the harsh linear start/stop of token travel. */
function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function ContractDetailPanel({
  contract,
  onLaunch,
  launching,
  disabled,
}: {
  contract: WorldContract;
  onLaunch: () => void;
  launching: boolean;
  disabled: boolean;
}) {
  const isLocked = contract.visibility === "locked";
  const isCompleted = contract.status === "completed";
  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
      <p style={{ margin: 0, fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: isLocked ? "rgba(180,180,220,0.5)" : "#ff3af2" }}>
        {isLocked ? "Locked" : isCompleted ? "Cleared" : contract.district}
      </p>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isLocked ? "rgba(180,180,220,0.5)" : "#ffffff", fontFamily: "monospace" }}>
        {isLocked ? "???" : contract.title}
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
        {isLocked ? (contract.lockHint ?? "Complete an adjacent contract to reveal this node.") : contract.tagline}
      </p>
      {!isLocked && !isCompleted && (
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", marginBottom: 2 }}>XP</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{contract.rewardXp}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", marginBottom: 2 }}>OZZIES</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{contract.rewardOzzies}</div>
          </div>
        </div>
      )}
      {!isLocked && !isCompleted && (
        <button
          onClick={onLaunch}
          disabled={launching || disabled}
          style={{
            marginTop: "auto",
            padding: "10px 0",
            background: "rgba(255,58,242,0.1)",
            border: "1px solid #ff3af2",
            borderRadius: 4,
            color: "#ff3af2",
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: launching ? "wait" : "pointer",
            opacity: launching || disabled ? 0.6 : 1,
          }}
        >
          {launching ? "Launching…" : disabled ? "Travel in progress" : "Run Contract"}
        </button>
      )}
      {isCompleted && (
        <div style={{ marginTop: "auto", padding: "10px 0", textAlign: "center", color: "#7dffb6", fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ✓ Cleared
        </div>
      )}
    </div>
  );
}

type SegmentTravel = {
  routeNodeIds: string[];
  fromIndex: number;
  toIndex: number;
  progress: number;
};

function MissionsWorldView({ uid, userEmail }: { uid: string; userEmail?: string | null }) {
  const [world, setWorld] = useState<DistrictWorld | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveDistrictRun | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [visuals, setVisuals] = useState<DistrictWorldVisuals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [segmentTravel, setSegmentTravel] = useState<SegmentTravel | null>(null);
  const fetchedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastCheckpointSyncRef = useRef<string>("");
  const animatingRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getDistrictWorld(uid, userEmail)
      .then(({ world: w, activeRun: run, visuals: payloadVisuals }) => {
        setWorld(w);
        setActiveRun(run);
        setVisuals(payloadVisuals ?? w.visuals ?? null);
        if (run && run.phase !== "complete" && run.phase !== "failed") {
          const contract = w.contracts.find((c) => c.id === run.contractId);
          if (contract) setSelectedContractId(contract.id);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load district world.");
      })
      .finally(() => setLoading(false));
  }, [uid, userEmail]);

  useEffect(() => {
    if (!world) return;
    let cancelled = false;
    getDistrictWorldVisuals(uid, world.boardDateKey, userEmail)
      .then((payload) => {
        if (!cancelled) setVisuals(payload);
      })
      .catch(() => {
        // Fallback visuals are already safe; keep gameplay uninterrupted.
      });
    return () => {
      cancelled = true;
    };
  }, [uid, world, userEmail]);

  const selectedContract: WorldContract | undefined = useMemo(
    () => world?.contracts.find((c) => c.id === selectedContractId),
    [world, selectedContractId],
  );

  const selectedRouteNodeIds = useMemo(() => {
    if (!world || !selectedContract) return [];
    const graph = { nodes: world.nodes, edges: world.edges };
    const route = findAStarRoute(graph, "workshop", selectedContract.nodeId);
    return routeUsesGraphEdges(graph, route) ? route : [];
  }, [world, selectedContract]);

  const activeRouteNodeIds = useMemo(
    () => activeRun?.routeNodeIds ?? [],
    [activeRun],
  );
  const previewRouteNodeIds = activeRouteNodeIds.length > 1 ? activeRouteNodeIds : selectedRouteNodeIds;

  useEffect(() => {
    if (!world || !activeRun?.routeNodeIds?.length || activeRun.phase !== "outbound") return;
    const routeNodeIds = activeRun.routeNodeIds;
    const checkpointNodeIndex = Math.max(0, Math.min(routeNodeIds.length - 1, activeRun.checkpointNodeIndex ?? 0));
    if (checkpointNodeIndex >= routeNodeIds.length - 1) return;

    const fromIndex = checkpointNodeIndex;
    const toIndex = checkpointNodeIndex + 1;
    const syncKey = `${activeRun.runId}:${fromIndex}`;
    if (animatingRef.current || lastCheckpointSyncRef.current === syncKey) return;
    lastCheckpointSyncRef.current = syncKey;
    animatingRef.current = true;

    let cancelled = false;
    const startedAt = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
    const raw = Math.min(1, (now - startedAt) / SEGMENT_DURATION_MS);
    const progress = smoothstep(raw);
    setSegmentTravel({ routeNodeIds, fromIndex, toIndex, progress });
    if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const nextNodeId = routeNodeIds[toIndex];
      persistDistrictCheckpoint(uid, activeRun.runId, nextNodeId, toIndex, userEmail)
        .then((run) => {
          setActiveRun(run);
          setSegmentTravel(null);
          animatingRef.current = false;
        })
        .catch(() => {
          setSegmentTravel(null);
          animatingRef.current = false;
        });
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animatingRef.current = false;
    };
  }, [activeRun, uid, userEmail, world]);

  const tokenPosition = useMemo(() => {
    if (!world) return null;
    if (segmentTravel?.routeNodeIds?.length) {
      const fromNode = world.nodes.find((n) => n.id === segmentTravel.routeNodeIds[segmentTravel.fromIndex]);
      const toNode = world.nodes.find((n) => n.id === segmentTravel.routeNodeIds[segmentTravel.toIndex]);
      if (!fromNode || !toNode) return null;
      return {
        x: fromNode.x + (toNode.x - fromNode.x) * segmentTravel.progress,
        y: fromNode.y + (toNode.y - fromNode.y) * segmentTravel.progress,
      };
    }
    const routeNodeIds = activeRun?.routeNodeIds;
    if (routeNodeIds?.length) {
      const checkpointIndex = Math.max(0, Math.min(routeNodeIds.length - 1, activeRun?.checkpointNodeIndex ?? 0));
      const node = world.nodes.find((candidate) => candidate.id === routeNodeIds[checkpointIndex]);
      if (node) return { x: node.x, y: node.y };
    }
    const workshop = world.nodes.find((node) => node.kind === "workshop");
    return workshop ? { x: workshop.x, y: workshop.y } : null;
  }, [activeRun, segmentTravel, world]);

  const handleSelectContract = useCallback((contractId: string) => {
    setSelectedContractId(contractId);
  }, []);

  const handleLaunch = useCallback(async () => {
    if (
      !world
      || !selectedContractId
      || selectedRouteNodeIds.length < 2
      || !routeUsesGraphEdges({ nodes: world.nodes, edges: world.edges }, selectedRouteNodeIds)
    ) return;
    setLaunching(true);
    try {
      const run = await startDistrictRun(uid, selectedContractId, "", "Default Deck", userEmail);
      setActiveRun(run);
      lastCheckpointSyncRef.current = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start run.");
    } finally {
      setLaunching(false);
    }
  }, [uid, world, selectedContractId, selectedRouteNodeIds, userEmail]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#7de7ff", fontFamily: "monospace", fontSize: 13 }}>
        Loading district world…
      </div>
    );
  }

  if (error || !world) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ff3af2", fontFamily: "monospace", fontSize: 13 }}>
        {error ?? "District world unavailable."}
      </div>
    );
  }

  const activeTraveling = Boolean(
    activeRun && activeRun.phase === "outbound" && (activeRun.checkpointNodeIndex ?? 0) < ((activeRun.routeNodeIds?.length ?? 0) - 1),
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#03070e" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <MissionsMap
          world={world}
          activeRun={activeRun}
          selectedContractId={selectedContractId}
          onSelectContract={handleSelectContract}
          routeNodeIds={previewRouteNodeIds}
          backdropUrl={visuals?.backdrop.url}
          spriteUrl={visuals?.sprite.fallback ? null : visuals?.sprite.url}
          tokenPosition={tokenPosition}
        />
      </div>
      <div style={{ width: PANEL_WIDTH, flexShrink: 0, borderLeft: "1px solid rgba(125,231,255,0.18)", background: "rgba(5,10,20,0.97)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(125,231,255,0.15)", fontFamily: "monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7de7ff" }}>
          {world.boardDateKey} · {world.contracts.filter((c) => c.status === "completed").length}/{world.contracts.length} Cleared
        </div>
        {selectedContract ? (
          <ContractDetailPanel
            contract={selectedContract}
            onLaunch={handleLaunch}
            launching={launching}
            disabled={activeTraveling}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: 11 }}>
            Select a contract node
          </div>
        )}
      </div>
    </div>
  );
}

export function Missions() {
  const { user } = useAuth();
  if (!user) return null;

  if (isEnabled("MISSIONS", user.email)) {
    return (
      <div style={{ width: "100%", height: "calc(100vh - 60px)", overflow: "hidden" }}>
        <MissionsWorldView uid={user.uid} userEmail={user.email} />
      </div>
    );
  }

  return <MissionsPanel uid={user.uid} />;
}
