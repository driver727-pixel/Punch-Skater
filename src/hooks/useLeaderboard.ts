import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  limit,
} from "firebase/firestore";
import type { DeckPayload, LeaderboardEntry } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { buildArenaDeckSummary, computeDeckScore, computeDeckWorth } from "../lib/battle";
import { computeCrewOzzies, computeCrewXp, computeLeaderboardScore } from "../lib/progression";

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
      collection(db, "leaderboard"),
      limit(LEADERBOARD_LIMIT),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => d.data() as LeaderboardEntry);
      data.sort((a, b) => b.deckPower - a.deckPower || b.ozzies - a.ozzies);
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
        const summary = buildArenaDeckSummary(deck.cards);
        const deckPower   = computeDeckScore(deck.cards);
        const crewOzzies  = computeCrewOzzies(deck.cards);
        const crewXp      = computeCrewXp(deck.cards);
        const leaderboardScore = computeLeaderboardScore(deckPower, crewOzzies, crewXp);
        const entry: LeaderboardEntry = {
          uid,
          displayName:
            user?.displayName ?? user?.email?.split("@")[0] ?? "Skater",
          deckName: deck.name,
          cardCount: deck.cards.length,
          deckPower,
          ozzies: computeDeckWorth(deck.cards),
          crewOzzies,
          crewXp,
          leaderboardScore,
          strongestStat: summary.strongestStat,
          strongestStatTotal: summary.strongestStatTotal,
          synergyBonusPct: summary.synergyBonusPct,
          archetypeHint: summary.archetypeHint,
          updatedAt: new Date().toISOString(),
        };
        // One entry per user — upsert by uid
        await setDoc(doc(db, "leaderboard", uid), entry);
      } finally {
        setUploading(false);
      }
    },
    [uid, user],
  );

  const myEntry = entries.find((e) => e.uid === uid) ?? null;

  return { entries, uploadDeck, uploading, myEntry };
}
