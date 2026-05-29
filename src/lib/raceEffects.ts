/**
 * Race event particle bursts.
 *
 * Spawns a short-lived burst of particles at a racer's on-track position so
 * each named timeline event (pothole, cop-dodge, hand-off boost, wipeout,
 * comeback surge) reads as a distinct on-screen spectacle. The burst is purely
 * decorative — it appends absolutely-positioned spans into the supplied
 * container (which must be `position: relative`) and removes them when the
 * animation finishes.
 */

export type RaceEventEffectKind =
  | "pothole"
  | "copDodge"
  | "courierHandoff"
  | "wipeout"
  | "comeback";

interface EffectSpec {
  colors: string[];
  particles: number;
  spread: number;
  size: [number, number];
  durationMs: number;
  /** Bias the burst direction: -1 mostly down, 0 radial, 1 mostly up. */
  lift: number;
}

const EFFECT_SPECS: Record<RaceEventEffectKind, EffectSpec> = {
  pothole: {
    colors: ["#b9a07a", "#8a7458", "#d8c7a6", "#6f5c44"],
    particles: 12,
    spread: 34,
    size: [3, 6],
    durationMs: 650,
    lift: -0.4,
  },
  copDodge: {
    colors: ["#9fe8ff", "#ffffff", "#44ddff", "#bdf3ff"],
    particles: 16,
    spread: 46,
    size: [3, 7],
    durationMs: 700,
    lift: 0.2,
  },
  courierHandoff: {
    colors: ["#9dff7a", "#ffdd55", "#caffa6", "#7bff44"],
    particles: 18,
    spread: 52,
    size: [4, 8],
    durationMs: 780,
    lift: 0.6,
  },
  wipeout: {
    colors: ["#ff8844", "#ff4422", "#ffcc55", "#aa3311"],
    particles: 26,
    spread: 74,
    size: [4, 10],
    durationMs: 900,
    lift: 0.1,
  },
  comeback: {
    colors: ["#ffe27a", "#fff3c4", "#ffd24a", "#ffffff"],
    particles: 22,
    spread: 58,
    size: [3, 8],
    durationMs: 950,
    lift: 0.9,
  },
};

/**
 * Classify a server event tag (e.g. "🚧 Pothole", "📦 Hand-off boost") into a
 * canonical effect kind. The server emits the human-readable tag in the
 * timeline; this keeps the visual/audio mapping in one place. Returns null for
 * unrecognised tags so callers can skip gracefully.
 */
export function classifyRaceEvent(tag?: string | null): RaceEventEffectKind | null {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (t.includes("pothole")) return "pothole";
  if (t.includes("cop")) return "copDodge";
  if (t.includes("hand-off") || t.includes("handoff") || t.includes("hand off")) return "courierHandoff";
  if (t.includes("wipeout")) return "wipeout";
  if (t.includes("comeback")) return "comeback";
  return null;
}

/** Whether an event kind is a dramatic, slow-mo-worthy beat. */
export function isMajorRaceEvent(kind: RaceEventEffectKind | null): boolean {
  return kind === "wipeout" || kind === "comeback" || kind === "courierHandoff";
}

function randIn([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

/**
 * Spawn a positioned event burst inside `container` at `leftPct`/`topPct`
 * (percentages of the container box, matching the racing-card coordinate space).
 */
export function spawnRaceEventBurst(
  container: HTMLElement,
  {
    leftPct,
    topPct,
    kind,
  }: { leftPct: number; topPct: number; kind: RaceEventEffectKind },
) {
  const spec = EFFECT_SPECS[kind];
  if (!spec) return;

  const spawned: HTMLSpanElement[] = [];
  for (let i = 0; i < spec.particles; i += 1) {
    const particle = document.createElement("span");
    particle.className = `race-burst-particle race-burst-particle--${kind}`;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * spec.spread;
    const dx = Math.cos(angle) * dist;
    // Lift biases vertical travel upward (negative y) for surges, downward for debris.
    const dy = Math.sin(angle) * dist - spec.lift * spec.spread;
    const color = spec.colors[Math.floor(Math.random() * spec.colors.length)];
    particle.style.left = `${leftPct}%`;
    particle.style.top = `${topPct}%`;
    particle.style.setProperty("--bx", `${dx.toFixed(1)}px`);
    particle.style.setProperty("--by", `${dy.toFixed(1)}px`);
    particle.style.setProperty("--bd", `${spec.durationMs}ms`);
    particle.style.setProperty("--bs", `${randIn(spec.size).toFixed(1)}px`);
    particle.style.setProperty("--br", `${(Math.random() * 540 - 270).toFixed(0)}deg`);
    particle.style.backgroundColor = color;
    particle.style.setProperty("--bglow", color);
    container.appendChild(particle);
    spawned.push(particle);
  }

  window.setTimeout(() => {
    spawned.forEach((p) => p.remove());
  }, spec.durationMs + 60);
}
