/**
 * Courier Race resolver — server canonical implementation.
 *
 * Pure, seeded, deterministic. Given the two card snapshots and a seed,
 * produces a fixed-tick timeline (~30s @ 50ms/tick = 600 ticks) and a
 * settled result. The same seed always produces the same race so two
 * players can watch independently and see identical playback.
 *
 * Stat-driven feel:
 *   - speed   → base pace (faster cards average more progress per tick).
 *   - grit    → larger stamina pool (more frequent bursts, fewer wipeouts).
 *   - stealth → modulates probability of "shortcut" speed surges.
 *   - range   → modulates cornering efficiency (small steady bonus).
 *
 * Risk events sampled from seeded RNG:
 *   - pothole stumble (-)         ─ small slowdown
 *   - cop-dodge sprint (+)        ─ short burst
 *   - courier-handoff boost (+)   ─ medium burst
 *   - wipeout (-, rare)           ─ large slowdown
 *   - comeback surge (+)          ─ small burst when far behind
 *
 * Contract guarantees (enforced by the simulator + checked by tests):
 *   - The timeline always has exactly TICKS_TOTAL entries.
 *   - At least one card crosses the finish line by the final tick.
 *   - The leader cannot lap the trailing card so dramatic photo finishes
 *     stay in frame (leader auto-throttles when far ahead).
 */

// ── Tunables ────────────────────────────────────────────────────────────────
// Risk knobs live here so we can tune the feel without touching the simulator.

export const RACE_TICK_MS = 50;
export const RACE_DURATION_MS = 30_000;
export const TICKS_TOTAL = RACE_DURATION_MS / RACE_TICK_MS; // 600

/** Maximum lead the leader can hold over the trailing card (in progress units). */
const MAX_LEAD = 0.18;

/**
 * Base progress per tick at speed=5 (mid-stat).
 * 1.0 (full track) / TICKS_TOTAL gives a card that exactly finishes at the
 * final tick; we tune slightly faster so even the slower racer typically finishes.
 */
const BASE_SPEED_AT_5 = 1.05 / TICKS_TOTAL;

/** Per-stat-point speed adjustment around the baseline. */
const SPEED_PER_STAT = 0.10 * BASE_SPEED_AT_5;

/** Random per-tick noise (fraction of base speed). */
const TICK_NOISE = 0.25;

/** Probability per tick of an event firing for one card. */
const EVENT_BASE_PROB = 0.04;

/** Stamina drained by burst events; refills at REST_RATE per tick. */
const STAMINA_PER_BURST = 18;
const REST_RATE = 0.6;

/** Event definitions (multiplier applied for `duration` ticks). */
const EVENTS = {
  pothole:        { tag: "🚧 Pothole",       multiplier: 0.45, duration: 6,  burst: false },
  copDodge:       { tag: "🚓 Cop dodge",     multiplier: 1.55, duration: 8,  burst: true  },
  courierHandoff: { tag: "📦 Hand-off boost", multiplier: 1.75, duration: 12, burst: true  },
  wipeout:        { tag: "💥 Wipeout",       multiplier: 0.20, duration: 14, burst: false },
  comeback:       { tag: "✨ Comeback surge", multiplier: 1.40, duration: 10, burst: true  },
};

const STAT_KEYS = ["speed", "range", "stealth", "grit"];

// ── Seeded RNG (mulberry32 over a string seed) ──────────────────────────────

