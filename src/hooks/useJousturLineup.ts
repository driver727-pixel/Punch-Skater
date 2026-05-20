/**
 * useJousturLineup.ts — Hook for loading, saving, and reflecting the player's
 * Joustur Skatur lineup.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { loadJousturLineup, saveJousturLineup } from "../services/joustur";
import type { JousturLineup } from "../lib/jousturTypes";

export interface UseJousturLineupResult {
  lineup: JousturLineup | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveLineup: (riderCardIds: string[], supportCardId: string) => Promise<void>;
  reload: () => void;
}

export function useJousturLineup(): UseJousturLineupResult {
  const { user } = useAuth();
  const [lineup, setLineup] = useState<JousturLineup | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setLineup(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadJousturLineup()
      .then((data) => {
        if (!cancelled) setLineup(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load lineup.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const saveLineup = useCallback(
    async (riderCardIds: string[], supportCardId: string) => {
      setSaving(true);
      setError(null);
      try {
        const saved = await saveJousturLineup(riderCardIds, supportCardId);
        setLineup(saved);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save lineup.",
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { lineup, loading, saving, error, saveLineup, reload };
}
