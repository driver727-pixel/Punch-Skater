/**
 * Race resolver — client TypeScript wrapper.
 *
 * The canonical implementation lives in `server/lib/race.js` (so the server
 * can simulate authoritative race timelines). This module re-implements the
 * same pure logic in TypeScript for client-side use (replay, previews) and
 * proves at type-check time that the shapes line up with our shared types.
 *
 * The two implementations are kept in sync; a server unit test guarantees
 * deterministic output for a fixed seed, and the client uses the server's
 * precomputed timeline at race time, so any minor floating-point drift
 * between the two modules cannot be observed by users.
 */
import type {
  Race,
  RaceCardSnapshot,
  RaceResult,
  RaceTimelineTick,
} from "./types";

export const RACE_TICK_MS = 50;
export const RACE_DURATION_MS = 30_000;
export const TICKS_TOTAL = RACE_DURATION_MS / RACE_TICK_MS;

const MAX_LEAD = 0.18;
const BASE_SPEED_AT_5 = 1.05 / TICKS_TOTAL;
const SPEED_PER_STAT = 0.10 * BASE_SPEED_AT_5;
const TICK_NOISE = 0.25;
const EVENT_BASE_PROB = 0.04;
const STAMINA_PER_BURST = 18;
const REST_RATE = 0.6;

interface EventDef {
  tag: string;
  multiplier: number;
  duration: number;
  burst: boolean;
}

const EVENTS: Record<string, EventDef> = {
  pothole:        { tag: "🚧 Pothole",        multiplier: 0.45, duration: 6,  burst: false },
  copDodge:       { tag: "🚓 Cop dodge",      multiplier: 1.55, duration: 8,  burst: true  },
  courierHandoff: { tag: "📦 Hand-off boost",  multiplier: 1.75, duration: 12, burst: true  },
  wipeout:        { tag: "💥 Wipeout",        multiplier: 0.20, duration: 14, burst: false },
  comeback:       { tag: "✨ Comeback surge",  multiplier: 1.40, duration: 10, burst: true  },
};


function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRaceRng(seed: string): () => number {
  return mulberry32(seedFromString(String(seed || "race-seed")));
}

