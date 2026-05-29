/**
 * RaceTrack — race replay page at `/race/:raceId`.
 *
 * Loads the precomputed `Race` from the server, then renders a top-down
 * courier circuit drawn with HTML5 canvas. Each tick of the timeline maps
 * to a curve parameter `u ∈ [0, 1]` along an oval circuit; CSS 3D card
 * elements follow the curve, speeding up and slowing down exactly as the
 * precomputed timeline dictates.
 *
 * Both players see the same playback because the timeline is precomputed
 * server-side and seeded.
 *
 * Presentation layer (no effect on race fairness — the seeded timeline is
 * untouched):
 *   - The canvas is animated every frame: lane dashes flow under the racers,
 *     the district backdrop drifts in parallax, and the track glow pulses with
 *     the leader's speed so bursts *feel* fast.
 *   - A "broadcast" HUD overlays lap count, split timer, the live gap between
 *     racers, animated speed gauges, and lead-change callouts.
 *   - Named timeline events spawn positioned particle bursts, audio stingers,
 *     play-by-play commentary, screen-shake (wipeouts) and brief slow-mo
 *     (dramatic beats).
 *   - The race opens with a "3·2·1·GO!" countdown and closes with a photo-
 *     finish treatment plus an animated winner / reward payoff.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchRace } from "../services/race";
import { spawnCelebrationBurst } from "../lib/celebration";
import {
  sfxBattleClash,
  sfxBattleWin,
  sfxBattleLose,
  sfxClick,
  sfxRaceCountdownBeep,
  sfxRaceStartHorn,
  sfxRaceEvent,
  sfxRaceFinishSwell,
  startRaceRollLoop,
  type RaceRollLoopHandle,
} from "../lib/sfx";
import {
  spawnRaceEventBurst,
  classifyRaceEvent,
  isMajorRaceEvent,
  type RaceEventEffectKind,
} from "../lib/raceEffects";
import type { Race } from "../lib/types";
import { RaceCard3D } from "../components/RaceCard3D";
import { getRaceDistrictDisplayName } from "../lib/raceDistricts";
import { announceActiveDistrict } from "../lib/districtTheme";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 360;
const PADDING = 60;

interface TrackTheme {
  backdropTop: string;
  backdropBottom: string;
  ringColor: string;
  laneColor: string;
  gridColor: string;
  glowColor: string;
  scaleX: number;
  scaleY: number;
}

const DEFAULT_TRACK_THEME: TrackTheme = {
  backdropTop: "#1b0e2e",
  backdropBottom: "#070314",
  ringColor: "rgba(40,30,60,0.95)",
  laneColor: "rgba(255,220,70,0.55)",
  gridColor: "rgba(120,70,200,0.18)",
  glowColor: "#aa66ff",
  scaleX: 1,
  scaleY: 1,
};

const TRACK_THEMES: Record<string, TrackTheme> = {
  airaway: {
    backdropTop: "#0a1628",
    backdropBottom: "#001440",
    ringColor: "rgba(30,60,110,0.95)",
    laneColor: "rgba(100,200,255,0.7)",
    gridColor: "rgba(80,180,255,0.15)",
    glowColor: "#66ccff",
    scaleX: 1.15,
    scaleY: 0.85,
  },
  nightshade: {
    backdropTop: "#0d0018",
    backdropBottom: "#050010",
    ringColor: "rgba(55,20,75,0.95)",
    laneColor: "rgba(200,80,255,0.7)",
    gridColor: "rgba(160,60,220,0.15)",
    glowColor: "#cc44ff",
    scaleX: 0.85,
    scaleY: 0.9,
  },
  batteryville: {
    backdropTop: "#120800",
    backdropBottom: "#080400",
    ringColor: "rgba(80,35,0,0.95)",
    laneColor: "rgba(255,140,30,0.7)",
    gridColor: "rgba(220,100,20,0.15)",
    glowColor: "#ff8800",
    scaleX: 1.1,
    scaleY: 0.8,
  },
  "the-grid": {
    backdropTop: "#000d08",
    backdropBottom: "#000804",
    ringColor: "rgba(0,50,25,0.95)",
    laneColor: "rgba(0,255,120,0.7)",
    gridColor: "rgba(0,200,80,0.15)",
    glowColor: "#00ff88",
    scaleX: 1.2,
    scaleY: 0.7,
  },
  "the-forest": {
    backdropTop: "#061208",
    backdropBottom: "#030a04",
    ringColor: "rgba(20,55,15,0.95)",
    laneColor: "rgba(100,220,80,0.7)",
    gridColor: "rgba(60,180,40,0.15)",
    glowColor: "#88ee44",
    scaleX: 0.95,
    scaleY: 1,
  },
  "glass-city": {
    backdropTop: "#12100e",
    backdropBottom: "#0a0806",
    ringColor: "rgba(70,60,40,0.95)",
    laneColor: "rgba(255,220,100,0.7)",
    gridColor: "rgba(220,190,80,0.15)",
    glowColor: "#ffdd55",
    scaleX: 1.2,
    scaleY: 0.75,
  },
};

function getTrackTheme(district: string) {
  return TRACK_THEMES[district] ?? DEFAULT_TRACK_THEME;
}

function getTrackRadii(district: string) {
  const baseRx = (CANVAS_WIDTH - PADDING * 2) / 2;
  const baseRy = (CANVAS_HEIGHT - PADDING * 2) / 2;
  const theme = getTrackTheme(district);
  return { rx: baseRx * theme.scaleX, ry: baseRy * theme.scaleY };
}

function createTrackHelpers(district: string) {
  const { rx, ry } = getTrackRadii(district);

  /** Parametric oval circuit: returns {x, y, tangentAngle} for u ∈ [0, 1]. */
  function trackPoint(u: number) {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const theta = u * Math.PI * 2 - Math.PI / 2; // start at the top
    const x = cx + Math.cos(theta) * rx;
    const y = cy + Math.sin(theta) * ry;
    // Tangent for orienting cards along the curve.
    const dxdt = -Math.sin(theta) * rx;
    const dydt = Math.cos(theta) * ry;
    const angle = Math.atan2(dydt, dxdt);
    return { x, y, angle };
  }

  /** Project a point on the offset (inside or outside) lane. */
  function offsetTrackPoint(u: number, lateral: number) {
    const { x, y, angle } = trackPoint(u);
    // Perpendicular offset.
    const nx = Math.cos(angle - Math.PI / 2) * lateral;
    const ny = Math.sin(angle - Math.PI / 2) * lateral;
    return { x: x + nx, y: y + ny, angle };
  }

  return { trackPoint, offsetTrackPoint };
}

