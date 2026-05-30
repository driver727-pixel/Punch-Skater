import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useJousturSoundtrack — a looping procedural cyberpunk soundtrack for
 * Joustur Skatur™ matches, built entirely from the Web Audio API.
 *
 * Returns [playing, toggle] — toggle() must be called from a user gesture
 * to satisfy browser autoplay policies.
 *
 * The soundtrack uses layered oscillators with a low-BPM arpeggiated
 * progression to create a tense, arena-like atmosphere without requiring
 * any audio file downloads.
 */

const STORAGE_KEY = "joustur-soundtrack-enabled";

interface SoundtrackNodes {
  ctx: AudioContext;
  master: GainNode;
  /** Interval handle driving the sequencer loop. */
  interval: number;
}

/** Minor-key note frequencies for the Joustur arena soundtrack. */
const CHORD_PROGRESSION: number[][] = [
  [130.81, 155.56, 196.00], // Cm
  [116.54, 146.83, 174.61], // Bb
  [123.47, 155.56, 185.00], // Eb
  [130.81, 155.56, 196.00], // Cm (repeat)
];

const BPM = 80;
const STEP_DURATION = 60 / BPM; // seconds per beat
const STEPS_PER_CHORD = 4;

function startSoundtrack(): SoundtrackNodes | null {
  try {
    const c = new AudioContext();
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.5);
    master.connect(c.destination);

    let step = 0;

    const playStep = () => {
      const chordIndex = Math.floor(step / STEPS_PER_CHORD) % CHORD_PROGRESSION.length;
      const noteIndex = step % STEPS_PER_CHORD;
      const chord = CHORD_PROGRESSION[chordIndex];
      const freq = chord[noteIndex % chord.length];
      const now = c.currentTime;

      // Arpeggiated bass note
      const bassOsc = c.createOscillator();
      bassOsc.type = "sawtooth";
      bassOsc.frequency.setValueAtTime(freq, now);
      const bassGain = c.createGain();
      bassGain.gain.setValueAtTime(0.08, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + STEP_DURATION * 0.9);
      const bassFilter = c.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.setValueAtTime(400, now);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(master);
      bassOsc.start(now);
      bassOsc.stop(now + STEP_DURATION * 0.9);

      // High pad drone (sustained chord tone, every other step)
      if (noteIndex % 2 === 0) {
        const padOsc = c.createOscillator();
        padOsc.type = "triangle";
        padOsc.frequency.setValueAtTime(freq * 2, now);
        const padGain = c.createGain();
        padGain.gain.setValueAtTime(0.04, now);
        padGain.gain.exponentialRampToValueAtTime(0.001, now + STEP_DURATION * 1.8);
        padOsc.connect(padGain);
        padGain.connect(master);
        padOsc.start(now);
        padOsc.stop(now + STEP_DURATION * 1.8);
      }

      // Percussive tick (filtered noise burst for rhythm)
      if (noteIndex === 0 || noteIndex === 2) {
        const tickBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
        const td = tickBuf.getChannelData(0);
        for (let i = 0; i < td.length; i++) {
          td[i] = (Math.random() * 2 - 1) * (1 - i / td.length);
        }
        const tickSrc = c.createBufferSource();
        tickSrc.buffer = tickBuf;
        const tickGain = c.createGain();
        tickGain.gain.setValueAtTime(0.06, now);
        tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        const tickFilter = c.createBiquadFilter();
        tickFilter.type = "highpass";
        tickFilter.frequency.value = 2000;
        tickSrc.connect(tickFilter);
        tickFilter.connect(tickGain);
        tickGain.connect(master);
        tickSrc.start(now);
        tickSrc.stop(now + 0.04);
      }

      step += 1;
    };

    // Play the first step immediately.
    playStep();
    const interval = window.setInterval(playStep, STEP_DURATION * 1000);

    return { ctx: c, master, interval };
  } catch {
    return null;
  }
}

function stopSoundtrack(nodes: SoundtrackNodes) {
  try {
    window.clearInterval(nodes.interval);
    const now = nodes.ctx.currentTime;
    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
    nodes.master.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    // Close context after fade.
    setTimeout(() => { try { nodes.ctx.close(); } catch { /* */ } }, 400);
  } catch {
    /* already stopped */
  }
}

export function useJousturSoundtrack(): [boolean, () => void] {
  const [playing, setPlaying] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const nodesRef = useRef<SoundtrackNodes | null>(null);
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Auto-start if previously enabled (may be blocked by autoplay policy).
  useEffect(() => {
    if (playingRef.current && !nodesRef.current) {
      nodesRef.current = startSoundtrack();
    }
    return () => {
      if (nodesRef.current) {
        stopSoundtrack(nodesRef.current);
        nodesRef.current = null;
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !playingRef.current;
    playingRef.current = next;

    if (next) {
      if (!nodesRef.current) nodesRef.current = startSoundtrack();
    } else {
      if (nodesRef.current) {
        stopSoundtrack(nodesRef.current);
        nodesRef.current = null;
      }
    }

    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* */ }
    setPlaying(next);
  }, []);

  return [playing, toggle];
}
