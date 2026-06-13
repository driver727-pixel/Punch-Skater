import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "ambience-enabled";
const AMBIENCE_SRC = "/assets/sounds/buzzing%20crt.mp3";

function attemptPlay(audio: HTMLAudioElement) {
  audio.play().catch(() => {/* autoplay policy – silently ignored */});
}

/**
 * Manages the looping CRT-buzzing background ambience.
 * The enabled state is persisted to localStorage so it survives page reloads.
 * Returns [enabled, toggle].
 */
export function useAmbience(): [boolean, () => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mirror enabled in a ref so the toggle closure always sees the latest value.
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Initialise the audio element once and attempt initial playback if already enabled.
  useEffect(() => {
    const audio = new Audio(AMBIENCE_SRC);
    audio.loop = true;
    audio.volume = 0.25;
    // Silently ignore network/decode errors so a missing file doesn't surface
    // as an unhandled error event in the console.
    audio.addEventListener('error', () => {});
    audioRef.current = audio;

    if (enabledRef.current) {
      // May be blocked by autoplay policy on first load; that's acceptable.
      attemptPlay(audio);
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  /**
   * Toggle ambience on/off.  Play/pause is called synchronously here so it
   * runs within the browser's user-gesture activation context (the click
   * handler), which is required for audio.play() to succeed in modern browsers.
   */
  const toggle = () => {
    const next = !enabledRef.current;
    enabledRef.current = next;

    const audio = audioRef.current;
    if (audio) {
      if (next) {
        attemptPlay(audio);
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* storage unavailable */
    }

    setEnabled(next);
  };

  return [enabled, toggle];
}
