import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { CraftlinguaEnvelope, CraftlinguaWord } from "../lib/types";
import { parseCraftlinguaProfile } from "../lib/languageIngestion";

const LS_KEY        = "ps_language_profile";
const LS_ENABLED_KEY = "ps_craftlingua_enabled";

function loadFromStorage(): CraftlinguaEnvelope | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return parseCraftlinguaProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function loadEnabledFromStorage(): boolean {
  return localStorage.getItem(LS_ENABLED_KEY) === "true";
}

// ── Context shape ──────────────────────────────────────────────────────────────

interface LanguageContextValue {
  /** The currently active language profile, or null if none is loaded. */
  profile: CraftlinguaEnvelope | null;
  /** Convenience flat list of vocabulary words from the active profile. */
  vocabulary: CraftlinguaWord[];
  /**
   * Whether the user has opted in to applying CraftLingua during card
   * generation.  Defaults to false — loading a profile alone does NOT
   * automatically enable it.  The user must explicitly toggle this on.
   * Requires a paid tier; the panel enforces this at the UI level.
   */
  useCraftlingua: boolean;
  /** Load (and persist) a validated CraftlinguaEnvelope. */
  loadProfile: (profile: CraftlinguaEnvelope) => void;
  /** Remove the active profile from state and localStorage. */
  clearProfile: () => void;
  /** Toggle whether CraftLingua vocabulary is applied to card generation. */
  setUseCraftlingua: (enabled: boolean) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  profile: null,
  vocabulary: [],
  useCraftlingua: false,
  loadProfile: () => {},
  clearProfile: () => {},
  setUseCraftlingua: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]             = useState<CraftlinguaEnvelope | null>(loadFromStorage);
  const [useCraftlingua, setEnabled]      = useState<boolean>(loadEnabledFromStorage);

  const vocabulary: CraftlinguaWord[] = profile?.vocabulary ?? [];

  const loadProfile = useCallback((p: CraftlinguaEnvelope) => {
    setProfile(p);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      // Silently ignore storage errors (e.g. private browsing quota).
    }
  }, []);

  const clearProfile = useCallback(() => {
    setProfile(null);
    setEnabled(false);
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_ENABLED_KEY);
    } catch {
      // Silently ignore.
    }
  }, []);

  const setUseCraftlingua = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    try {
      if (enabled) {
        localStorage.setItem(LS_ENABLED_KEY, "true");
      } else {
        localStorage.removeItem(LS_ENABLED_KEY);
      }
    } catch {
      // Silently ignore.
    }
  }, []);

  return (
    <LanguageContext.Provider
      value={{ profile, vocabulary, useCraftlingua, loadProfile, clearProfile, setUseCraftlingua }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext);
}
