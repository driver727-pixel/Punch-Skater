import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  type DocumentData,
  setDoc,
  deleteDoc,
  onSnapshot,
  type QuerySnapshot,
  serverTimestamp,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import type {
  ArenaEntry,
  BattleCardResolution,
  BattleResult,
  CardPayload,
  DeckPayload,
} from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  buildArenaDeckSummary,
  createBattleCardSnapshot,
  deductWager,
  resolveBattleWithEffects,
  WAGER_POINTS,
  WINNER_BONUS,
} from "../lib/battle";

/** Minimum cards required in a deck to ready for battle. */
export const MIN_BATTLE_CARDS = 1;

const SEEN_BATTLE_RESULTS_KEY_PREFIX = "skpd_seen_battle_results_";

function loadSeenBattleResults(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${SEEN_BATTLE_RESULTS_KEY_PREFIX}${uid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistSeenBattleResults(uid: string, seenIds: Set<string>) {
  localStorage.setItem(
    `${SEEN_BATTLE_RESULTS_KEY_PREFIX}${uid}`,
    JSON.stringify(Array.from(seenIds).slice(-50)),
  );
}

/** Returns true when a stored card's current stats differ from a battle resolution. */
function hasStatChanges(card: CardPayload, resolution: BattleCardResolution): boolean {
  return Object.entries(resolution.stats).some(([key, value]) => card.stats[key as keyof CardPayload["stats"]] !== value);
}

/**
 * Applies a resolved battle result to the current user's saved cards and decks,
 * then clears the battleReady flag on the deck that entered the arena.
 */
async function applyBattleResultToUserCollections(uid: string, result: BattleResult): Promise<void> {
  if (!db) return;

  const resolutions =
    uid === result.challengerUid
      ? result.challengerCardResolutions
      : uid === result.defenderUid
        ? result.defenderCardResolutions
        : [];
  const activeDeckId = uid === result.challengerUid ? result.challengerDeckId : result.defenderDeckId;

  if (resolutions.length === 0 && !activeDeckId) return;

  const cardsRef = collection(db, "users", uid, "cards");
  const decksRef = collection(db, "users", uid, "decks");
  const [cardsSnap, decksSnap] = await Promise.all([getDocs(cardsRef), getDocs(decksRef)]);
  const resolutionMap = new Map(resolutions.map((resolution) => [resolution.id, resolution]));
  const batch = writeBatch(db);
  let hasWrites = false;

  for (const cardDoc of cardsSnap.docs) {
    const currentCard = cardDoc.data() as CardPayload;
    const resolution = resolutionMap.get(currentCard.id);
    if (!resolution || !hasStatChanges(currentCard, resolution)) continue;

    batch.set(cardDoc.ref, {
      ...currentCard,
      stats: { ...resolution.stats },
    });
    hasWrites = true;
  }

  for (const deckDoc of decksSnap.docs) {
    const deck = deckDoc.data() as DeckPayload;
    let nextDeck = deck;
    let deckChanged = false;

    if (deck.cards.some((card) => resolutionMap.has(card.id))) {
      nextDeck = {
        ...nextDeck,
        cards: nextDeck.cards.map((card) => {
          const resolution = resolutionMap.get(card.id);
          if (!resolution || !hasStatChanges(card, resolution)) return card;
          deckChanged = true;
          return {
            ...card,
            stats: { ...resolution.stats },
          };
        }),
      };
    }

    if (nextDeck.id === activeDeckId && nextDeck.battleReady) {
      nextDeck = {
        ...nextDeck,
        battleReady: false,
      };
      deckChanged = true;
    }

    if (!deckChanged) continue;

    batch.set(deckDoc.ref, {
      ...nextDeck,
      updatedAt: new Date().toISOString(),
    });
    hasWrites = true;
  }

  if (hasWrites) {
    await batch.commit();
  }
}

export function useBattle() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [arenaEntries, setArenaEntries] = useState<ArenaEntry[]>([]);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battling, setBattling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const resultRef = useRef<BattleResult | null>(null);
  const seenBattleResultsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleResolvedBattle = useCallback(
    async (result: BattleResult) => {
      if (!uid || !db || seenBattleResultsRef.current.has(result.id)) return;

      seenBattleResultsRef.current.add(result.id);
      persistSeenBattleResults(uid, seenBattleResultsRef.current);

      await Promise.all([
        applyBattleResultToUserCollections(uid, result),
        deleteDoc(doc(db, "arena", uid)).catch(() => undefined),
      ]);

      setBattleResult(result);
      resultRef.current = result;
    },
    [uid],
  );

  // ── Subscribe to arena entries ────────────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "arena");
    const unsub = onSnapshot(colRef, (snap) => {
      const entries = snap.docs.map((snapshot) => snapshot.data() as ArenaEntry);
      setArenaEntries(entries);
    });
    return unsub;
  }, [refreshKey]);

  // ── Subscribe to battle results for both challenger and defender ──────────
  useEffect(() => {
    if (!uid || !db) return;

    seenBattleResultsRef.current = loadSeenBattleResults(uid);
    const battleResultsRef = collection(db, "battleResults");
    const handleSnapshot = (querySnapshot: QuerySnapshot<DocumentData>) => {
      for (const battleDoc of querySnapshot.docs) {
        void handleResolvedBattle(battleDoc.data() as BattleResult);
      }
    };

    const unsubAsChallenger = onSnapshot(
      query(battleResultsRef, where("challengerUid", "==", uid)),
      handleSnapshot,
    );
    const unsubAsDefender = onSnapshot(
      query(battleResultsRef, where("defenderUid", "==", uid)),
      handleSnapshot,
    );

    return () => {
      unsubAsChallenger();
      unsubAsDefender();
    };
  }, [uid, handleResolvedBattle]);

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
        battleSummary: buildArenaDeckSummary(deck.cards),
        battleDeck: deck.cards.map(createBattleCardSnapshot),
        readiedAt: new Date().toISOString(),
      };

      await Promise.all([
        setDoc(doc(db, "arena", uid), entry),
        setDoc(
          doc(db, "users", uid, "decks", deck.id),
          {
            ...deck,
            battleReady: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
      ]);
    },
    [uid, user],
  );

  const unreadyDeck = useCallback(async () => {
    if (!uid || !db) return;

    await deleteDoc(doc(db, "arena", uid));

    const decksSnap = await getDocs(collection(db, "users", uid, "decks"));
    const batch = writeBatch(db);
    let hasWrites = false;

    for (const deckDoc of decksSnap.docs) {
      const deck = deckDoc.data() as DeckPayload;
      if (!deck.battleReady) continue;
      batch.set(deckDoc.ref, {
        ...deck,
        battleReady: false,
        updatedAt: new Date().toISOString(),
      });
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  }, [uid]);

  // ── Challenge an opponent ─────────────────────────────────────────────────
  const challenge = useCallback(
    async (opponentEntry: ArenaEntry, myDeck: DeckPayload) => {
      if (!uid || !db || battling) return;
      if (!opponentEntry.battleDeck || opponentEntry.battleDeck.length < MIN_BATTLE_CARDS) return;

      setBattling(true);

      try {
        const battleId = `battle-${Date.now()}`;
        const battleSeed = `${battleId}:${uid}:${myDeck.id}:${opponentEntry.uid}:${opponentEntry.deckId}`;
        const resolution = resolveBattleWithEffects(
          myDeck.cards.map(createBattleCardSnapshot),
          opponentEntry.battleDeck,
          battleSeed,
        );
        const winnerUid =
          resolution.winnerSide === "challenger"
            ? uid
            : resolution.winnerSide === "defender"
              ? opponentEntry.uid
              : "";

        const result: BattleResult = {
          id: battleId,
          challengerUid: uid,
          challengerDeckId: myDeck.id,
          challengerDeckName: myDeck.name,
          defenderUid: opponentEntry.uid,
          defenderDeckId: opponentEntry.deckId,
          defenderDeckName: opponentEntry.deckName,
          winnerUid,
          challengerScore: resolution.challengerScore,
          defenderScore: resolution.defenderScore,
          wagerPoints: resolution.wagerPoints,
          winningDeckCardIds: resolution.winningDeckCardIds,
          challengerCardResolutions: resolution.challengerCardResolutions,
          defenderCardResolutions: resolution.defenderCardResolutions,
          createdAt: new Date().toISOString(),
        };

        await setDoc(doc(db, "battleResults", result.id), {
          ...result,
          _ts: serverTimestamp(),
        });

        await handleResolvedBattle(result);
      } finally {
        setBattling(false);
      }
    },
    [uid, battling, handleResolvedBattle],
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
    refresh,
    myArenaEntry: arenaEntries.find((entry) => entry.uid === uid) ?? null,
    WAGER_POINTS,
    WINNER_BONUS,
    deductWager,
  };
}
