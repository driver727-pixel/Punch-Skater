import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildProceduralMapPrompt } from "../lib/promptBuilder";
import type { MissionBoardEntry, MissionBoardTheme } from "../lib/sharedTypes";
import type { District } from "../lib/types";
import { generateMissionMapImage } from "../services/missions";
import { hashSeedToInt } from "../utils/hash";

interface ProceduralMapProps {
  missions: MissionBoardEntry[];
  selectedMissionId: string | null;
  onSelectMission: (missionId: string) => void;
  missionEligibilityByMissionId: ReadonlyMap<string, boolean>;
  weeklyTheme: MissionBoardTheme | null;
  boardDateKey?: string;
}

const DISTRICT_MAP_THEME: Record<District, { accent: string; glow: string }> = {
  Airaway: { accent: "#7de7ff", glow: "rgba(125,231,255,0.26)" },
  Batteryville: { accent: "#ffc94d", glow: "rgba(255,201,77,0.24)" },
  "The Grid": { accent: "#7dffb6", glow: "rgba(125,255,182,0.24)" },
  Nightshade: { accent: "#d490ff", glow: "rgba(212,144,255,0.26)" },
  "The Forest": { accent: "#8cff8a", glow: "rgba(140,255,138,0.24)" },
  "Glass City": { accent: "#ffd98f", glow: "rgba(255,217,143,0.24)" },
};

const FALLBACK_GRID_POSITIONS = [
  { x: 16, y: 18 },
  { x: 52, y: 16 },
  { x: 82, y: 26 },
  { x: 24, y: 54 },
  { x: 58, y: 52 },
  { x: 80, y: 78 },
];

function clampCoordinate(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(6, Math.min(94, value));
}

function getMissionPosition(mission: MissionBoardEntry, index: number) {
  const fallback = FALLBACK_GRID_POSITIONS[index % FALLBACK_GRID_POSITIONS.length];
  const position = mission.gridPos ?? mission.coordinates;
  return {
    x: clampCoordinate(position?.x, fallback.x),
    y: clampCoordinate(position?.y, fallback.y),
  };
}

function buildFallbackTheme(missions: MissionBoardEntry[]): MissionBoardTheme {
  const featuredDistricts = [...new Set(missions.map((mission) => mission.district))].slice(0, 2) as District[];
  return {
    id: "daily-sector-canvas",
    label: "Daily Sector Sweep",
    summary: "Courier telemetry is plotting today's contract cluster across the tactical sector grid.",
    featuredDistricts,
  };
}

function inferThreatLevel(
  missions: MissionBoardEntry[],
  missionEligibilityByMissionId: ReadonlyMap<string, boolean>,
): number {
  const explicitThreats = missions
    .map((mission) => mission.threatLevel)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (explicitThreats.length > 0) {
    return Math.max(1, Math.min(5, Math.round(Math.max(...explicitThreats))));
  }
  const blockedCount = missions.filter((mission) => (
    mission.status !== "completed" && missionEligibilityByMissionId.get(mission.id) === false
  )).length;
  const completedCount = missions.filter((mission) => mission.status === "completed").length;
  return Math.max(1, Math.min(5, 2 + blockedCount - Math.floor(completedCount / 2)));
}

function getMissionStatusLabel(mission: MissionBoardEntry, eligible: boolean | undefined): string {
  if (mission.status === "completed") return "Cleared";
  if (eligible === false) return "At risk";
  return "Ready";
}

