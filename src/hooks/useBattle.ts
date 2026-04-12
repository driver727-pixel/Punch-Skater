import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import type { ArenaEntry, BattleResult, DeckPayload, CardPayload } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  resolveBattle,
  deductWager,
  WAGER_POINTS,
  WINNER_BONUS,
} from "../lib/battle";

/** Minimum cards required in a deck to ready for battle. */
export const MIN_BATTLE_CARDS = 1;

export function useBattle() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [arenaEntries, setArenaEntries] = useState<ArenaEntry[]>([]);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battling, setBattling] = useState(false);

  // Keep a ref for the latest result dismissal
  const resultRef = useRef<BattleResult | null>(null);

  // ── Subscribe to arena entries ────────────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "arena");
    const unsub = onSnapshot(colRef, (snap) => {
      const entries = snap.docs.map((d) => d.data() as ArenaEntry);
      setArenaEntries(entries);
    });
    return unsub;
  }, []);

  // ── Ready / Unready a deck ────────────────────────────────────────────────
  const readyDeck = useCallback(
    async (deck: DeckPayload) => {
      if (!uid || !db || deck.cards.length < MIN_BATTLE_CARDS) return;
      const entry: ArenaEntry = {
        uid,
        displayName: user?.displayName ?? user?.email?.split("@")[0] ?? "Skater",
        deckId: deck.id,
        deckName: deck.name,
        cardCount: deck.cards.length,
        readiedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "arena", uid), entry);
    },
    [uid, user],
  );

  const unreadyDeck = useCallback(async () => {
    if (!uid || !db) return;
    await deleteDoc(doc(db, "arena", uid));
  }, [uid]);

  // ── Challenge an opponent ─────────────────────────────────────────────────
  const challenge = useCallback(
    async (
      opponentEntry: ArenaEntry,
      myDeck: DeckPayload,
      opponentCards: CardPayload[],
    ) => {
      if (!uid || !db || battling) return;
      setBattling(true);

      try {
        // Resolve the battle
        const outcome = resolveBattle(myDeck.cards, opponentCards);
        const isDraw = outcome.winnerSide === "draw";
        const winnerUid =
          outcome.winnerSide === "challenger"
            ? uid
            : outcome.winnerSide === "defender"
              ? opponentEntry.uid
              : ""; // draw — no winner
        const winningCards =
          outcome.winnerSide === "challenger"
            ? myDeck.cards
            : outcome.winnerSide === "defender"
              ? opponentCards
              : [];

        const result: BattleResult = {
          id: `battle-${Date.now()}`,
          challengerUid: uid,
          challengerDeckName: myDeck.name,
          defenderUid: opponentEntry.uid,
          defenderDeckName: opponentEntry.deckName,
          winnerUid,
          challengerScore: outcome.challengerScore,
          defenderScore: outcome.defenderScore,
          wagerPoints: isDraw ? 0 : WINNER_BONUS,
          winningDeckCardIds: winningCards.map((c) => c.id),
          createdAt: new Date().toISOString(),
        };

        // Persist result for both players
        await setDoc(doc(db, "battleResults", result.id), {
          ...result,
          _ts: serverTimestamp(),
        });

        // Remove the challenger from the arena (defender entry is left for their
        // own client to clean up via onSnapshot or stand-down)
        await deleteDoc(doc(db, "arena", uid));

        setBattleResult(result);
        resultRef.current = result;
      } finally {
        setBattling(false);
      }
    },
    [uid, battling],
  );

  const dismissResult = useCallback(() => {
    setBattleResult(null);
    resultRef.current = null;
  }, []);

  return {
    arenaEntries,
    readyDeck,
    unreadyDeck,
    challenge,
    battleResult,
    dismissResult,
    battling,
    myArenaEntry: arenaEntries.find((e) => e.uid === uid) ?? null,
    WAGER_POINTS,
    WINNER_BONUS,
    deductWager,
  };
}
