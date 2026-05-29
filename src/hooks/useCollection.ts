import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import type { CardPayload } from "../lib/types";
import { loadCollection, saveCollection } from "../lib/storage";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { reportPersistenceError } from "../lib/persistenceError";
import { normalizeCardPayload } from "../lib/styles";

const MIGRATION_KEY_PREFIX = "skpd_migration_done_";

interface UnlockedFrameEntry {
  cardId: string;
  frameId: string;
  unlockedAt: string;
}

/**
 * Validates and normalizes unlocked frame entries loaded from Firestore.
 * @param value Raw userProfiles/{uid}.unlocked_frames data.
 * @returns Valid card/frame pairs, with malformed entries removed.
 */
function normalizeUnlockedFrames(value: unknown): UnlockedFrameEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const data = entry as Record<string, unknown>;
      return {
        cardId: typeof data.cardId === "string" ? data.cardId : "",
        frameId: typeof data.frameId === "string" ? data.frameId : "",
        unlockedAt: typeof data.unlockedAt === "string" ? data.unlockedAt : "",
      };
    })
    .filter((entry): entry is UnlockedFrameEntry => Boolean(entry?.cardId && entry.frameId));
}

/**
 * Hydrates cards with unlocked prestige frame IDs for display.
 * @param cards Current saved collection cards.
 * @param unlockedFrames Normalized profile unlock entries.
 * @returns Cards with unlockedFrameIds and the most recently unlocked frame marked active.
 */
function applyUnlockedFrames(cards: CardPayload[], unlockedFrames: UnlockedFrameEntry[]): CardPayload[] {
  const byCardId = new Map<string, string[]>();
  const orderedUnlocks = [...unlockedFrames].sort((left, right) => left.unlockedAt.localeCompare(right.unlockedAt));
  for (const entry of orderedUnlocks) {
    const frameIds = byCardId.get(entry.cardId) ?? [];
    if (!frameIds.includes(entry.frameId)) frameIds.push(entry.frameId);
    byCardId.set(entry.cardId, frameIds);
  }

  return cards.map((card) => {
    const frameIds = byCardId.get(card.id) ?? [];
    if (frameIds.length === 0) {
      if (!card.unlockedFrameIds?.length && !card.activeFrameId) return card;
      const rest = { ...card };
      delete rest.unlockedFrameIds;
      delete rest.activeFrameId;
      return rest as CardPayload;
    }
    return {
      ...card,
      unlockedFrameIds: frameIds,
      activeFrameId: frameIds.at(-1),
    };
  });
}

function shallowEqualCardArrays(previous: CardPayload[], next: CardPayload[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  return previous.every((card, index) => card === next[index]);
}

export function useCollection() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [cards, setCards] = useState<CardPayload[]>(() => loadCollection());
  const [unlockedFrames, setUnlockedFrames] = useState<UnlockedFrameEntry[]>([]);
  const [migrationPending, setMigrationPending] = useState(false);
  const lastSavedCardsRef = useRef<CardPayload[]>(cards);
  const initialGuestCardsRef = useRef<CardPayload[] | null>(null);
  const guestHydratingRef = useRef(!uid);

  // ── Subscribe to Firestore (authenticated) or localStorage (guest) ────────
  useEffect(() => {
    if (!uid) {
      const localCards = loadCollection();
      setUnlockedFrames([]);
      guestHydratingRef.current = true;
      initialGuestCardsRef.current = localCards;
      lastSavedCardsRef.current = localCards;
      setCards(localCards);
      setMigrationPending(false);
      return;
    }

    guestHydratingRef.current = false;
    initialGuestCardsRef.current = null;
    lastSavedCardsRef.current = [];
    setCards([]);

    // Check if there are local cards to migrate (and we haven't already done so)
    const migrationDone = localStorage.getItem(MIGRATION_KEY_PREFIX + uid) === "1";
    if (!migrationDone) {
      const local = loadCollection();
      setMigrationPending(local.length > 0);
    }

    const profileRef = doc(db, "userProfiles", uid);
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      setUnlockedFrames(normalizeUnlockedFrames(snap.data()?.unlocked_frames));
    });

    const colRef = collection(db, "users", uid, "cards");
    const unsub = onSnapshot(colRef, (snap) => {
      setCards(snap.docs.map((d) => normalizeCardPayload(d.data() as CardPayload)));
    });
    return () => {
      unsub();
      unsubProfile();
    };
  }, [uid]);

  // ── Persist to localStorage for guests ────────────────────────────────────
  useEffect(() => {
    if (uid) return;

    if (guestHydratingRef.current) {
      if (!initialGuestCardsRef.current || !shallowEqualCardArrays(initialGuestCardsRef.current, cards)) return;
      guestHydratingRef.current = false;
    }

    if (shallowEqualCardArrays(lastSavedCardsRef.current, cards)) return;

    saveCollection(cards);
    lastSavedCardsRef.current = cards;
  }, [cards, uid]);

  // ── Card mutations ────────────────────────────────────────────────────────
  const addCard = useCallback(async (card: CardPayload): Promise<void> => {
    const normalizedCard = normalizeCardPayload(card);
    if (uid) {
      await setDoc(doc(db, "users", uid, "cards", normalizedCard.id), normalizedCard);
    } else {
      setCards((prev) => (prev.some((c) => c.id === normalizedCard.id) ? prev : [...prev, normalizedCard]));
    }
  }, [uid]);

  const removeCard = useCallback((id: string) => {
    if (uid) {
      deleteDoc(doc(db, "users", uid, "cards", id)).catch((error) => reportPersistenceError("Couldn't remove that card — check your connection and try again.", error));
    } else {
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  }, [uid]);

  const updateCard = useCallback((card: CardPayload) => {
    const normalizedCard = normalizeCardPayload(card);
    if (uid) {
      setDoc(doc(db, "users", uid, "cards", normalizedCard.id), normalizedCard).catch((error) => reportPersistenceError("Couldn't save your card changes — check your connection and try again.", error));
    } else {
      setCards((prev) => prev.map((c) => (c.id === normalizedCard.id ? normalizedCard : c)));
    }
  }, [uid]);

  const hasCard = useCallback((id: string) => cards.some((c) => c.id === id), [cards]);
  const displayCards = useMemo(() => applyUnlockedFrames(cards, unlockedFrames), [cards, unlockedFrames]);

  // ── Migration helpers ─────────────────────────────────────────────────────
  const importLocalCards = useCallback(async () => {
    if (!uid) return;
    const local = loadCollection();
    if (local.length > 0) {
      const batch = writeBatch(db);
      for (const card of local.map(normalizeCardPayload)) {
        batch.set(doc(db, "users", uid, "cards", card.id), card);
      }
      await batch.commit();
    }
    localStorage.removeItem("skpd_collection");
    localStorage.setItem(MIGRATION_KEY_PREFIX + uid, "1");
    setMigrationPending(false);
  }, [uid]);

  const dismissMigration = useCallback(() => {
    if (uid) localStorage.setItem(MIGRATION_KEY_PREFIX + uid, "1");
    setMigrationPending(false);
  }, [uid]);

  return {
    cards: displayCards,
    addCard,
    removeCard,
    updateCard,
    hasCard,
    migrationPending,
    importLocalCards,
    dismissMigration,
  };
}