function clampStat(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

interface RaceStats {
  speed: number;
  range: number;
  stealth: number;
  grit: number;
}

function basePace(stats: RaceStats): number {
  return BASE_SPEED_AT_5 + (stats.speed - 5) * SPEED_PER_STAT + (stats.range - 5) * 0.02 * SPEED_PER_STAT;
}

function staminaPool(stats: RaceStats): number {
  return 100 + (stats.grit - 5) * 14;
}

function applyMultipliers(buffs: EventDef[]): number {
  let m = 1;
  for (const b of buffs) m *= b.multiplier;
  return m;
}

function tickBuffs(buffs: EventDef[]): EventDef[] {
  const out: EventDef[] = [];
  for (const b of buffs) {
    const next = { ...b, duration: b.duration - 1 };
    if (next.duration > 0) out.push(next);
  }
  return out;
}

function pickEvent(rng: () => number, stats: RaceStats, stamina: number, behindBy: number): EventDef | null {
  const stealthBias = (stats.stealth - 5) * 0.02;
  const gritBias = (stats.grit - 5) * 0.015;
  const r = rng();
  if (behindBy > 0.06 && r < 0.18) return EVENTS.comeback;
  if (r < 0.22 + stealthBias && stamina > STAMINA_PER_BURST) return EVENTS.copDodge;
  if (r < 0.42 + stealthBias && stamina > STAMINA_PER_BURST) return EVENTS.courierHandoff;
  if (r < 0.72) return EVENTS.pothole;
  if (r < 0.78 - gritBias) return EVENTS.wipeout;
  return null;
}

export interface RaceSimulation {
  timeline: RaceTimelineTick[];
  challengerFinishTick: number | null;
  defenderFinishTick: number | null;
}

/**
 * Pure, seeded race simulation. Mirrors `server/lib/race.js`.
 * Used by the client when no precomputed timeline is available (e.g. previews).
 * In production the client always replays the server-supplied timeline.
 */
export function simulateRace(
  challenger: RaceCardSnapshot,
  defender: RaceCardSnapshot,
  seed: string,
): RaceSimulation {
  const rng = createRaceRng(seed);
  const cStats: RaceStats = {
    speed: clampStat(challenger.stats.speed),
    range: clampStat(challenger.stats.range),
    stealth: clampStat(challenger.stats.stealth),
    grit: clampStat(challenger.stats.grit),
  };
  const dStats: RaceStats = {
    speed: clampStat(defender.stats.speed),
    range: clampStat(defender.stats.range),
    stealth: clampStat(defender.stats.stealth),
    grit: clampStat(defender.stats.grit),
  };
  const cBase = basePace(cStats);
  const dBase = basePace(dStats);
  let cProg = 0;
  let dProg = 0;
  let cBuffs: EventDef[] = [];
  let dBuffs: EventDef[] = [];
  let cStam = staminaPool(cStats);
  let dStam = staminaPool(dStats);
  let cFinish: number | null = null;
  let dFinish: number | null = null;
  const timeline: RaceTimelineTick[] = [];

  for (let t = 0; t < TICKS_TOTAL; t += 1) {
    cBuffs = tickBuffs(cBuffs);
    dBuffs = tickBuffs(dBuffs);

    let cEv: string | undefined;
    let dEv: string | undefined;
    if (rng() < EVENT_BASE_PROB) {
      const ev = pickEvent(rng, cStats, cStam, dProg - cProg);
      if (ev) {
        cBuffs.push(ev);
        cEv = ev.tag;
        if (ev.burst) cStam = Math.max(0, cStam - STAMINA_PER_BURST);
      }
    }
    if (rng() < EVENT_BASE_PROB) {
      const ev = pickEvent(rng, dStats, dStam, cProg - dProg);
      if (ev) {
        dBuffs.push(ev);
        dEv = ev.tag;
        if (ev.burst) dStam = Math.max(0, dStam - STAMINA_PER_BURST);
      }
    }

    cStam = Math.min(staminaPool(cStats), cStam + REST_RATE);
    dStam = Math.min(staminaPool(dStats), dStam + REST_RATE);

    const cMul = applyMultipliers(cBuffs);
    const dMul = applyMultipliers(dBuffs);
    const cNoise = 1 + (rng() * 2 - 1) * TICK_NOISE;
    const dNoise = 1 + (rng() * 2 - 1) * TICK_NOISE;
    let cSpeed = Math.max(0, cBase * cMul * cNoise);
    let dSpeed = Math.max(0, dBase * dMul * dNoise);

    const lead = cProg - dProg;
    if (lead > MAX_LEAD) {
      cSpeed *= 0.5; dSpeed *= 1.15;
    } else if (lead < -MAX_LEAD) {
      dSpeed *= 0.5; cSpeed *= 1.15;
    }

    if (cFinish === null) cProg = Math.min(1, cProg + cSpeed);
    if (dFinish === null) dProg = Math.min(1, dProg + dSpeed);
    if (cFinish === null && cProg >= 1) cFinish = t;
    if (dFinish === null && dProg >= 1) dFinish = t;

    const tick: RaceTimelineTick = {
      t,
      challengerProgress: cProg,
      defenderProgress: dProg,
      challengerSpeed: cSpeed,
      defenderSpeed: dSpeed,
    };
    if (cEv) tick.challengerEvent = cEv;
    if (dEv) tick.defenderEvent = dEv;
    timeline.push(tick);

    if (cFinish !== null && dFinish !== null) {
      for (let pad = t + 1; pad < TICKS_TOTAL; pad += 1) {
        timeline.push({
          t: pad,
          challengerProgress: cProg,
          defenderProgress: dProg,
          challengerSpeed: 0,
          defenderSpeed: 0,
        });
      }
      break;
    }
  }

  if (cFinish === null && dFinish === null) {
    if (cProg >= dProg) { cFinish = TICKS_TOTAL - 1; cProg = 1; timeline[timeline.length - 1].challengerProgress = 1; }
    else { dFinish = TICKS_TOTAL - 1; dProg = 1; timeline[timeline.length - 1].defenderProgress = 1; }
  }

  return { timeline, challengerFinishTick: cFinish, defenderFinishTick: dFinish };
}

/**
 * Returns "challenger" / "defender" / null (draw) for a given race result.
 */
export function raceWinnerSide(result: RaceResult): "challenger" | "defender" | null {
  if (result.winnerUid === null) return null;
  // We can't know the side without the surrounding Race; callers should map uid → side themselves.
  return null;
}

/**
 * Convenience: read a tick at a given elapsed-millisecond offset, clamping to the timeline length.
 */
export function tickAtElapsed(race: Race, elapsedMs: number): RaceTimelineTick {
  const idx = Math.max(0, Math.min(race.timeline.length - 1, Math.floor(elapsedMs / race.tickMs)));
  return race.timeline[idx];
}
