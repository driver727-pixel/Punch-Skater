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
 * Design notes:
 *   - The HTML5 canvas draws only the static track surface (background,
 *     grid, oval ring, lane markers, start/finish line). It renders once
 *     when the race loads and never again.
 *   - The two racing cards are CSS 3D elements (`RaceCard3D`) absolutely
 *     positioned over the canvas. Their position and orientation are driven
 *     per-tick by the precomputed timeline so they follow the oval with
 *     realistic lean and speed wobble.
 *   - The HUD (lap progress bars, names, current Ozzy wager, speed needle)
 *     overlays using regular DOM elements so screen-readers and keyboard
 *     users still get the result via the result panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchRace } from "../services/race";
import { spawnCelebrationBurst } from "../lib/celebration";
import { sfxBattleClash, sfxBattleWin, sfxBattleLose, sfxClick } from "../lib/sfx";
import type { Race } from "../lib/types";
import { RaceCard3D } from "../components/RaceCard3D";
import { getRaceDistrictDisplayName } from "../lib/raceDistricts";

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

interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  district: string;
}

/** Draw the static track surface onto the canvas. Called once per race load. */
function drawScene({ ctx, district }: DrawArgs) {
  const theme = getTrackTheme(district);
  const districtDisplayName = getRaceDistrictDisplayName(district) ?? "Open Circuit";
  const { trackPoint, offsetTrackPoint } = createTrackHelpers(district);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Backdrop — district neon gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, theme.backdropTop);
  grad.addColorStop(1, theme.backdropBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // District ambience accents.
  ctx.save();
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
  ctx.restore();

  // Grid background.
  ctx.strokeStyle = theme.gridColor;
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
  }

  // Track surface — thick oval ring.
  ctx.lineWidth = 44;
  ctx.strokeStyle = theme.ringColor;
  ctx.shadowBlur = 18;
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

  // Lane markers.
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = theme.laneColor;
  ctx.shadowBlur = 8;
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

interface FloatingEvent {
  id: number;
  side: "challenger" | "defender";
  text: string;
  spawnedAt: number;
}

let nextEventId = 1;

