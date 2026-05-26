import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isEnabled } from "../lib/featureFlags";
import type { ActiveDistrictRun, DistrictWorld, WorldContract } from "../lib/sharedTypes";
import { getDistrictWorld, startDistrictRun } from "../services/missions";
import { MissionsMap } from "../components/MissionsMap";
import { MissionsPanel } from "../components/MissionsPanel";

const PANEL_WIDTH = 320;

function ContractDetailPanel({
  contract,
  onLaunch,
  launching,
}: {
  contract: WorldContract;
  onLaunch: () => void;
  launching: boolean;
}) {
  const isLocked = contract.visibility === "locked";
  const isCompleted = contract.status === "completed";
  return (
    <div
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 9,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: isLocked ? "rgba(180,180,220,0.5)" : "#ff3af2",
        }}
      >
        {isLocked ? "Locked" : isCompleted ? "Cleared" : contract.district}
      </p>
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: isLocked ? "rgba(180,180,220,0.5)" : "#ffffff",
          fontFamily: "monospace",
        }}
      >
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
          disabled={launching}
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
            opacity: launching ? 0.6 : 1,
          }}
        >
          {launching ? "Launching…" : "Run Contract"}
        </button>
      )}
      {isCompleted && (
        <div
          style={{
            marginTop: "auto",
            padding: "10px 0",
            textAlign: "center",
            color: "#7dffb6",
            fontFamily: "monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          ✓ Cleared
        </div>
      )}
    </div>
  );
}

function MissionsWorldView({ uid, userEmail }: { uid: string; userEmail?: string | null }) {
  const [world, setWorld] = useState<DistrictWorld | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveDistrictRun | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getDistrictWorld(uid, userEmail)
      .then(({ world: w, activeRun: run }) => {
        setWorld(w);
        setActiveRun(run);
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

  const handleSelectContract = useCallback((contractId: string) => {
    setSelectedContractId(contractId);
  }, []);

  const handleLaunch = useCallback(async () => {
    if (!world || !selectedContractId) return;
    setLaunching(true);
    try {
      const run = await startDistrictRun(uid, selectedContractId, "", "Default Deck", userEmail);
      setActiveRun(run);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start run.");
    } finally {
      setLaunching(false);
    }
  }, [uid, world, selectedContractId, userEmail]);

  const selectedContract: WorldContract | undefined =
    world?.contracts.find((c) => c.id === selectedContractId);

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

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#03070e" }}>
      {/* Map takes up remaining space */}
      <div style={{ flex: 1, position: "relative" }}>
        <MissionsMap
          world={world}
          activeRun={activeRun}
          selectedContractId={selectedContractId}
          onSelectContract={handleSelectContract}
        />
      </div>

      {/* Side panel — contract detail */}
      <div
        style={{
          width: PANEL_WIDTH,
          flexShrink: 0,
          borderLeft: "1px solid rgba(125,231,255,0.18)",
          background: "rgba(5,10,20,0.97)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(125,231,255,0.15)",
            fontFamily: "monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#7de7ff",
          }}
        >
          {world.boardDateKey} · {world.contracts.filter((c) => c.status === "completed").length}/{world.contracts.length} Cleared
        </div>

        {/* Contract detail or placeholder */}
        {selectedContract ? (
          <ContractDetailPanel
            contract={selectedContract}
            onLaunch={handleLaunch}
            launching={launching}
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

  // Show the district world map when MISSIONS feature flag is enabled.
  if (isEnabled("MISSIONS", user.email)) {
    return (
      <div style={{ width: "100%", height: "calc(100vh - 60px)", overflow: "hidden" }}>
        <MissionsWorldView uid={user.uid} userEmail={user.email} />
      </div>
    );
  }

  // Fallback to classic mission panel for users without the flag.
  return <MissionsPanel uid={user.uid} />;
}

