import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  type DocumentData,
  type QueryDocumentSnapshot,
  setDoc,
  deleteDoc,
  onSnapshot,
  type QuerySnapshot,
  getDocs,
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  startAfter,
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
  WAGER_POINTS,
  WINNER_BONUS,
} from "../lib/battle";
import { resolveApiUrl } from "../lib/apiUrls";

/** Minimum cards required in a deck to ready for battle. */
export const MIN_BATTLE_CARDS = 1;
const ARENA_PAGE_SIZE = 50;

const SEEN_BATTLE_RESULTS_KEY_PREFIX = "skpd_seen_battle_results_";
const BATTLE_API_URL = resolveApiUrl(
  (import.meta.env.VITE_BATTLE_API_URL as string | undefined)?.trim(),
  "/api/resolve-battle",
);

function mergeArenaEntries(primaryEntries: ArenaEntry[], secondaryEntries: ArenaEntry[]): ArenaEntry[] {
  const seenUids = new Set<string>();
  const mergedEntries: ArenaEntry[] = [];

  for (const entry of primaryEntries) {
    if (seenUids.has(entry.uid)) continue;
    seenUids.add(entry.uid);
    mergedEntries.push(entry);
  }

  for (const entry of secondaryEntries) {
    if (seenUids.has(entry.uid)) continue;
    seenUids.add(entry.uid);
    mergedEntries.push(entry);
  }

  return mergedEntries;
}

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
  const [myArenaEntry, setMyArenaEntry] = useState<ArenaEntry | null>(null);
  const [hasMoreArenaEntries, setHasMoreArenaEntries] = useState(false);
  const [loadingMoreArenaEntries, setLoadingMoreArenaEntries] = useState(false);

  const resultRef = useRef<BattleResult | null>(null);
  const seenBattleResultsRef = useRef<Set<string>>(new Set());
  const arenaLiveEntriesRef = useRef<ArenaEntry[]>([]);
  const arenaLoadedEntriesRef = useRef<ArenaEntry[]>([]);
  const arenaLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

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
    if (!db) {
      arenaLiveEntriesRef.current = [];
      arenaLoadedEntriesRef.current = [];
      arenaLastDocRef.current = null;
      setArenaEntries([]);
      setHasMoreArenaEntries(false);
      return;
    }

    arenaLiveEntriesRef.current = [];
    arenaLoadedEntriesRef.current = [];
    arenaLastDocRef.current = null;
    setArenaEntries([]);
    setHasMoreArenaEntries(false);
    setLoadingMoreArenaEntries(false);

    const colRef = collection(db, "arena");
    const arenaQuery = query(colRef, orderBy("readiedAt", "desc"), limit(ARENA_PAGE_SIZE));
    const unsub = onSnapshot(arenaQuery, (snap) => {
      const entries = snap.docs.map((snapshot) => snapshot.data() as ArenaEntry);
      arenaLiveEntriesRef.current = entries;
      arenaLastDocRef.current = snap.docs.at(-1) ?? null;
      setHasMoreArenaEntries(snap.docs.length === ARENA_PAGE_SIZE);
      setArenaEntries(mergeArenaEntries(entries, arenaLoadedEntriesRef.current));
    });
    return unsub;
  }, [refreshKey]);

  useEffect(() => {
    if (!uid || !db) {
      setMyArenaEntry(null);
      return;
    }

    setMyArenaEntry(null);
    return onSnapshot(doc(db, "arena", uid), (snap) => {
      setMyArenaEntry(snap.exists() ? (snap.data() as ArenaEntry) : null);
    });
  }, [uid]);

  const loadMoreArenaEntries = useCallback(async () => {
    if (!db || loadingMoreArenaEntries || !arenaLastDocRef.current) return;

    setLoadingMoreArenaEntries(true);

    try {
      const nextPage = await getDocs(
        query(
          collection(db, "arena"),
          orderBy("readiedAt", "desc"),
          startAfter(arenaLastDocRef.current),
          limit(ARENA_PAGE_SIZE),
        ),
      );
      const nextEntries = nextPage.docs.map((snapshot) => snapshot.data() as ArenaEntry);

      arenaLoadedEntriesRef.current = mergeArenaEntries(arenaLoadedEntriesRef.current, nextEntries);
      arenaLastDocRef.current = nextPage.docs.at(-1) ?? arenaLastDocRef.current;
      setHasMoreArenaEntries(nextPage.docs.length === ARENA_PAGE_SIZE);
      setArenaEntries(mergeArenaEntries(arenaLiveEntriesRef.current, arenaLoadedEntriesRef.current));
    } finally {
      setLoadingMoreArenaEntries(false);
    }
  }, [loadingMoreArenaEntries]);

  // ── Subscribe to battle results for both challenger and defender ──────────
  useEffect(() => {
    if (!uid || !db) {
      seenBattleResultsRef.current = new Set();
      return;
    }

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

      try {
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
      } catch (err) {
        console.error("Failed to ready deck:", err);
        throw err;
      }
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
      if (!uid || !user || !db || battling) return;
      if (!opponentEntry.battleDeck || opponentEntry.battleDeck.length < MIN_BATTLE_CARDS) return;

      setBattling(true);

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(BATTLE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            challengerDeckId: myDeck.id,
            defenderUid: opponentEntry.uid,
            defenderDeckId: opponentEntry.deckId,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Failed to resolve battle.",
          );
        }

        await handleResolvedBattle(payload as BattleResult);
      } finally {
        setBattling(false);
      }
    },
    [uid, user, battling, handleResolvedBattle],
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
    myArenaEntry,
    hasMoreArenaEntries,
    loadingMoreArenaEntries,
    loadMoreArenaEntries,
    WAGER_POINTS,
    WINNER_BONUS,
    deductWager,
  };
}
