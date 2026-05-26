import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isEnabled } from "../lib/featureFlags";
import { findAStarRoute, routeUsesValidEdges } from "../lib/pathfinding";
import type { ActiveDistrictRun, DistrictWorld, DistrictWorldVisuals, WorldContract } from "../lib/sharedTypes";
import {
  getDistrictWorld,
  getDistrictWorldVisuals,
  persistDistrictCheckpoint,
  resolveDistrictEncounter,
  resolveDistrictPoiFork,
  startDistrictInboundTravel,
  startDistrictRun,
} from "../services/missions";
import { MissionsMap } from "../components/MissionsMap";
import { MissionsPanel } from "../components/MissionsPanel";

const PANEL_WIDTH = 320;
const SEGMENT_DURATION_MS = 700;
const PHASE_LABELS: Record<string, string> = {
  IDLE_AT_BASE: "Idle at Base",
  TRAVELING_OUTBOUND: "Traveling Outbound",
  ENCOUNTER_RESOLUTION: "Encounter",
  AT_POI_FORK: "POI Fork",
  TRAVELING_INBOUND: "Traveling Inbound",
  MISSION_COMPLETE: "Mission Complete",
};

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
  const [resolvingEncounterOptionId, setResolvingEncounterOptionId] = useState<string | null>(null);
  const [resolvingPoiOptionId, setResolvingPoiOptionId] = useState<string | null>(null);
  const [startingInbound, setStartingInbound] = useState(false);
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
        if (run && run.phase !== "MISSION_COMPLETE") {
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
    const route = findAStarRoute({ nodes: world.nodes, edges: world.edges }, "workshop", selectedContract.nodeId);
    return routeUsesValidEdges(world.edges, route) ? route : [];
  }, [world, selectedContract]);

  const activeRouteNodeIds = useMemo(
    () => activeRun?.routeNodeIds ?? [],
    [activeRun],
  );
  const previewRouteNodeIds = activeRouteNodeIds.length > 1 ? activeRouteNodeIds : selectedRouteNodeIds;

  useEffect(() => {
    if (!world || !activeRun?.routeNodeIds?.length) return;
    if (activeRun.phase !== "TRAVELING_OUTBOUND" && activeRun.phase !== "TRAVELING_INBOUND") return;
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
      const progress = Math.min(1, (now - startedAt) / SEGMENT_DURATION_MS);
      setSegmentTravel({ routeNodeIds, fromIndex, toIndex, progress });
      if (progress < 1) {
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
    if (!world || !selectedContractId || selectedRouteNodeIds.length < 2 || !routeUsesValidEdges(world.edges, selectedRouteNodeIds)) return;
    if (activeRun && activeRun.phase !== "MISSION_COMPLETE") return;
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
  }, [uid, world, selectedContractId, selectedRouteNodeIds, userEmail, activeRun]);

  const handleResolveEncounter = useCallback(async (optionId: string) => {
    if (!activeRun) return;
    setResolvingEncounterOptionId(optionId);
    try {
      const run = await resolveDistrictEncounter(uid, activeRun.runId, optionId, userEmail);
      setActiveRun(run);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve encounter.");
    } finally {
      setResolvingEncounterOptionId(null);
    }
  }, [activeRun, uid, userEmail]);

  const handleResolvePoi = useCallback(async (optionId: string) => {
    if (!activeRun) return;
    setResolvingPoiOptionId(optionId);
    try {
      const run = await resolveDistrictPoiFork(uid, activeRun.runId, optionId, userEmail);
      setActiveRun(run);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve POI fork.");
    } finally {
      setResolvingPoiOptionId(null);
    }
  }, [activeRun, uid, userEmail]);

  const handleStartInbound = useCallback(async () => {
    if (!activeRun) return;
    setStartingInbound(true);
    try {
      const run = await startDistrictInboundTravel(uid, activeRun.runId, userEmail);
      setActiveRun(run);
      lastCheckpointSyncRef.current = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to begin inbound travel.");
    } finally {
      setStartingInbound(false);
    }
  }, [activeRun, uid, userEmail]);

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
    activeRun
    && (activeRun.phase === "TRAVELING_OUTBOUND" || activeRun.phase === "TRAVELING_INBOUND")
    && (activeRun.checkpointNodeIndex ?? 0) < ((activeRun.routeNodeIds?.length ?? 0) - 1),
  );
  const runInProgress = Boolean(activeRun && activeRun.phase !== "MISSION_COMPLETE");
  const phaseLabel = activeRun ? (PHASE_LABELS[activeRun.phase] ?? activeRun.phase) : PHASE_LABELS.IDLE_AT_BASE;
  const activeEncounter = activeRun?.phase === "ENCOUNTER_RESOLUTION" ? activeRun.activeEncounter : null;
  const showPoiForkOverlay = activeRun?.phase === "AT_POI_FORK";
  const poiResolved = Boolean(activeRun?.poiForkResolution?.selectedOptionId);

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
        {activeEncounter && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(2,6,12,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "min(520px, 100%)", border: "1px solid rgba(255,58,242,0.45)", background: "rgba(5,10,20,0.97)", padding: 16, color: "#fff", fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#ff3af2", textTransform: "uppercase" }}>{activeEncounter.badge}</div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{activeEncounter.title}</h3>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{activeEncounter.prompt}</p>
              <div style={{ display: "grid", gap: 8 }}>
                {activeEncounter.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleResolveEncounter(option.id)}
                    disabled={Boolean(resolvingEncounterOptionId)}
                    style={{ padding: "10px 12px", border: "1px solid rgba(125,231,255,0.4)", background: "rgba(9,18,28,0.95)", color: "#fff", textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{option.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}>{option.summary}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {showPoiForkOverlay && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(2,6,12,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "min(520px, 100%)", border: "1px solid rgba(125,231,255,0.4)", background: "rgba(5,10,20,0.97)", padding: 16, color: "#fff", fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#7de7ff", textTransform: "uppercase" }}>Destination fork</div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Resolve POI operation</h3>
              {!poiResolved ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {(activeRun?.poiForkOptions ?? []).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleResolvePoi(option.id)}
                      disabled={Boolean(resolvingPoiOptionId)}
                      style={{ padding: "10px 12px", border: "1px solid rgba(125,231,255,0.4)", background: "rgba(9,18,28,0.95)", color: "#fff", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{option.label}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}>{option.summary}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                    {activeRun?.poiForkResolution?.summary ?? "POI resolved."}
                  </p>
                  <button
                    onClick={handleStartInbound}
                    disabled={startingInbound}
                    style={{ padding: "10px 12px", border: "1px solid #7de7ff", background: "rgba(125,231,255,0.12)", color: "#7de7ff", textTransform: "uppercase", letterSpacing: "0.08em", cursor: startingInbound ? "wait" : "pointer" }}
                  >
                    {startingInbound ? "Starting…" : "Begin inbound travel"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div style={{ width: PANEL_WIDTH, flexShrink: 0, borderLeft: "1px solid rgba(125,231,255,0.18)", background: "rgba(5,10,20,0.97)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(125,231,255,0.15)", fontFamily: "monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7de7ff" }}>
          {world.boardDateKey} · {world.contracts.filter((c) => c.status === "completed").length}/{world.contracts.length} Cleared · {phaseLabel}
        </div>
        {selectedContract ? (
          <ContractDetailPanel
            contract={selectedContract}
            onLaunch={handleLaunch}
            launching={launching}
            disabled={activeTraveling || runInProgress}
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
