/**
 * MissionsPanel — Displays today's three daily missions with progress bars
 * and claim buttons.
 *
 * Gated behind the MISSIONS feature flag. Returns null when the flag is off.
 *
 * @sprint 1 @owner gamma
 */

import { useState, useEffect, useCallback } from "react";
import { isEnabled } from "../lib/featureFlags";
import { useAuth } from "../context/AuthContext";
import { getDailyMissions, claimMissionReward } from "../services/missions";
import type { Mission } from "../lib/sharedTypes";

interface MissionsPanelProps {
  uid: string;
}

function useMidnightCountdown(): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function compute() {
      const now = new Date();
      const midnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      );
      const diffMs = midnight.getTime() - now.getTime();
      if (diffMs <= 0) {
        setLabel("Refreshing…");
        return;
      }
      const h = Math.floor(diffMs / 3_600_000);
      const m = Math.floor((diffMs % 3_600_000) / 60_000);
      const s = Math.floor((diffMs % 60_000) / 1_000);
      setLabel(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }
    compute();
    const id = setInterval(compute, 1_000);
    return () => clearInterval(id);
  }, []);

  return label;
}

function MissionCard({
  mission,
  onClaim,
}: {
  mission: Mission;
  onClaim: (id: string) => void;
}) {
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
  const isComplete = mission.status === "completed";
  const isClaimed = Boolean((mission as Mission & { rewardClaimedAt?: string }).rewardClaimedAt);

  const badges: string[] = [];
  if (mission.district) badges.push(`📍 ${mission.district}`);
  if (mission.archetype) badges.push(`🎭 ${mission.archetype}`);
  if (mission.faction) badges.push(`🏴 ${mission.faction}`);
  if (mission.stat) badges.push(`📊 ${mission.stat}`);

  return (
    <div
      className={`mission-card${isComplete ? " mission-card--complete" : ""}${isClaimed ? " mission-card--claimed" : ""}`}
    >
      <div className="mission-card__header">
        <span className="mission-card__title">{mission.title}</span>
        <span className="mission-card__status">
          {isClaimed ? "✅ Claimed" : isComplete ? "🏆 Complete!" : "⏳ Active"}
        </span>
      </div>

      <p className="mission-card__desc">{mission.description}</p>

      {badges.length > 0 && (
        <div className="mission-card__badges">
          {badges.map((b) => (
            <span key={b} className="mission-card__badge">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="mission-card__progress-row">
        <div
          className="mission-card__progress-bar"
          role="progressbar"
          aria-valuenow={mission.progress}
          aria-valuemin={0}
          aria-valuemax={mission.target}
          aria-label={`${mission.title} progress`}
        >
          <div
            className="mission-card__progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="mission-card__progress-label">
          {mission.progress} / {mission.target}
        </span>
      </div>

      <div className="mission-card__rewards">
        <span className="mission-card__reward-badge mission-card__reward-badge--xp">
          +{mission.rewardXp} XP
        </span>
        {(mission.rewardOzzies ?? 0) > 0 && (
          <span className="mission-card__reward-badge mission-card__reward-badge--oz">
            +{mission.rewardOzzies} Oz
          </span>
        )}
      </div>

      {isComplete && !isClaimed && (
        <button
          className="btn-primary mission-card__claim-btn"
          onClick={() => onClaim(mission.id)}
          aria-label={`Claim reward for ${mission.title}`}
        >
          Claim Reward
        </button>
      )}
    </div>
  );
}

export function MissionsPanel({ uid }: MissionsPanelProps) {
  const { user } = useAuth();
  const countdown = useMidnightCountdown();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled("MISSIONS", user)) return;
    let cancelled = false;
    setLoading(true);
    getDailyMissions(uid, user?.email).then((result) => {
      if (!cancelled) {
        setMissions(result);
        setLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error("[MissionsPanel] Failed to load missions:", err);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [uid, user]);

  const handleClaim = useCallback(async (missionId: string) => {
    setClaimingId(missionId);
    setClaimError(null);
    try {
      const { xp, ozzies } = await claimMissionReward(uid, missionId, user?.email);
      setMissions((prev) =>
        prev.map((m) =>
          m.id === missionId
            ? { ...m, rewardClaimedAt: new Date().toISOString() } as Mission & { rewardClaimedAt: string }
            : m
        )
      );
      // Brief success annotation — a toast or SFX hook could replace this
      console.info(`[Missions] Claimed: +${xp} XP, +${ozzies} Oz`);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Failed to claim reward.");
    } finally {
      setClaimingId(null);
    }
  }, [uid, user]);

  if (!isEnabled("MISSIONS", user)) return null;

  return (
    <div className="missions-panel">
      <div className="missions-panel__header">
        <h2 className="missions-panel__title">🎯 Daily Missions</h2>
        <span className="missions-panel__expiry" aria-label="Time until missions reset">
          Resets in {countdown}
        </span>
      </div>

      {loading && (
        <p className="missions-panel__loading">Loading missions…</p>
      )}

      {!loading && missions.length === 0 && (
        <p className="missions-panel__empty">No missions available. Check back tomorrow.</p>
      )}

      {claimError && (
        <p className="missions-panel__error" role="alert">{claimError}</p>
      )}

      <div className={`missions-panel__list${claimingId ? " missions-panel__list--claiming" : ""}`}>
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} onClaim={handleClaim} />
        ))}
      </div>
    </div>
  );
}
