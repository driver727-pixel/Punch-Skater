/**
 * Centralized sound-effects module using the Web Audio API.
 *
 * Every helper is fire-and-forget and silently swallows errors so that a
 * missing AudioContext (e.g. server-side rendering, or browsers that have not
 * yet received a user gesture) never breaks the app.
 */

import type { RaceEventEffectKind } from "./raceEffects";

// ── Shared AudioContext (lazy singleton) ────────────────────────────────────

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

// ── Low-level oscillator helpers ────────────────────────────────────────────

function osc(
  type: OscillatorType,
  setup: (o: OscillatorNode, g: GainNode, c: AudioContext) => void,
) {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.connect(g);
    g.connect(c.destination);
    setup(o, g, c);
  } catch {
    /* Audio unavailable – silently ignore */
  }
}

/**
 * Schedules a single musical layer relative to the current AudioContext time.
 * Unlike `osc`, this helper handles delayed starts plus the standard fade-out
 * envelope so higher-level fanfares can stack several tones at once.
 */
function layeredTone(
  type: OscillatorType,
  startAt: number,
  duration: number,
  frequency: number,
  gain: number,
  endFrequency?: number,
) {
  osc(type, (o, g, c) => {
    const now = c.currentTime;
    const t = now + startAt;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.frequency.setValueAtTime(frequency, t);
    if (endFrequency && endFrequency !== frequency) {
      o.frequency.exponentialRampToValueAtTime(endFrequency, t + duration);
    }
    o.start(t);
    o.stop(t + duration);
  });
}

// ── Play a wav file from the public/assets/sounds directory ─────────────────

function playFile(path: string) {
  try {
    new Audio(path).play().catch(() => {/* autoplay blocked */});
  } catch {
    /* Audio unavailable */
  }
}

// ── Public SFX catalogue ────────────────────────────────────────────────────

/** Board Builder – "Lock It In" button stamp sound (wav file). */
export function sfxLockItIn() {
  playFile("/assets/sounds/lock-it-in.wav");
}

/** Card Forge – forge button success ping (wav file). */
export function sfxSuccessPing() {
  playFile("/assets/sounds/successping.wav");
}

/** Soft click / pop – card selection, tab switches, small UI interactions. */
export function sfxClick() {
  osc("square", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    o.start(t);
    o.stop(t + 0.055);
  });
  osc("sawtooth", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(3200, t);
    o.frequency.exponentialRampToValueAtTime(1600, t + 0.025);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.start(t);
    o.stop(t + 0.03);
  });
}

/** Positive confirmation – save, add to deck, trade accepted, deck created. */
export function sfxSuccess() {
  osc("sine", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(660, t);
    o.frequency.setValueAtTime(880, t + 0.1);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.start(t);
    o.stop(t + 0.25);
  });
}

/** Negative / removal – card removed, trade declined, delete. */
export function sfxRemove() {
  osc("triangle", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.15);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.start(t);
    o.stop(t + 0.2);
  });
}

/** Whoosh – navigate, send trade, page transition. */
export function sfxNavigate() {
  osc("sawtooth", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.1);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.start(t);
    o.stop(t + 0.14);
  });
  osc("square", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(2000, t + 0.08);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.start(t);
    o.stop(t + 0.1);
  });
}

// ── Battle-specific SFX (moved from BattleArena.tsx) ────────────────────────

/** Battle ready – ascending blip. */
export function sfxBattleReady() {
  osc("sine", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    o.start(t);
    o.stop(t + 0.3);
  });
}

/** Battle clash – aggressive descending saw. */
export function sfxBattleClash() {
  osc("sawtooth", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    o.start(t);
    o.stop(t + 0.6);
  });
}

/** Battle win – exciting multi-layered cyberpunk victory fanfare. */
export function sfxBattleWin() {
  // Punchy bass hit
  layeredTone("sawtooth", 0, 0.12, 110, 0.18, 55);
  // Rising power chord layers
  layeredTone("square", 0, 0.22, 523, 0.14);
  layeredTone("square", 0.08, 0.22, 659, 0.13);
  layeredTone("square", 0.16, 0.24, 784, 0.13);
  layeredTone("square", 0.24, 0.22, 1047, 0.12);
  // Sparkling high-end shimmer
  layeredTone("triangle", 0, 0.65, 262, 0.09, 523);
  layeredTone("triangle", 0.3, 0.4, 1047, 0.1, 1568);
  layeredTone("sine", 0.42, 0.35, 1568, 0.06, 2093);
  layeredTone("sine", 0.5, 0.28, 2637, 0.04, 3136);
  // Final triumphant accent
  layeredTone("square", 0.46, 0.3, 1319, 0.1, 1760);
  layeredTone("sawtooth", 0.52, 0.25, 880, 0.07, 1760);
}