/** Draw a single tile of the per-district ambience spanning the canvas width. */
function drawAmbienceTile(ctx: CanvasRenderingContext2D, district: string) {
  switch (district) {
    case "airaway":
      ctx.strokeStyle = "rgba(150,220,255,0.14)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(50 + i * 120, 70 + i * 12);
        ctx.bezierCurveTo(120 + i * 110, 20, 190 + i * 110, 120, 260 + i * 110, 72);
        ctx.stroke();
      }
      break;
    case "nightshade":
      ctx.fillStyle = "rgba(140,50,200,0.08)";
      for (let i = -2; i < 8; i += 1) {
        ctx.fillRect(i * 120, 0, 28, CANVAS_HEIGHT);
      }
      break;
    case "batteryville":
      ctx.fillStyle = "rgba(255,150,40,0.09)";
      for (let i = -1; i < 10; i += 1) {
        ctx.save();
        ctx.translate(i * 84, CANVAS_HEIGHT - 48);
        ctx.rotate(-0.4);
        ctx.fillRect(0, 0, 18, 96);
        ctx.restore();
      }
      break;
    case "the-grid":
      ctx.strokeStyle = "rgba(0,255,140,0.16)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i += 1) {
        ctx.strokeRect(80 + i * 40, 55 + i * 18, CANVAS_WIDTH - 160 - i * 80, CANVAS_HEIGHT - 110 - i * 36);
      }
      break;
    case "the-forest":
      ctx.fillStyle = "rgba(120,210,90,0.08)";
      for (let i = 0; i < 18; i += 1) {
        ctx.beginPath();
        ctx.arc(30 + (i * 37) % CANVAS_WIDTH, 25 + (i * 53) % CANVAS_HEIGHT, 8 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "glass-city":
      ctx.fillStyle = "rgba(255,220,120,0.08)";
      for (let i = 0; i < 9; i += 1) {
        ctx.fillRect(40 + i * 78, 40 + (i % 3) * 18, 28, 120 + (i % 4) * 18);
      }
      break;
    default:
      break;
  }
}

interface RenderArgs {
  ctx: CanvasRenderingContext2D;
  district: string;
  /** Continuously increasing animation phase in pixels. */
  phase: number;
  /** Normalised leader speed in [0, 1] driving glow + flow energy. */
  intensity: number;
}

/**
 * Draw the animated track surface. Called every frame: lane dashes flow,
 * backdrop drifts in parallax and the glow pulses with the leader's speed.
 */
