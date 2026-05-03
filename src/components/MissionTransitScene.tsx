import { useEffect, useMemo, useState } from "react";
import type { MissionFork, MissionForkOption } from "../lib/sharedTypes";
import type { WorldLocation } from "../lib/types";

interface MissionTransitSceneProps {
  missionId: string;
  locale: WorldLocation;
  localeSummary: string;
  sceneEyebrow: string;
  sceneTitle: string;
  sceneBody: string;
  sceneTags: string[];
  selectedDeckName?: string | null;
  routeLabel: string;
  revealForkIntel?: boolean;
  fork?: MissionFork;
  selectedForkOption?: MissionForkOption | null;
  controlledBy: string;
  crewPressure: string;
  glyph: string;
}

interface Point {
  x: number;
  y: number;
}

const BASE_TRACK: Point[] = [
  { x: 8, y: 54 },
  { x: 18, y: 52 },
  { x: 28, y: 50 },
  { x: 39, y: 45 },
  { x: 49, y: 40 },
  { x: 56, y: 36 },
];

const FORK_BRANCHES: Point[][] = [
  [{ x: 56, y: 36 }, { x: 65, y: 31 }, { x: 74, y: 24 }, { x: 88, y: 18 }],
  [{ x: 56, y: 36 }, { x: 67, y: 36 }, { x: 77, y: 36 }, { x: 88, y: 39 }],
  [{ x: 56, y: 36 }, { x: 66, y: 41 }, { x: 75, y: 47 }, { x: 86, y: 53 }],
];

const SIDE_STREETS: Point[][] = [
  [{ x: 14, y: 20 }, { x: 29, y: 20 }],
  [{ x: 32, y: 18 }, { x: 47, y: 18 }],
  [{ x: 49, y: 20 }, { x: 63, y: 20 }],
  [{ x: 69, y: 20 }, { x: 92, y: 20 }],
  [{ x: 18, y: 61 }, { x: 33, y: 61 }],
  [{ x: 61, y: 61 }, { x: 78, y: 61 }],
];

const TRACK_NODES: Array<{ x: number; y: number; variant?: "hub" | "locale" | "minor" }> = [
  { x: 8, y: 54, variant: "minor" },
  { x: 28, y: 50, variant: "minor" },
  { x: 49, y: 40, variant: "minor" },
  { x: 56, y: 36, variant: "hub" },
  { x: 88, y: 18, variant: "locale" },
  { x: 88, y: 39, variant: "locale" },
  { x: 86, y: 53, variant: "locale" },
];

const BLOCKS: Array<{ x: number; y: number; width: number; height: number }> = [
  { x: 8, y: 10, width: 16, height: 10 },
  { x: 28, y: 14, width: 18, height: 8 },
  { x: 52, y: 8, width: 18, height: 11 },
  { x: 74, y: 10, width: 12, height: 8 },
  { x: 18, y: 28, width: 16, height: 8 },
  { x: 38, y: 24, width: 12, height: 10 },
  { x: 68, y: 26, width: 16, height: 8 },
  { x: 14, y: 58, width: 16, height: 6 },
  { x: 60, y: 56, width: 18, height: 6 },
];

function getPath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function getTrackLength(points: Point[]): number {
  return points.slice(1).reduce((total, point, index) => {
    const from = points[index];
    return total + Math.hypot(point.x - from.x, point.y - from.y);
  }, 0);
}

function getTrackPose(points: Point[], progress: number) {
  if (points.length < 2) {
    return { x: 0, y: 0, angle: 0 };
  }
  const targetLength = getTrackLength(points) * progress;
  let traversed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (traversed + segmentLength >= targetLength) {
      const t = segmentLength === 0 ? 0 : (targetLength - traversed) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        angle: Math.atan2(end.y - start.y, end.x - start.x),
      };
    }
    traversed += segmentLength;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