export function RaceTrack() {
  const { raceId } = useParams<{ raceId: string }>();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickIndex, setTickIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [floatingEvents, setFloatingEvents] = useState<FloatingEvent[]>([]);

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

  // Animation loop.
  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!race || running) return;
    sfxClick();
    setRunning(true);
    setCompleted(false);
    setTickIndex(0);
    setFloatingEvents([]);
    startedAtRef.current = performance.now();
    const tick = () => {
      const startedAt = startedAtRef.current ?? performance.now();
      const elapsed = performance.now() - startedAt;
      const idx = Math.min(race.timeline.length - 1, Math.floor(elapsed / race.tickMs));
      setTickIndex(idx);
      if (idx >= race.timeline.length - 1) {
        setRunning(false);
        setCompleted(true);
        startedAtRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [race, running]);

  useEffect(() => () => stop(), [stop]);

  // Surface event tags as floating overlays.
  useEffect(() => {
    if (!race) return;
    const tk = race.timeline[tickIndex];
    if (!tk) return;
    const additions: FloatingEvent[] = [];
    if (tk.challengerEvent) {
      additions.push({ id: nextEventId++, side: "challenger", text: tk.challengerEvent, spawnedAt: Date.now() });
      sfxBattleClash();
    }
    if (tk.defenderEvent) {
      additions.push({ id: nextEventId++, side: "defender", text: tk.defenderEvent, spawnedAt: Date.now() });
      sfxBattleClash();
    }
    if (additions.length > 0) {
      setFloatingEvents((prev) => [...prev, ...additions]);
    }
  }, [tickIndex, race]);

  // Garbage-collect floating events older than 1.4s.
  useEffect(() => {
    if (floatingEvents.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setFloatingEvents((prev) => prev.filter((ev) => now - ev.spawnedAt < 1400));
    }, 200);
    return () => clearTimeout(t);
  }, [floatingEvents]);

  // Draw the static track surface once when the race loads.
  useEffect(() => {
    if (!race || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    drawScene({ ctx, district: race.district ?? "" });
  }, [race]);

  // Finish-line celebration when the race completes.
  useEffect(() => {
    if (!completed || !race || !containerRef.current) return;
    const winner = race.result.winnerUid;
    const isViewerWinner = winner !== null && winner === user?.uid;
    spawnCelebrationBurst(containerRef.current);
    if (winner === null) return;
    if (isViewerWinner) sfxBattleWin(); else sfxBattleLose();
  }, [completed, race, user]);

  const isParticipant = useMemo(() => {
    if (!race || !user) return false;
    return race.challengerUid === user.uid || race.defenderUid === user.uid;
  }, [race, user]);
  const trackHelpers = useMemo(
    () => createTrackHelpers(race?.district ?? ""),
    [race?.district],
  );

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
  const chPos = offsetTrackPoint(tk.challengerProgress % 1, -10);
  const defPos = offsetTrackPoint(tk.defenderProgress % 1, 10);
  const chLeftPct = (chPos.x / CANVAS_WIDTH) * 100;
  const chTopPct  = (chPos.y / CANVAS_HEIGHT) * 100;
  const chAngleDeg = (chPos.angle * 180) / Math.PI;
  const chTiltY = tiltYFromSpeed(tk.challengerSpeed);

  const defLeftPct = (defPos.x / CANVAS_WIDTH) * 100;
  const defTopPct  = (defPos.y / CANVAS_HEIGHT) * 100;
  const defAngleDeg = (defPos.angle * 180) / Math.PI;
  const defTiltY = tiltYFromSpeed(tk.defenderSpeed);

  const winnerSide = winner === race.challengerUid
    ? "challenger"
    : winner === race.defenderUid
      ? "defender"
      : null;

  return (
    <div className="page race-track-page" ref={containerRef}>
      <header className="race-track-header">
        <h1>🏁 Courier Race</h1>
        <p>
          <strong>{race.challenger.name}</strong> vs <strong>{race.defender.name}</strong>
          {race.ozzyWager > 0 && <span> · Wager: {race.ozzyWager} Ozzies</span>}
        </p>
      </header>

      <div className="race-track-canvas-wrap">
        <div className="race-track-canvas-inner">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="race-track-canvas"
            aria-label={`Race track: ${race.challenger.name} versus ${race.defender.name}`}
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
          <span className="race-hud-speed" title="Current speed">
            ⚡ {(tk.challengerSpeed * 1000).toFixed(2)}
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
          <span className="race-hud-speed" title="Current speed">
            ⚡ {(tk.defenderSpeed * 1000).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="race-track-controls">
        {!running && !completed && (
          <button className="btn-primary" onClick={start}>▶ Start race</button>
        )}
        {running && <span className="race-track-status">Racing…</span>}
        {completed && (
          <>
            <button className="btn-outline" onClick={() => { setTickIndex(0); setCompleted(false); start(); }}>
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
        <div className="race-result-panel">
          <h2>
            {winnerSide === null
              ? "🤝 It's a draw!"
              : winnerSide === "challenger"
                ? `🏆 ${race.challenger.name} wins!`
                : `🏆 ${race.defender.name} wins!`}
          </h2>
          {districtDisplayName && (
            <p style={{ margin: "0 0 0.75rem", opacity: 0.88 }}>
              🏁 Raced in: {districtDisplayName}
            </p>
          )}
          <ul className="race-result-list">
            <li>
              <strong>{race.challenger.name}</strong>
              {`: ${race.result.cardDeltas.challenger.ozzies >= 0 ? "+" : ""}${race.result.cardDeltas.challenger.ozzies} Ozzies, +${race.result.cardDeltas.challenger.xp} XP`}
              {race.result.winnerStatBoost && winnerSide === "challenger" && (
                <span> · +1 {race.result.winnerStatBoost.stat}</span>
              )}
            </li>
            <li>
              <strong>{race.defender.name}</strong>
              {`: ${race.result.cardDeltas.defender.ozzies >= 0 ? "+" : ""}${race.result.cardDeltas.defender.ozzies} Ozzies, +${race.result.cardDeltas.defender.xp} XP`}
              {race.result.winnerStatBoost && winnerSide === "defender" && (
                <span> · +1 {race.result.winnerStatBoost.stat}</span>
              )}
            </li>
          </ul>
          {!isParticipant && (
            <p className="race-result-spectator">You weren't in this race — viewing as a spectator.</p>
          )}
        </div>
      )}
    </div>
  );
}