/** Battle lose – dramatic cyberpunk failure sting. */
export function sfxBattleLose() {
  // Heavy low impact thud
  layeredTone("sawtooth", 0, 0.25, 180, 0.22, 60);
  // Dissonant descending layers
  layeredTone("triangle", 0, 0.5, 440, 0.18, 220);
  layeredTone("square", 0.06, 0.45, 370, 0.12, 155);
  layeredTone("sawtooth", 0.12, 0.4, 311, 0.1, 110);
  // Glitchy static bursts
  layeredTone("sawtooth", 0.18, 0.08, 1200, 0.07, 800);
  layeredTone("sawtooth", 0.28, 0.08, 950, 0.06, 600);
  // Fading low rumble
  layeredTone("triangle", 0.3, 0.55, 80, 0.12, 40);
}

/** Error / blocked action – short buzz. */
export function sfxError() {
  osc("sawtooth", (o, g, c) => {
    const t = c.currentTime;
    o.frequency.setValueAtTime(150, t);
    o.frequency.setValueAtTime(130, t + 0.06);
    o.frequency.setValueAtTime(150, t + 0.12);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t);
    o.stop(t + 0.18);
  });
}

/** Reward shower – bright pings for Ozzies, loot, and upgrades. */
export function sfxRewardShower() {
  layeredTone("triangle", 0, 0.18, 988, 0.09, 1175);
  layeredTone("sine", 0.1, 0.16, 1319, 0.07, 1568);
  layeredTone("triangle", 0.2, 0.2, 1760, 0.08, 2093);
  layeredTone("sine", 0.28, 0.12, 2637, 0.04);
}

/** CRT glitch – short chaotic burst imitating a CRT monitor glitch. */
export function sfxGlitch() {
  try {
    const c = ctx();
    const now = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const fadeStart = data.length * 0.6;
      const envelope = i < fadeStart ? 1 : 1 - (i - fadeStart) / (data.length * 0.4);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.6;
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(now);
    src.stop(now + 0.18);
    // Overlay rapid chaotic tone blips
    layeredTone("sawtooth", 0, 0.04, 2400, 0.06, 800);
    layeredTone("square", 0.03, 0.03, 3200, 0.05, 1600);
    layeredTone("sawtooth", 0.07, 0.04, 1600, 0.05, 400);
    layeredTone("square", 0.11, 0.03, 2800, 0.04, 1200);
  } catch {
    /* Audio unavailable – silently ignore */
  }
}

// ── Classic Race SFX ─────────────────────────────────────────────────────────

/**
 * Race start horn — a punchy two-tone klaxon used after the "3·2·1·GO!"
 * countdown to signal the off. Fire-and-forget.
 */
export function sfxRaceStartHorn() {
  layeredTone("sawtooth", 0, 0.22, 196, 0.16, 233);
  layeredTone("square", 0.02, 0.22, 392, 0.12, 466);
  layeredTone("sawtooth", 0.22, 0.34, 233, 0.16, 311);
  layeredTone("square", 0.24, 0.34, 466, 0.12, 622);
  layeredTone("triangle", 0.24, 0.4, 932, 0.05, 1245);
}

/**
 * Short countdown beep used for each "3 · 2 · 1" tick. Pass `go=true` for the
 * brighter, higher "GO!" accent.
 */
export function sfxRaceCountdownBeep(go = false) {
  osc("square", (o, g, c) => {
    const t = c.currentTime;
    const freq = go ? 1320 : 660;
    o.frequency.setValueAtTime(freq, t);
    if (go) o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
    g.gain.setValueAtTime(go ? 0.22 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (go ? 0.3 : 0.16));
    o.start(t);
    o.stop(t + (go ? 0.3 : 0.16));
  });
}

/**
 * Per-event race stinger. Maps a race event hazard kind to a short audio cue
 * so the player *hears* the difference between a wipeout and a hand-off boost.
 * Re-uses the canonical {@link RaceEventEffectKind} so the audio and visual
 * effect kinds never drift apart.
 */