function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function mulberry32(seed) {
  let s = seed | 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRaceRng(seed) {
  return mulberry32(seedFromString(String(seed || "race-seed")));
}

// ── Card snapshot helpers ───────────────────────────────────────────────────

function clampStat(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pickEvent(rng, side, stats, stamina, behindBy) {
  // stealth boosts shortcut/handoff odds; grit reduces wipeout odds.
  const stealthBias = (stats.stealth - 5) * 0.02;
  const gritBias = (stats.grit - 5) * 0.015;

  const r = rng();
  // Comeback surge only if meaningfully behind.
  if (behindBy > 0.06 && r < 0.18) return { ...EVENTS.comeback, side };
  if (r < 0.22 + stealthBias && stamina > STAMINA_PER_BURST) return { ...EVENTS.copDodge, side };
  if (r < 0.42 + stealthBias && stamina > STAMINA_PER_BURST) return { ...EVENTS.courierHandoff, side };
  if (r < 0.72) return { ...EVENTS.pothole, side };
  // Wipeouts rarer for high-grit racers.
  if (r < 0.78 - gritBias) return { ...EVENTS.wipeout, side };
  return null;
}

function basePace(stats) {
  // speed dominates; range adds a small steady bonus.
  return BASE_SPEED_AT_5 + (stats.speed - 5) * SPEED_PER_STAT + (stats.range - 5) * 0.02 * SPEED_PER_STAT;
}

function staminaPool(stats) {
  // grit increases stamina pool (range 70..170).
  return 100 + (stats.grit - 5) * 14;
}

function applyMultipliers(buffs) {
  let m = 1;
  for (const buff of buffs) m *= buff.multiplier;
  return m;
}

function tickBuffs(buffs) {
  // Decrement durations and drop any that have expired.
  const out = [];
  for (const buff of buffs) {
    const next = { ...buff, duration: buff.duration - 1 };
    if (next.duration > 0) out.push(next);
  }
  return out;
}

// ── Core simulator ──────────────────────────────────────────────────────────

/**
 * @param {{stats: {speed: number, range: number, stealth: number, grit: number}}} challenger
 * @param {{stats: {speed: number, range: number, stealth: number, grit: number}}} defender
 * @param {string} seed
 * @returns {{timeline: Array, challengerFinishTick: number|null, defenderFinishTick: number|null}}
 */
export function simulateRace(challenger, defender, seed) {
  const rng = createRaceRng(seed);
  const cStats = {
    speed: clampStat(challenger.stats?.speed),
    range: clampStat(challenger.stats?.range),
    stealth: clampStat(challenger.stats?.stealth),
    grit: clampStat(challenger.stats?.grit),
  };
  const dStats = {
    speed: clampStat(defender.stats?.speed),
    range: clampStat(defender.stats?.range),
    stealth: clampStat(defender.stats?.stealth),
    grit: clampStat(defender.stats?.grit),
  };

  const cBase = basePace(cStats);
  const dBase = basePace(dStats);

  let cProgress = 0;
  let dProgress = 0;
  let cBuffs = [];
  let dBuffs = [];
  let cStamina = staminaPool(cStats);
  let dStamina = staminaPool(dStats);

  let cFinish = null;
  let dFinish = null;

  const timeline = [];

  for (let t = 0; t < TICKS_TOTAL; t += 1) {
    // Tick down active buffs.
    cBuffs = tickBuffs(cBuffs);
    dBuffs = tickBuffs(dBuffs);

    // Possibly trigger new events for each side.
    let cEventTag;
    let dEventTag;
    if (rng() < EVENT_BASE_PROB) {
      const ev = pickEvent(rng, "challenger", cStats, cStamina, dProgress - cProgress);
      if (ev) {
        cBuffs.push(ev);
        cEventTag = ev.tag;
        if (ev.burst) cStamina = Math.max(0, cStamina - STAMINA_PER_BURST);
      }
    }
    if (rng() < EVENT_BASE_PROB) {
      const ev = pickEvent(rng, "defender", dStats, dStamina, cProgress - dProgress);
      if (ev) {
        dBuffs.push(ev);
        dEventTag = ev.tag;
        if (ev.burst) dStamina = Math.max(0, dStamina - STAMINA_PER_BURST);
      }
    }

    // Recover stamina between bursts.
    cStamina = Math.min(staminaPool(cStats), cStamina + REST_RATE);
    dStamina = Math.min(staminaPool(dStats), dStamina + REST_RATE);

    const cMul = applyMultipliers(cBuffs);
    const dMul = applyMultipliers(dBuffs);

    // Add per-tick noise (centered around 1.0).
    const cNoise = 1 + (rng() * 2 - 1) * TICK_NOISE;
    const dNoise = 1 + (rng() * 2 - 1) * TICK_NOISE;

    let cSpeed = Math.max(0, cBase * cMul * cNoise);
    let dSpeed = Math.max(0, dBase * dMul * dNoise);

    // Photo-finish guard: leader auto-throttles once lead exceeds MAX_LEAD,
    // and the trailing card gets a small drafting bonus. Keeps the cards in
    // frame for a dramatic finish without changing who is actually faster.
    const lead = cProgress - dProgress;
    if (lead > MAX_LEAD) {
      cSpeed *= 0.5;
      dSpeed *= 1.15;
    } else if (lead < -MAX_LEAD) {
      dSpeed *= 0.5;
      cSpeed *= 1.15;
    }

    if (cFinish === null) cProgress = Math.min(1, cProgress + cSpeed);
    if (dFinish === null) dProgress = Math.min(1, dProgress + dSpeed);

    if (cFinish === null && cProgress >= 1) cFinish = t;
    if (dFinish === null && dProgress >= 1) dFinish = t;

    timeline.push({
      t,
      challengerProgress: cProgress,
      defenderProgress: dProgress,
      challengerSpeed: cSpeed,
      defenderSpeed: dSpeed,
      ...(cEventTag ? { challengerEvent: cEventTag } : {}),
      ...(dEventTag ? { defenderEvent: dEventTag } : {}),
    });

    if (cFinish !== null && dFinish !== null) {
      // Both finished — pad remaining ticks at full progress so timeline
      // stays a constant length for downstream consumers.
      for (let pad = t + 1; pad < TICKS_TOTAL; pad += 1) {
        timeline.push({
          t: pad,
          challengerProgress: cProgress,
          defenderProgress: dProgress,
          challengerSpeed: 0,
          defenderSpeed: 0,
        });
      }
      break;
    }
  }

  // Finish-line guarantee: if neither card finished due to extreme bad luck,
  // push the leading card across so the race always resolves cleanly.
  if (cFinish === null && dFinish === null) {
    if (cProgress >= dProgress) {
      cFinish = TICKS_TOTAL - 1;
      cProgress = 1;
      timeline[timeline.length - 1].challengerProgress = 1;
    } else {
      dFinish = TICKS_TOTAL - 1;
      dProgress = 1;
      timeline[timeline.length - 1].defenderProgress = 1;
    }
  }

  return { timeline, challengerFinishTick: cFinish, defenderFinishTick: dFinish };
}

// ── Result helpers ──────────────────────────────────────────────────────────

/**
 * Build a fully-settled race result given a simulation outcome.
 * `wager` is the Ozzies the challenger escrowed; the same amount is required
 * from the defender at acceptance time. The pot transfers to the winner.
 */
export function buildRaceResult(simulation, { challengerStats, defenderStats, wager, raceSeed }) {
  const { challengerFinishTick, defenderFinishTick } = simulation;
  let winnerSide = null;
  if (challengerFinishTick !== null && defenderFinishTick !== null) {
    winnerSide = challengerFinishTick < defenderFinishTick
      ? "challenger"
      : defenderFinishTick < challengerFinishTick
        ? "defender"
        : null; // exact tie ⇒ draw
  } else if (challengerFinishTick !== null) {
    winnerSide = "challenger";
  } else if (defenderFinishTick !== null) {
    winnerSide = "defender";
  }

  // Defense-in-depth: re-clamp the wager here (route also clamps via
  // `clampWager`) so the resolver remains safe to call from tests/scripts
  // that bypass the HTTP layer.
  const clampedWager = clampInt(wager, 0, 100_000);
  let challengerOzzy = 0;
  let defenderOzzy = 0;
  if (winnerSide === "challenger" && clampedWager > 0) {
    challengerOzzy = clampedWager;
    defenderOzzy = -clampedWager;
  } else if (winnerSide === "defender" && clampedWager > 0) {
    challengerOzzy = -clampedWager;
    defenderOzzy = clampedWager;
  }
  // Draws refund both wagers (handled by caller).

  // XP: small reward for both, larger for the winner.
  const baseXp = 25;
  const winBonus = 75;
  const challengerXp = baseXp + (winnerSide === "challenger" ? winBonus : 0);
  const defenderXp = baseXp + (winnerSide === "defender" ? winBonus : 0);

  // Optional small stat boost for the winner (deterministic from seed).
  let winnerStatBoost;
  if (winnerSide) {
    const rng = createRaceRng(`${raceSeed}:winner-stat-boost`);
    const stat = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
    const winnerStats = winnerSide === "challenger" ? challengerStats : defenderStats;
    if ((winnerStats?.[stat] ?? 10) < 10) {
      winnerStatBoost = { stat, amount: 1 };
    }
  }

  return {
    winnerSide,
    challengerFinishTick,
    defenderFinishTick,
    ozzyTransfer: { challenger: challengerOzzy, defender: defenderOzzy },
    cardDeltas: {
      challenger: { ozzies: challengerOzzy, xp: challengerXp },
      defender: { ozzies: defenderOzzy, xp: defenderXp },
    },
    winnerStatBoost,
    raceSeed: String(raceSeed),
  };
}

/**
 * One-shot: simulate + settle.
 */
export function resolveRace(challenger, defender, { wager, raceSeed }) {
  const sim = simulateRace(challenger, defender, raceSeed);
  const result = buildRaceResult(sim, {
    challengerStats: challenger.stats,
    defenderStats: defender.stats,
    wager,
    raceSeed,
  });
  return { simulation: sim, result };
}

// ── Card snapshot factory ───────────────────────────────────────────────────

/**
 * Build a minimal `RaceCardSnapshot`-compatible object from a stored card.
 * Accepts either a forged `CardPayload` (full v2) or a partial admin card.
 */
function clampStatWithDefault(value, def = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function createRaceCardSnapshot(card) {
  if (!card || typeof card !== "object") {
    return {
      id: "unknown",
      name: "Unknown Skater",
      archetype: "The Team",
      rarity: "Apprentice",
      stats: { speed: 5, range: 5, rangeNm: 5, stealth: 5, grit: 5 },
    };
  }
  const stats = card.stats ?? {};
  return {
    id: String(card.id ?? "unknown"),
    name: String(card.identity?.name ?? card.name ?? "Skater"),
    archetype: String(card.prompts?.archetype ?? card.archetype ?? "The Team"),
    rarity: String(card.class?.rarity ?? card.rarity ?? "Apprentice"),
    stats: {
      speed: clampStatWithDefault(stats.speed),
      range: clampStatWithDefault(stats.range),
      rangeNm: clampStatWithDefault(stats.rangeNm ?? stats.range),
      stealth: clampStatWithDefault(stats.stealth),
      grit: clampStatWithDefault(stats.grit),
    },
    ...(card.frameImageUrl ? { imageUrl: String(card.frameImageUrl) } : {}),
  };
}