function renderScene({ ctx, district, phase, intensity }: RenderArgs) {
  const theme = getTrackTheme(district);
  const districtDisplayName = getRaceDistrictDisplayName(district) ?? "Open Circuit";
  const { trackPoint, offsetTrackPoint } = createTrackHelpers(district);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Backdrop — district neon gradient (static).
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, theme.backdropTop);
  grad.addColorStop(1, theme.backdropBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // District ambience — drifts horizontally in parallax (two tiles wrap).
  const drift = (phase * 0.35) % CANVAS_WIDTH;
  ctx.save();
  ctx.translate(-drift, 0);
  drawAmbienceTile(ctx, district);
  ctx.translate(CANVAS_WIDTH, 0);
  drawAmbienceTile(ctx, district);
  ctx.restore();

  // Grid background — scrolls slowly for a sense of forward motion.
  ctx.strokeStyle = theme.gridColor;
  ctx.lineWidth = 1;
  const gridOffset = phase % 32;
  for (let x = -32 + gridOffset; x < CANVAS_WIDTH; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
  }
  for (let y = -32 + (phase * 0.5) % 32; y < CANVAS_HEIGHT; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
  }

  // Track surface — thick oval ring with a speed-reactive glow pulse.
  ctx.lineWidth = 44;
  ctx.strokeStyle = theme.ringColor;
  ctx.shadowBlur = 14 + intensity * 26;
  ctx.shadowColor = theme.glowColor;
  ctx.beginPath();
  for (let i = 0; i <= 200; i += 1) {
    const u = i / 200;
    const { x, y } = trackPoint(u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Lane markers — animated dash flow so the road reads as moving under racers.
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -phase;
  ctx.strokeStyle = theme.laneColor;
  ctx.shadowBlur = 6 + intensity * 12;
  ctx.shadowColor = theme.glowColor;
  ctx.beginPath();
  for (let i = 0; i <= 200; i += 1) {
    const u = i / 200;
    const { x, y } = trackPoint(u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Start/finish line at u=0.
  const startA = offsetTrackPoint(0, -22);
  const startB = offsetTrackPoint(0, 22);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(startA.x, startA.y);
  ctx.lineTo(startB.x, startB.y);
  ctx.stroke();

  // Real checkerboard patch rotated with the start tangent.
  const startCenter = trackPoint(0);
  ctx.save();
  ctx.translate(startCenter.x, startCenter.y);
  ctx.rotate(startCenter.angle);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#ffffff" : "#000000";
      ctx.fillRect(-12 + col * 6, -12 + row * 6, 6, 6);
    }
  }
  ctx.restore();

  // District badge.
  ctx.save();
  ctx.font = "13px monospace";
  ctx.textBaseline = "middle";
  const badgeText = `DISTRICT: ${districtDisplayName.toUpperCase()}`;
  const badgeWidth = ctx.measureText(badgeText).width + 18;
  const badgeX = 14;
  const badgeY = 14;
  const badgeH = 24;
  const badgeR = 12;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(badgeX + badgeR, badgeY);
  ctx.lineTo(badgeX + badgeWidth - badgeR, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeR);
  ctx.lineTo(badgeX + badgeWidth, badgeY + badgeH - badgeR);
  ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeH, badgeX + badgeWidth - badgeR, badgeY + badgeH);
  ctx.lineTo(badgeX + badgeR, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeR);
  ctx.lineTo(badgeX, badgeY + badgeR);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeR, badgeY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(badgeText, badgeX + 9, badgeY + badgeH / 2 + 0.5);
  ctx.restore();

  // Cards are rendered as CSS 3D elements (RaceCard3D) in the DOM overlay —
  // nothing more to draw here.
}

/** Scale factor to convert raw timeline speed units to a rotateY tilt in degrees. */
const SPEED_TO_TILT_SCALE = 3000;
/** Maximum rotateY wobble applied to a racing card in degrees. */
const MAX_TILT_Y_DEG = 8;

/**
 * Maps a raw timeline speed value to a ±MAX_TILT_Y_DEG rotateY wobble.
 * A displayed speed of ~1.5 (raw ≈ 0.0015) maps to ~4.5°.
 */
function tiltYFromSpeed(speed: number): number {
  return Math.max(-MAX_TILT_Y_DEG, Math.min(MAX_TILT_Y_DEG, speed * SPEED_TO_TILT_SCALE));
}

/** Reference raw speed (~mid pace) used to normalise speed to a 0..1 intensity. */
const REFERENCE_SPEED = 0.0021;

function normalizeSpeedIntensity(speed: number): number {
  return Math.max(0, Math.min(1, speed / REFERENCE_SPEED));
}

/** How long a racer's stumble/surge reaction flash lingers after an event tick. */
const REACTION_DURATION_MS = 480;
/** How long the screen-shake and slow-mo emphasis last on a major event. */
const EMPHASIS_DURATION_MS = 360;

interface FloatingEvent {
  id: number;
  side: "challenger" | "defender";
  text: string;
  spawnedAt: number;
}

interface CommentaryLine {
  id: number;
  text: string;
}

let nextEventId = 1;

/** Animated count-up hook used for the reward payoff numbers. */
function useCountUp(target: number, active: boolean, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

type RacePhase = "idle" | "countdown" | "running" | "completed";

export function RaceTrack() {
  const { raceId } = useParams<{ raceId: string }>();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Animation clocks driven by the unified render loop.
  const lastFrameRef = useRef<number>(0);
  const raceClockRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const timeScaleRef = useRef<number>(1);
  const slowMoUntilRef = useRef<number>(0);
  const leaderIntensityRef = useRef<number>(0);
  const phaseStateRef = useRef<RacePhase>("idle");
  const leaderSideRef = useRef<"challenger" | "defender" | null>(null);

  const rollLoopRef = useRef<RaceRollLoopHandle | null>(null);

  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickIndex, setTickIndex] = useState(0);
  const [racePhase, setRacePhase] = useState<RacePhase>("idle");
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [floatingEvents, setFloatingEvents] = useState<FloatingEvent[]>([]);
  const [commentary, setCommentary] = useState<CommentaryLine[]>([]);
  const [leadBanner, setLeadBanner] = useState<string | null>(null);
  const [photoFinish, setPhotoFinish] = useState(false);
  // Short-lived per-side reaction kinds so card animations outlast the 1-tick event.
  const [chReaction, setChReaction] = useState<RaceEventEffectKind | null>(null);
  const [defReaction, setDefReaction] = useState<RaceEventEffectKind | null>(null);
  const chReactionTimer = useRef<number | null>(null);
  const defReactionTimer = useRef<number | null>(null);

  const completed = racePhase === "completed";
  const running = racePhase === "running";

  // Keep a ref of the phase so the render loop reads the latest without re-binding.
  useEffect(() => { phaseStateRef.current = racePhase; }, [racePhase]);

  // Load the race.
  useEffect(() => {
    if (!raceId) return;
    let cancelled = false;
    setLoading(true);
    fetchRace(raceId)
      .then((r) => { if (!cancelled) setRace(r); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load race."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId]);

  const trackHelpers = useMemo(
    () => createTrackHelpers(race?.district ?? ""),
    [race?.district],
  );

  // Whether this race is destined for a photo finish (used to heighten tension).
  const isPhotoFinishRace = useMemo(() => {
    if (!race) return false;
    const a = race.result.challengerFinishTick;
    const b = race.result.defenderFinishTick;
    if (a == null || b == null) return false;
    return Math.abs(a - b) <= 10;
  }, [race]);

  const pushCommentary = useCallback((text: string) => {
    setCommentary((prev) => [...prev.slice(-4), { id: nextEventId++, text }]);
  }, []);

  // ── Unified render loop ──────────────────────────────────────────────────
  // Always runs once the race is loaded. It advances the parallax phase using
  // the leader's current speed, advances the race clock (with optional slow-mo)
  // while running, and redraws the animated canvas every frame.
  useEffect(() => {
    if (!race) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    let cancelled = false;

    const loop = (now: number) => {
      if (cancelled) return;
      const dt = lastFrameRef.current ? Math.min(64, now - lastFrameRef.current) : 16;
      lastFrameRef.current = now;

      // Restore from slow-mo once its window elapses.
      if (slowMoUntilRef.current && now >= slowMoUntilRef.current) {
        slowMoUntilRef.current = 0;
        timeScaleRef.current = 1;
      }

      const phaseNow = phaseStateRef.current;

      // Advance the race clock while running (slow-mo scales it down).
      if (phaseNow === "running") {
        raceClockRef.current += dt * timeScaleRef.current;
        const idx = Math.min(
          race.timeline.length - 1,
          Math.floor(raceClockRef.current / race.tickMs),
        );
        setTickIndex(idx);
        if (idx >= race.timeline.length - 1) {
          setRacePhase("completed");
        }
      }

      // Parallax/lane flow speed: idle drifts gently, racing tracks the leader.
      const baseFlow = phaseNow === "running" ? 0.04 : 0.012;
      const flow = baseFlow + leaderIntensityRef.current * 0.5;
      phaseRef.current += flow * dt * timeScaleRef.current;

      if (ctx) {
        renderScene({
          ctx,
          district: race.district ?? "",
          phase: phaseRef.current,
          intensity: phaseNow === "running" ? leaderIntensityRef.current : 0.12,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [race]);

  // Manage the wheels/engine roll loop alongside the running state.
  useEffect(() => {
    if (running && !rollLoopRef.current) {
      rollLoopRef.current = startRaceRollLoop();
    }
    if (!running && rollLoopRef.current) {
      rollLoopRef.current.stop();
      rollLoopRef.current = null;
    }
    return () => {
      if (rollLoopRef.current) {
        rollLoopRef.current.stop();
        rollLoopRef.current = null;
      }
    };
  }, [running]);

  const beginTimeline = useCallback(() => {
    raceClockRef.current = 0;
    timeScaleRef.current = 1;
    slowMoUntilRef.current = 0;
    leaderSideRef.current = null;
    setTickIndex(0);
    setFloatingEvents([]);
    setCommentary([]);
    setLeadBanner(null);
    setPhotoFinish(false);
    setChReaction(null);
    setDefReaction(null);
    setRacePhase("running");
    sfxRaceStartHorn();
    pushCommentary("🏁 And they're off!");
  }, [pushCommentary]);

  // "3 · 2 · 1 · GO!" countdown, then start the timeline.
  const startCountdown = useCallback(() => {
    if (!race || racePhase === "countdown" || racePhase === "running") return;
    sfxClick();
    setRacePhase("countdown");
    const steps = ["3", "2", "1", "GO!"];
    let i = 0;
    setCountdownText(steps[0]);
    sfxRaceCountdownBeep(false);
    const advance = () => {
      i += 1;
      if (i >= steps.length) {
        setCountdownText(null);
        beginTimeline();
        return;
      }
      setCountdownText(steps[i]);
      sfxRaceCountdownBeep(i === steps.length - 1);
      window.setTimeout(advance, i === steps.length - 1 ? 650 : 800);
    };
    window.setTimeout(advance, 800);
  }, [race, racePhase, beginTimeline]);

  // Surface event tags as floating overlays, particle bursts, audio + commentary.
  useEffect(() => {
    if (!race || !running) return;
    const tk = race.timeline[tickIndex];
    if (!tk) return;
    const container = containerRef.current;
    const additions: FloatingEvent[] = [];

    const handleSide = (side: "challenger" | "defender", tag?: string) => {
      if (!tag) return;
      additions.push({ id: nextEventId++, side, text: tag, spawnedAt: Date.now() });
      sfxBattleClash();
      const kind = classifyRaceEvent(tag);
      if (kind) {
        sfxRaceEvent(kind);
        const racerName = side === "challenger" ? race.challenger.name : race.defender.name;
        pushCommentary(`${tag} — ${racerName}`);
        // Drive a short-lived card reaction (outlasts the single-tick event).
        if (side === "challenger") {
          setChReaction(kind);
          if (chReactionTimer.current) window.clearTimeout(chReactionTimer.current);
          chReactionTimer.current = window.setTimeout(() => setChReaction(null), REACTION_DURATION_MS);
        } else {
          setDefReaction(kind);
          if (defReactionTimer.current) window.clearTimeout(defReactionTimer.current);
          defReactionTimer.current = window.setTimeout(() => setDefReaction(null), REACTION_DURATION_MS);
        }
        // Positioned particle burst at the racer's current spot.
        if (container) {
          const prog = (side === "challenger" ? tk.challengerProgress : tk.defenderProgress) % 1;
          const pos = trackHelpers.offsetTrackPoint(prog, side === "challenger" ? -10 : 10);
          spawnRaceEventBurst(container, {
            leftPct: (pos.x / CANVAS_WIDTH) * 100,
            topPct: (pos.y / CANVAS_HEIGHT) * 100,
            kind,
          });
        }
        // Dramatic beats: screen-shake on wipeout, brief slow-mo on big moments.
        if (kind === "wipeout" && container) {
          container.classList.add("race-track-page--shake");
          window.setTimeout(() => container.classList.remove("race-track-page--shake"), EMPHASIS_DURATION_MS);
        }
        if (isMajorRaceEvent(kind)) {
          timeScaleRef.current = 0.4;
          slowMoUntilRef.current = performance.now() + EMPHASIS_DURATION_MS;
        }
      }
    };

    handleSide("challenger", tk.challengerEvent);
    handleSide("defender", tk.defenderEvent);

    if (additions.length > 0) {
      setFloatingEvents((prev) => [...prev, ...additions]);
    }
  }, [tickIndex, race, running, trackHelpers, pushCommentary]);

  // Track lead changes + drive the leader intensity ref for the canvas/audio.
  useEffect(() => {
    if (!race) return;
    const tk = race.timeline[tickIndex];
    if (!tk) return;
    const leaderSpeed = Math.max(tk.challengerSpeed, tk.defenderSpeed);
    leaderIntensityRef.current = normalizeSpeedIntensity(leaderSpeed);
    rollLoopRef.current?.setIntensity(normalizeSpeedIntensity(leaderSpeed));

    if (!running) return;
    const newLeader: "challenger" | "defender" | null =
      tk.challengerProgress > tk.defenderProgress + 0.002
        ? "challenger"
        : tk.defenderProgress > tk.challengerProgress + 0.002
          ? "defender"
          : leaderSideRef.current;
    if (newLeader && newLeader !== leaderSideRef.current && leaderSideRef.current !== null) {
      const name = newLeader === "challenger" ? race.challenger.name : race.defender.name;
      setLeadBanner(`LEAD CHANGE · ${name} surges ahead!`);
      pushCommentary(`⚡ ${name} takes the lead!`);
      window.setTimeout(() => setLeadBanner(null), 1500);
    }
    if (newLeader) leaderSideRef.current = newLeader;

    // Photo-finish tension on the final stretch.
    const lead = Math.max(tk.challengerProgress, tk.defenderProgress);
    if (isPhotoFinishRace && lead > 0.88 && !photoFinish) {
      setPhotoFinish(true);
      pushCommentary("📸 Photo finish brewing!");
    }
  }, [tickIndex, race, running, isPhotoFinishRace, photoFinish, pushCommentary]);

  // Garbage-collect floating events older than 1.4s.
  useEffect(() => {
    if (floatingEvents.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setFloatingEvents((prev) => prev.filter((ev) => now - ev.spawnedAt < 1400));
    }, 200);
    return () => clearTimeout(t);
  }, [floatingEvents]);

  // Announce district theme on load.
  useEffect(() => {
    if (!race) return;
    announceActiveDistrict(race.district);
  }, [race]);

  // Clean up reaction timers on unmount.
  useEffect(() => () => {
    if (chReactionTimer.current) window.clearTimeout(chReactionTimer.current);
    if (defReactionTimer.current) window.clearTimeout(defReactionTimer.current);
  }, []);

  // Finish-line celebration when the race completes.
  useEffect(() => {
    if (!completed || !race || !containerRef.current) return;
    const winner = race.result.winnerUid;
    const isViewerWinner = winner !== null && winner === user?.uid;
    spawnCelebrationBurst(containerRef.current, { particles: 110, spreadX: 460, spreadY: 340 });
    sfxRaceFinishSwell();
    if (winner === null) {
      pushCommentary("🤝 Too close to call — it's a draw!");
      return;
    }
    if (isViewerWinner) sfxBattleWin(); else sfxBattleLose();
    const winnerName = winner === race.challengerUid ? race.challenger.name : race.defender.name;
    pushCommentary(`🏆 ${winnerName} crosses the line first!`);
  }, [completed, race, user, pushCommentary]);

  const isParticipant = useMemo(() => {
    if (!race || !user) return false;
    return race.challengerUid === user.uid || race.defenderUid === user.uid;
  }, [race, user]);

  const replay = useCallback(() => {
    setRacePhase("idle");
    setTickIndex(0);
    raceClockRef.current = 0;
    // Defer to next frame so the idle state settles before the countdown.
    window.setTimeout(() => startCountdown(), 30);
  }, [startCountdown]);

  // Reward count-ups (only animate once completed).
  const chOzzies = useCountUp(
    Math.abs(race?.result.cardDeltas.challenger.ozzies ?? 0),
    completed,
  );
  const chXp = useCountUp(race?.result.cardDeltas.challenger.xp ?? 0, completed);
  const defOzzies = useCountUp(
    Math.abs(race?.result.cardDeltas.defender.ozzies ?? 0),
    completed,
  );
  const defXp = useCountUp(race?.result.cardDeltas.defender.xp ?? 0, completed);

  if (loading) {
    return <div className="page race-track-page"><p>Loading race…</p></div>;
  }
  if (error) {
    return <div className="page race-track-page"><p className="race-arena-error">{error}</p>
      <Link to="/arena" className="btn-primary">Back to Race Arena</Link></div>;
  }
  if (!race) return null;
  const { offsetTrackPoint } = trackHelpers;

  const tk = race.timeline[tickIndex];
  const winner = race.result.winnerUid;
  const districtDisplayName = getRaceDistrictDisplayName(race.district);

  // Compute 3D card positions for this tick.
  const chProgress = tk.challengerProgress % 1;
  const defProgress = tk.defenderProgress % 1;
  const chPos = offsetTrackPoint(chProgress, -10);
  const defPos = offsetTrackPoint(defProgress, 10);
  const chLeftPct = (chPos.x / CANVAS_WIDTH) * 100;
  const chTopPct  = (chPos.y / CANVAS_HEIGHT) * 100;
  const chAngleDeg = (chPos.angle * 180) / Math.PI;
  const chTiltY = tiltYFromSpeed(tk.challengerSpeed);

  const defLeftPct = (defPos.x / CANVAS_WIDTH) * 100;
  const defTopPct  = (defPos.y / CANVAS_HEIGHT) * 100;
  const defAngleDeg = (defPos.angle * 180) / Math.PI;
  const defTiltY = tiltYFromSpeed(tk.defenderSpeed);

  const challengerEventKind = chReaction;
  const defenderEventKind = defReaction;

  const winnerSide = winner === race.challengerUid
    ? "challenger"
    : winner === race.defenderUid
      ? "defender"
      : null;

  // ── Broadcast HUD readouts ────────────────────────────────────────────────
  const laps = Math.max(1, race.laps || 1);
  const leadProgress = Math.max(tk.challengerProgress, tk.defenderProgress);
  const currentLap = Math.min(laps, Math.floor(leadProgress * laps) + 1);
  const elapsedMs = tickIndex * race.tickMs;
  const elapsedLabel = `${(elapsedMs / 1000).toFixed(2)}s`;
  const gap = Math.abs(tk.challengerProgress - tk.defenderProgress);
  const gapLeaderName = tk.challengerProgress >= tk.defenderProgress
    ? race.challenger.name
    : race.defender.name;
  const chSpeedDisplay = tk.challengerSpeed * 1000;
  const defSpeedDisplay = tk.defenderSpeed * 1000;
  const chSpeedPct = Math.round(normalizeSpeedIntensity(tk.challengerSpeed) * 100);
  const defSpeedPct = Math.round(normalizeSpeedIntensity(tk.defenderSpeed) * 100);

  // Camera: zoom toward the midpoint of the racers on the final stretch.
  const camMidX = (chLeftPct + defLeftPct) / 2;
  const camMidY = (chTopPct + defTopPct) / 2;
  const camZoom = running && leadProgress > 0.8
    ? 1 + Math.min(0.07, (leadProgress - 0.8) * 0.35) + (photoFinish ? 0.02 : 0)
    : 1;
  const cameraStyle = {
    transform: `scale(${camZoom.toFixed(3)})`,
    transformOrigin: `${camMidX.toFixed(1)}% ${camMidY.toFixed(1)}%`,
  } as const;

  return (
    <div
      className={`page race-track-page${photoFinish ? " race-track-page--photo" : ""}`}
      ref={containerRef}
    >
      <header className="race-track-header">
        <h1>🏁 Courier Race</h1>
        <p>
          <strong>{race.challenger.name}</strong> vs <strong>{race.defender.name}</strong>
          {race.ozzyWager > 0 && <span> · Wager: {race.ozzyWager} Ozzies</span>}
        </p>
      </header>

      {/* ── Broadcast scoreboard strip ── */}
      <div className="race-scoreboard" aria-hidden="true">
        <span className="race-scoreboard-cell">
          <span className="race-scoreboard-label">Lap</span>
          <span className="race-scoreboard-value">{currentLap}/{laps}</span>
        </span>
        <span className="race-scoreboard-cell">
          <span className="race-scoreboard-label">Time</span>
          <span className="race-scoreboard-value">{elapsedLabel}</span>
        </span>
        <span className="race-scoreboard-cell">
          <span className="race-scoreboard-label">Gap</span>
          <span className="race-scoreboard-value">
            {gap < 0.001 ? "DEAD HEAT" : `${(gap * 100).toFixed(1)}%`}
          </span>
        </span>
      </div>

      <div className="race-track-canvas-wrap">
        <div className="race-track-canvas-inner" ref={cameraRef} style={cameraStyle}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="race-track-canvas"
            aria-label={`Race track: ${race.challenger.name} versus ${race.defender.name}`}
          />

          {/* Speed-reactive atmosphere overlays. */}
          <div
            className="race-speed-veil"
            aria-hidden="true"
            style={{ opacity: running ? leaderIntensityRef.current * 0.5 : 0 }}
          />

          {/* CSS 3D card racers — positioned over the canvas in perspective space. */}
          <RaceCard3D
            card={race.challenger}
            leftPct={chLeftPct}
            topPct={chTopPct}
            angleDeg={chAngleDeg}
            tiltX={20}
            tiltY={chTiltY}
            speed={tk.challengerSpeed}
            variant="challenger"
            eventKind={challengerEventKind}
            isLeading={running && tk.challengerProgress > tk.defenderProgress + 0.002}
          />
          <RaceCard3D
            card={race.defender}
            leftPct={defLeftPct}
            topPct={defTopPct}
            angleDeg={defAngleDeg}
            tiltX={20}
            tiltY={defTiltY}
            speed={tk.defenderSpeed}
            variant="defender"
            eventKind={defenderEventKind}
            isLeading={running && tk.defenderProgress > tk.challengerProgress + 0.002}
          />

          {/* Floating event overlays. */}
          {floatingEvents.map((ev) => (
            <span
              key={ev.id}
              className={`race-event-toast race-event-toast--${ev.side}`}
              aria-hidden="true"
            >
              {ev.text}
            </span>
          ))}

          {/* Countdown overlay. */}
          {countdownText && (
            <div className="race-countdown" aria-hidden="true">
              <span
                key={countdownText}
                className={`race-countdown-num${countdownText === "GO!" ? " race-countdown-num--go" : ""}`}
              >
                {countdownText}
              </span>
            </div>
          )}

          {/* Lead-change banner. */}
          {leadBanner && (
            <div className="race-lead-banner" role="status">{leadBanner}</div>
          )}

          {/* Photo-finish flag. */}
          {photoFinish && !completed && (
            <div className="race-photo-flag" aria-hidden="true">📸 PHOTO FINISH</div>
          )}
        </div>
      </div>

      <div className="race-track-hud">
        <div className="race-hud-row">
          <span className="race-hud-name race-hud-name--challenger">🔴 {race.challenger.name}</span>
          <div className="race-hud-bar">
            <div
              className="race-hud-bar-fill race-hud-bar-fill--challenger"
              style={{ width: `${(tk.challengerProgress * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="race-hud-gauge" title="Current speed">
            <span
              className="race-hud-gauge-fill race-hud-gauge-fill--challenger"
              style={{ width: `${chSpeedPct}%` }}
            />
            <span className="race-hud-gauge-num">⚡ {chSpeedDisplay.toFixed(2)}</span>
          </span>
        </div>
        <div className="race-hud-row">
          <span className="race-hud-name race-hud-name--defender">🔵 {race.defender.name}</span>
          <div className="race-hud-bar">
            <div
              className="race-hud-bar-fill race-hud-bar-fill--defender"
              style={{ width: `${(tk.defenderProgress * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="race-hud-gauge" title="Current speed">
            <span
              className="race-hud-gauge-fill race-hud-gauge-fill--defender"
              style={{ width: `${defSpeedPct}%` }}
            />
            <span className="race-hud-gauge-num">⚡ {defSpeedDisplay.toFixed(2)}</span>
          </span>
        </div>
        {(running || completed) && (
          <p className="race-hud-gapline">
            {gap < 0.001 ? "Neck and neck!" : `${gapLeaderName} leads by ${(gap * 100).toFixed(1)}%`}
          </p>
        )}
      </div>

      {/* Play-by-play commentary ticker. */}
      {commentary.length > 0 && (
        <div className="race-commentary" aria-live="polite">
          {commentary.map((line) => (
            <p key={line.id} className="race-commentary-line">{line.text}</p>
          ))}
        </div>
      )}

      <div className="race-track-controls">
        {racePhase === "idle" && (
          <button className="btn-primary" onClick={startCountdown}>▶ Start race</button>
        )}
        {racePhase === "countdown" && <span className="race-track-status">Get set…</span>}
        {running && <span className="race-track-status">Racing…</span>}
        {completed && (
          <>
            <button className="btn-outline" onClick={replay}>
              ↻ Replay
            </button>
            <button
              className="btn-outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                } catch {
                  // Best-effort — clipboard may be unavailable in some browsers/contexts.
                }
              }}
            >
              🔗 Share race
            </button>
            <Link to="/arena" className="btn-primary">Back to Race Arena</Link>
          </>
        )}
      </div>

      {completed && (
        <div className="race-result-panel race-result-panel--podium">
          <h2 className="race-result-title">
            {winnerSide === null
              ? "🤝 It's a draw!"
              : winnerSide === "challenger"
                ? `🏆 ${race.challenger.name} wins!`
                : `🏆 ${race.defender.name} wins!`}
          </h2>
          {isPhotoFinishRace && winnerSide !== null && (
            <p className="race-result-photo">📸 Photo finish — decided by a wheel!</p>
          )}
          {districtDisplayName && (
            <p className="race-result-district">🏁 Raced in: {districtDisplayName}</p>
          )}

          <div className="race-podium">
            <div className={`race-podium-slot race-podium-slot--challenger${winnerSide === "challenger" ? " race-podium-slot--winner" : ""}`}>
              <span className="race-podium-medal">{winnerSide === "challenger" ? "🥇" : winnerSide === null ? "🤝" : "🥈"}</span>
              <strong className="race-podium-name">{race.challenger.name}</strong>
              <span className="race-podium-reward">
                {race.result.cardDeltas.challenger.ozzies >= 0 ? "+" : "−"}{chOzzies} Ozzies · +{chXp} XP
              </span>
              {race.result.winnerStatBoost && winnerSide === "challenger" && (
                <span className="race-podium-boost">+1 {race.result.winnerStatBoost.stat}</span>
              )}
            </div>
            <div className={`race-podium-slot race-podium-slot--defender${winnerSide === "defender" ? " race-podium-slot--winner" : ""}`}>
              <span className="race-podium-medal">{winnerSide === "defender" ? "🥇" : winnerSide === null ? "🤝" : "🥈"}</span>
              <strong className="race-podium-name">{race.defender.name}</strong>
              <span className="race-podium-reward">
                {race.result.cardDeltas.defender.ozzies >= 0 ? "+" : "−"}{defOzzies} Ozzies · +{defXp} XP
              </span>
              {race.result.winnerStatBoost && winnerSide === "defender" && (
                <span className="race-podium-boost">+1 {race.result.winnerStatBoost.stat}</span>
              )}
            </div>
          </div>

          {!isParticipant && (
            <p className="race-result-spectator">You weren't in this race — viewing as a spectator.</p>
          )}
        </div>
      )}
    </div>
  );
}
