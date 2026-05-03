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

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 360;
const PADDING = 60;

/** Parametric oval circuit: returns {x, y, tangentAngle} for u ∈ [0, 1]. */
function trackPoint(u: number) {
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const rx = (CANVAS_WIDTH - PADDING * 2) / 2;
  const ry = (CANVAS_HEIGHT - PADDING * 2) / 2;
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

interface DrawArgs {
  ctx: CanvasRenderingContext2D;
}

/** Draw the static track surface onto the canvas. Called once per race load. */
function drawScene({ ctx }: DrawArgs) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Backdrop — Sk8rpunk dusk gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, "#1b0e2e");
  grad.addColorStop(1, "#070314");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // City-block grid background.
  ctx.strokeStyle = "rgba(120, 70, 200, 0.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
  }

  // Track surface — thick oval ring.
  ctx.lineWidth = 44;
  ctx.strokeStyle = "rgba(40, 30, 60, 0.95)";
  ctx.beginPath();
  for (let i = 0; i <= 200; i += 1) {
    const u = i / 200;
    const { x, y } = trackPoint(u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Lane markers.
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "rgba(255, 220, 70, 0.55)";
  ctx.beginPath();
  for (let i = 0; i <= 200; i += 1) {
    const u = i / 200;
    const { x, y } = trackPoint(u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
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
  // Checker pattern hint.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 4; i += 1) {
    const c = offsetTrackPoint(0, -18 + i * 12);
    ctx.fillRect(c.x - 4, c.y - 4, 8, 8);
  }

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
    drawScene({ ctx });
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

  if (loading) {
    return <div className="page race-track-page"><p>Loading race…</p></div>;
  }
  if (error) {
    return <div className="page race-track-page"><p className="race-arena-error">{error}</p>
      <Link to="/arena" className="btn-primary">Back to Race Arena</Link></div>;
  }
  if (!race) return null;

  const tk = race.timeline[tickIndex];
  const winner = race.result.winnerUid;

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
            variant="challenger"
          />
          <RaceCard3D
            card={race.defender}
            leftPct={defLeftPct}
            topPct={defTopPct}
            angleDeg={defAngleDeg}
            tiltX={20}
            tiltY={defTiltY}
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
