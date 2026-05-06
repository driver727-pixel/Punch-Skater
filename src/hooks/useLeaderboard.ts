import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  limit,
} from "firebase/firestore";
import type { DeckPayload, LeaderboardEntry } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { ACTIVE_LEADERBOARD_SEASON } from "../lib/seasonalLeaderboard";
import { submitLeaderboardDeck } from "../services/leaderboard";

/** Maximum entries shown on the leaderboard. */
const LEADERBOARD_LIMIT = 50;

export function useLeaderboard() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── Subscribe to leaderboard entries ──────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "leaderboardSeasons", ACTIVE_LEADERBOARD_SEASON.id, "entries"),
      limit(LEADERBOARD_LIMIT),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => d.data() as LeaderboardEntry);
      data.sort((a, b) => (
        (b.seasonalRankScore ?? b.deckPower) - (a.seasonalRankScore ?? a.deckPower)
        || b.deckPower - a.deckPower
        || b.ozzies - a.ozzies
      ));
      setEntries(data);
    });
    return unsub;
  }, []);

  // ── Upload a deck to the leaderboard ──────────────────────────────────────
  const uploadDeck = useCallback(
    async (deck: DeckPayload) => {
      if (!uid || !db || deck.cards.length === 0) return;
      setUploading(true);
      try {
        await submitLeaderboardDeck(deck.id);
      } finally {
        setUploading(false);
      }
    },
    [uid],
  );

  const myEntry = entries.find((e) => e.uid === uid) ?? null;

  return { entries, uploadDeck, uploading, myEntry };
}