export function ProceduralMap({
  missions,
  selectedMissionId,
  onSelectMission,
  missionEligibilityByMissionId,
  weeklyTheme,
  boardDateKey = "",
}: ProceduralMapProps) {
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
  const [mapImageError, setMapImageError] = useState<string | null>(null);
  const [mapImageLoading, setMapImageLoading] = useState(false);

  const effectiveTheme = useMemo(
    () => weeklyTheme ?? buildFallbackTheme(missions),
    [missions, weeklyTheme],
  );
  const threatLevel = useMemo(
    () => inferThreatLevel(missions, missionEligibilityByMissionId),
    [missionEligibilityByMissionId, missions],
  );
  const cacheKey = useMemo(
    () => `mission-sector-map::${boardDateKey || "undated"}::${effectiveTheme.id}::${threatLevel}`,
    [boardDateKey, effectiveTheme.id, threatLevel],
  );

  useEffect(() => {
    if (missions.length === 0) {
      setMapImageUrl(null);
      setMapImageError(null);
      return;
    }
    let cancelled = false;
    const cachedUrl = typeof window !== "undefined" ? window.sessionStorage.getItem(cacheKey) : null;
    if (cachedUrl) {
      setMapImageUrl(cachedUrl);
      setMapImageError(null);
      return;
    }

    setMapImageLoading(true);
    setMapImageError(null);
    generateMissionMapImage(
      buildProceduralMapPrompt(effectiveTheme, threatLevel),
      hashSeedToInt(cacheKey),
    )
      .then((imageUrl) => {
        if (cancelled) return;
        setMapImageUrl(imageUrl);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(cacheKey, imageUrl);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setMapImageError(error instanceof Error ? error.message : "Mission uplink failed.");
      })
      .finally(() => {
        if (!cancelled) {
          setMapImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, effectiveTheme, missions.length, threatLevel]);

  const missionNodes = useMemo(() => missions.map((mission, index) => {
    const districtTheme = DISTRICT_MAP_THEME[mission.district];
    const eligible = missionEligibilityByMissionId.get(mission.id);
    return {
      mission,
      eligible,
      statusLabel: getMissionStatusLabel(mission, eligible),
      position: getMissionPosition(mission, index),
      style: {
        "--map-node-accent": districtTheme.accent,
        "--map-node-glow": districtTheme.glow,
      } as CSSProperties,
    };
  }), [missionEligibilityByMissionId, missions]);

  const routePath = useMemo(() => missionNodes
    .slice()
    .sort((left, right) => left.mission.sortOrder - right.mission.sortOrder)
    .map(({ position }, index) => `${index === 0 ? "M" : "L"} ${position.x} ${position.y}`)
    .join(" "), [missionNodes]);

  return (
    <div className="procedural-map">
      <div className={`procedural-map__viewport${mapImageLoading ? " procedural-map__viewport--loading" : ""}`}>
        <div
          className="procedural-map__backdrop"
          style={mapImageUrl ? { backgroundImage: `url("${mapImageUrl}")` } : undefined}
          aria-hidden="true"
        />
        <div className="procedural-map__grid" aria-hidden="true" />
        <div className="procedural-map__scanner" aria-hidden="true" />
        <svg className="procedural-map__overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {routePath && <path className="procedural-map__route" d={routePath} pathLength={100} />}
          {missionNodes.map(({ mission, position }) => (
            <circle
              key={`${mission.id}-echo`}
              className="procedural-map__echo"
              cx={position.x}
              cy={position.y}
              r={mission.id === selectedMissionId ? 5.3 : 3.8}
            />
          ))}
        </svg>

        <div className="procedural-map__hud">
          <span>Theme // {effectiveTheme.label}</span>
          <span>Threat // {threatLevel}/5</span>
          <span>{mapImageLoading ? "Uplink syncing…" : mapImageError ? "Fallback vector mode" : "fal.ai sector live"}</span>
        </div>

        {missionNodes.map(({ mission, eligible, statusLabel, position, style }) => (
          <button
            key={mission.id}
            type="button"
            className={[
              "procedural-map__target",
              mission.id === selectedMissionId ? "procedural-map__target--active" : "",
              mission.status === "completed" ? "procedural-map__target--completed" : "",
              eligible === false && mission.status !== "completed" ? "procedural-map__target--blocked" : "",
            ].filter(Boolean).join(" ")}
            style={{
              ...style,
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
            onClick={() => onSelectMission(mission.id)}
            aria-pressed={mission.id === selectedMissionId}
            aria-label={`${mission.title}. ${statusLabel}. ${mission.district}.`}
          >
            <span className="procedural-map__target-core" aria-hidden="true" />
            <span className="procedural-map__target-pulse" aria-hidden="true" />
            <span className="procedural-map__target-label">
              <span className="procedural-map__target-code">S-{mission.sortOrder + 1}</span>
              <strong>{mission.title}</strong>
              <span>{statusLabel} · {mission.district}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="procedural-map__console" role="listbox" aria-label="Mission comms console">
        {missionNodes.map(({ mission, statusLabel, eligible, style }) => (
          <button
            key={`${mission.id}-console`}
            type="button"
            role="option"
            aria-selected={mission.id === selectedMissionId}
            className={[
              "procedural-map__console-row",
              mission.id === selectedMissionId ? "procedural-map__console-row--active" : "",
              mission.status === "completed" ? "procedural-map__console-row--completed" : "",
              eligible === false && mission.status !== "completed" ? "procedural-map__console-row--blocked" : "",
            ].filter(Boolean).join(" ")}
            style={style}
            onClick={() => onSelectMission(mission.id)}
          >
            <span className="procedural-map__console-code">[{mission.sortOrder + 1}]</span>
            <span className="procedural-map__console-copy">
              <strong>{mission.title}</strong>
              <span>{mission.district} // {statusLabel} // +{mission.rewardXp} XP // +{mission.rewardOzzies} Oz</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