export function MissionTransitScene({
  missionId,
  locale,
  localeSummary,
  sceneEyebrow,
  sceneTitle,
  sceneBody,
  sceneTags,
  selectedDeckName,
  routeLabel,
  revealForkIntel = false,
  fork,
  selectedForkOption,
  controlledBy,
  crewPressure,
  glyph,
}: MissionTransitSceneProps) {
  const [motionPhase, setMotionPhase] = useState(0.18);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setMotionPhase(0.62);
      return undefined;
    }

    let frameId = 0;
    const animate = (timestamp: number) => {
      setMotionPhase(((timestamp % 4800) / 4800) * 0.82 + 0.08);
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const selectedBranchIndex = fork && selectedForkOption
    ? Math.max(0, fork.options.findIndex((option) => option.id === selectedForkOption.id))
    : 0;

  const activeTrack = useMemo(() => {
    const branch = FORK_BRANCHES[selectedBranchIndex] ?? FORK_BRANCHES[0];
    return fork ? [...BASE_TRACK, ...branch.slice(1)] : BASE_TRACK;
  }, [fork, selectedBranchIndex]);

  const deckPose = useMemo(() => getTrackPose(activeTrack, motionPhase), [activeTrack, motionPhase]);

  return (
    <section className="mission-transit mission-panel">
      <div className="mission-transit__header">
        <div className="mission-transit__copy">
          <span className="mission-stage__eyebrow">{sceneEyebrow}</span>
          <h4 className="mission-stage__title">{sceneTitle}</h4>
          <p className="mission-stage__summary">{sceneBody}</p>
          <div className="mission-intel-tags">
            {sceneTags.map((tag) => (
              <span key={`${missionId}-${tag}`} className="mission-intel-tag">{tag}</span>
            ))}
          </div>
        </div>
        <div className="mission-transit__meta">
          <span className="mission-cinematic__metric-label">Operation locale</span>
          <strong>{locale}</strong>
          <span className="mission-transit__meta-copy">{localeSummary}</span>
          <span className="mission-cinematic__metric-label">Controlled by</span>
          <strong>{controlledBy}</strong>
          <span className="mission-cinematic__metric-label">Crew pressure</span>
          <span>{crewPressure}</span>
        </div>
      </div>

        <div className="mission-transit__map" aria-label={`${locale} operation map`}>
          <div className="mission-transit__glow mission-transit__glow--top" aria-hidden="true" />
          <div className="mission-transit__glow mission-transit__glow--bottom" aria-hidden="true" />
          <div className="mission-transit__grid" aria-hidden="true" />
          <svg className="mission-transit__svg" viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
            {SIDE_STREETS.map((road, index) => (
              <path
                key={`${missionId}-road-${index}`}
                className="mission-transit__road"
                d={getPath(road)}
              />
            ))}
            {BLOCKS.map((block) => (
              <rect
                key={`${block.x}-${block.y}`}
              className="mission-transit__block"
              x={block.x}
              y={block.y}
              width={block.width}
              height={block.height}
              rx="2"
              />
            ))}
            <path className="mission-transit__rail mission-transit__rail--base" d={getPath(BASE_TRACK)} />
            {fork?.options.map((option, index) => (
            <path
              key={`${missionId}-${option.id}-branch`}
              className={`mission-transit__rail${index === selectedBranchIndex ? " mission-transit__rail--active" : ""}`}
                d={getPath(FORK_BRANCHES[index] ?? FORK_BRANCHES[0])}
              />
            ))}
            {TRACK_NODES.map((node, index) => (
              <circle
                key={`${missionId}-node-${index}`}
                className={[
                  "mission-transit__hub",
                  node.variant === "locale" ? "mission-transit__hub--locale" : "",
                  node.variant === "minor" ? "mission-transit__hub--minor" : "",
                ].filter(Boolean).join(" ")}
                cx={node.x}
                cy={node.y}
                r={node.variant === "hub" ? 2.2 : node.variant === "locale" ? 2 : 1.2}
              />
            ))}
            <path className="mission-transit__scanline" d="M 4 18 H 96" />
          </svg>

        <div className="mission-transit__labels" aria-hidden="true">
          <span className="mission-transit__label mission-transit__label--depot">Depot spine</span>
          <span className="mission-transit__label mission-transit__label--fork">Blind fork</span>
          <span className="mission-transit__label mission-transit__label--locale">
            {glyph} {locale}
          </span>
          {fork?.options.map((option, index) => (
            <span
              key={`${missionId}-${option.id}-label`}
              className={`mission-transit__branch-label${index === selectedBranchIndex ? " mission-transit__branch-label--active" : ""}`}
              style={{
                left: `${(FORK_BRANCHES[index] ?? FORK_BRANCHES[0])[2].x}%`,
                top: `${(FORK_BRANCHES[index] ?? FORK_BRANCHES[0])[2].y}%`,
              }}
            >
              {revealForkIntel ? option.label : `Route ${index + 1}`}
            </span>
          ))}
        </div>

        <div
          className="mission-transit__deck"
          aria-hidden="true"
          style={{
            left: `${deckPose.x}%`,
            top: `${deckPose.y / 64 * 100}%`,
            transform: `translate(-50%, -50%) rotate(${deckPose.angle}rad)`,
          }}
        >
          <div className="mission-transit__deck-car">
            <span className="mission-transit__deck-glow" />
            <span className="mission-transit__deck-light" />
            <span className="mission-transit__deck-copy">
              <span className="mission-transit__deck-name">{selectedDeckName ?? "Courier deck"}</span>
              <span className="mission-transit__deck-route">{routeLabel}</span>
            </span>
            <span className="mission-transit__deck-signal" />
          </div>
        </div>
      </div>
    </section>
  );
}
