import { useState, useEffect, useCallback, useRef } from "react";
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
import { normalizeCardPayload } from "../lib/styles";

const MIGRATION_KEY_PREFIX = "skpd_migration_done_";

function shallowEqualCardArrays(previous: CardPayload[], next: CardPayload[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  return previous.every((card, index) => card === next[index]);
}

export function useCollection() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [cards, setCards] = useState<CardPayload[]>(() => loadCollection());
  const [migrationPending, setMigrationPending] = useState(false);
  const lastSavedCardsRef = useRef<CardPayload[]>(cards);
  const initialGuestCardsRef = useRef<CardPayload[] | null>(null);
  const guestHydratingRef = useRef(!uid);

  // ── Subscribe to Firestore (authenticated) or localStorage (guest) ────────
  useEffect(() => {
    if (!uid) {
      const localCards = loadCollection();
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

    const colRef = collection(db, "users", uid, "cards");
    const unsub = onSnapshot(colRef, (snap) => {
      setCards(snap.docs.map((d) => normalizeCardPayload(d.data() as CardPayload)));
    });
    return unsub;
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
      deleteDoc(doc(db, "users", uid, "cards", id)).catch(console.error);
    } else {
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  }, [uid]);

  const updateCard = useCallback((card: CardPayload) => {
    const normalizedCard = normalizeCardPayload(card);
    if (uid) {
      setDoc(doc(db, "users", uid, "cards", normalizedCard.id), normalizedCard).catch(console.error);
    } else {
      setCards((prev) => prev.map((c) => (c.id === normalizedCard.id ? normalizedCard : c)));
    }
  }, [uid]);

  const hasCard = useCallback((id: string) => cards.some((c) => c.id === id), [cards]);

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
    cards,
    addCard,
    removeCard,
    updateCard,
    hasCard,
    migrationPending,
    importLocalCards,
    dismissMigration,
  };
}
