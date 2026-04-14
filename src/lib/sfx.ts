/**
 * Centralized sound-effects module using the Web Audio API.
 *
 * Every helper is fire-and-forget and silently swallows errors so that a
 * missing AudioContext (e.g. server-side rendering, or browsers that have not
 * yet received a user gesture) never breaks the app.
 */

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