export type RaceEventSfxKind = RaceEventEffectKind;

export function sfxRaceEvent(kind: RaceEventSfxKind) {
  switch (kind) {
    case "pothole":
      // Dull thud + rattle.
      layeredTone("triangle", 0, 0.12, 220, 0.16, 90);
      layeredTone("square", 0.02, 0.06, 140, 0.08, 70);
      break;
    case "copDodge":
      // Quick siren-style up-down blip.
      layeredTone("sawtooth", 0, 0.1, 760, 0.12, 1120);
      layeredTone("sawtooth", 0.1, 0.12, 1120, 0.12, 680);
      break;
    case "courierHandoff":
      // Bright ascending power surge.
      layeredTone("square", 0, 0.16, 523, 0.13, 784);
      layeredTone("triangle", 0.06, 0.2, 784, 0.1, 1175);
      break;
    case "wipeout":
      // Crunchy descending crash.
      layeredTone("sawtooth", 0, 0.3, 320, 0.2, 70);
      layeredTone("square", 0.04, 0.22, 180, 0.12, 60);
      layeredTone("triangle", 0.02, 0.34, 90, 0.12, 40);
      break;
    case "comeback":
      // Heroic rising shimmer.
      layeredTone("triangle", 0, 0.22, 659, 0.1, 988);
      layeredTone("sine", 0.1, 0.26, 988, 0.08, 1319);
      layeredTone("sine", 0.2, 0.2, 1319, 0.05, 1760);
      break;
    default:
      break;
  }
}

/** Finish-line crowd swell — a rising roar layered under the win/lose fanfare. */
export function sfxRaceFinishSwell() {
  try {
    const c = ctx();
    const now = c.currentTime;
    const dur = 1.1;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      // Swell in, then settle — coloured noise resembling a crowd roar.
      const p = i / data.length;
      const envelope = Math.sin(Math.min(1, p * 1.3) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.linearRampToValueAtTime(1100, now + dur * 0.6);
    filter.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.16, now + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(now);
    src.stop(now + dur);
  } catch {
    /* Audio unavailable – silently ignore */
  }
}

/**
 * A controllable "roll" loop that imitates wheels/engine humming during a race.
 * Returns a handle whose `setIntensity(0..1)` re-pitches and re-gains the loop
 * to match the leader's speed, and whose `stop()` tears everything down.
 *
 * Always returns a handle (a no-op handle when audio is unavailable) so callers
 * never need to null-check.
 */
export interface RaceRollLoopHandle {
  setIntensity: (intensity: number) => void;
  stop: () => void;
}

const NO_OP_ROLL_LOOP: RaceRollLoopHandle = { setIntensity: () => {}, stop: () => {} };

export function startRaceRollLoop(): RaceRollLoopHandle {
  try {
    const c = ctx();
    const now = c.currentTime;

    // Looping noise buffer fed through a lowpass to make a wheels-on-asphalt hum.
    const buf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, now);
    filter.Q.value = 0.8;

    // A low oscillator adds an engine-like body under the noise hum.
    const drone = c.createOscillator();
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(70, now);

    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    const droneGain = c.createGain();
    droneGain.gain.setValueAtTime(0.0001, now);
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.9, now + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    drone.connect(droneGain);
    droneGain.connect(master);
    master.connect(c.destination);

    noise.start(now);
    drone.start(now);

    let stopped = false;
    const setIntensity = (intensityRaw: number) => {
      if (stopped) return;
      const intensity = Math.max(0, Math.min(1, intensityRaw));
      const t = c.currentTime;
      // Higher speed → brighter filter, higher engine pitch, louder hum.
      filter.frequency.linearRampToValueAtTime(380 + intensity * 1600, t + 0.08);
      drone.frequency.linearRampToValueAtTime(60 + intensity * 130, t + 0.08);
      noiseGain.gain.linearRampToValueAtTime(0.05 + intensity * 0.10, t + 0.08);
      droneGain.gain.linearRampToValueAtTime(0.04 + intensity * 0.08, t + 0.08);
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        const t = c.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + 0.2);
        noise.stop(t + 0.25);
        drone.stop(t + 0.25);
      } catch {
        /* already stopped */
      }
    };

    return { setIntensity, stop };
  } catch {
    return NO_OP_ROLL_LOOP;
  }
}
