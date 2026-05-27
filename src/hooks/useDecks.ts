import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import type { DeckPayload, CardPayload } from "../lib/types";
import { loadDecks, saveDecks } from "../lib/storage";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

/** Maximum number of cards allowed in a single deck. */
export const DECK_CARD_LIMIT = 6;

function sortDecks(decks: DeckPayload[]): DeckPayload[] {
  return [...decks].sort((a, b) => {
    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;

    if (typeof aOrder === "number" && typeof bOrder === "number" && aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    if (typeof aOrder === "number") return -1;
    if (typeof bOrder === "number") return 1;

    const aCreatedAt = Date.parse(a.createdAt);
    const bCreatedAt = Date.parse(b.createdAt);

    if (Number.isNaN(aCreatedAt) || Number.isNaN(bCreatedAt)) {
      console.warn("Encountered deck with invalid createdAt while sorting deck order", {
        aDeckId: a.id,
        aCreatedAt: a.createdAt,
        bDeckId: b.id,
        bCreatedAt: b.createdAt,
      });
    } else if (aCreatedAt !== bCreatedAt) {
      return aCreatedAt - bCreatedAt;
    }
    return a.name.localeCompare(b.name);
  });
}

function normalizeDeckOrder(decks: DeckPayload[]): DeckPayload[] {
  return sortDecks(decks).map((deck, index) => (
    deck.sortOrder === index ? deck : { ...deck, sortOrder: index }
  ));
}

function shallowEqualDeckArrays(previous: DeckPayload[], next: DeckPayload[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  return previous.every((deck, index) => deck === next[index]);
}

export function useDecks() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [decks, setDecks] = useState<DeckPayload[]>([]);
  const lastSavedDecksRef = useRef<DeckPayload[]>([]);
  const initialGuestDecksRef = useRef<DeckPayload[] | null>(null);
  const guestHydratingRef = useRef(!uid);

  // ── Subscribe to Firestore or localStorage ────────────────────────────────
  useEffect(() => {
    if (!uid) {
      const localDecks = normalizeDeckOrder(loadDecks());
      guestHydratingRef.current = true;
      initialGuestDecksRef.current = localDecks;
      lastSavedDecksRef.current = localDecks;
      setDecks(localDecks);
      return;
    }

    guestHydratingRef.current = false;
    initialGuestDecksRef.current = null;
    lastSavedDecksRef.current = [];
    setDecks([]);

    const colRef = collection(db, "users", uid, "decks");
    const unsub = onSnapshot(colRef, (snap) => {
      const incoming = snap.docs.map((d) => d.data() as DeckPayload);
      const normalized = normalizeDeckOrder(incoming);
      setDecks(normalized);

      const incomingDecksById = new Map(incoming.map((deck) => [deck.id, deck]));
      const changedDecks = normalized.filter((deck) => {
        const incomingDeck = incomingDecksById.get(deck.id);
        return incomingDeck && incomingDeck.sortOrder !== deck.sortOrder;
      });

      if (changedDecks.length > 0) {
        void Promise.all(changedDecks.map((deck) => setDoc(doc(db, "users", uid, "decks", deck.id), deck))).catch(console.error);
      }
    });
    return unsub;
  }, [uid]);

  // ── Persist to localStorage for guests ────────────────────────────────────
  useEffect(() => {
    if (uid) return;

    if (guestHydratingRef.current) {
      if (!initialGuestDecksRef.current || !shallowEqualDeckArrays(initialGuestDecksRef.current, decks)) return;
      guestHydratingRef.current = false;
    }

    if (shallowEqualDeckArrays(lastSavedDecksRef.current, decks)) return;

    saveDecks(decks);
    lastSavedDecksRef.current = decks;
  }, [decks, uid]);

  // Keep a ref for synchronous access in callbacks
  const decksRef = useRef<DeckPayload[]>([]);
  useEffect(() => { decksRef.current = decks; }, [decks]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const saveDeck = useCallback((deck: DeckPayload) => {
    if (uid) {
      setDoc(doc(db, "users", uid, "decks", deck.id), deck).catch(console.error);
    } else {
      setDecks((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
    }
  }, [uid]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createDeck = useCallback((name: string): DeckPayload => {
    const nextSortOrder = decksRef.current.length;
    const deck: DeckPayload = {
      id: `deck-${Date.now()}`,
      version: "1.0.0",
      name,
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: nextSortOrder,
    };
    if (uid) {
      setDoc(doc(db, "users", uid, "decks", deck.id), deck).catch(console.error);
    } else {
      setDecks((prev) => normalizeDeckOrder([...prev, deck]));
    }
    return deck;
  }, [uid]);

  const deleteDeck = useCallback((id: string) => {
    if (uid) {
      deleteDoc(doc(db, "users", uid, "decks", id)).catch(console.error);
    } else {
      setDecks((prev) => prev.filter((d) => d.id !== id));
    }
  }, [uid]);

  const addCardToDeck = useCallback((deckId: string, card: CardPayload) => {
    const deck = decksRef.current.find((d) => d.id === deckId);
    if (!deck) return;
    const updated: DeckPayload = {
      ...deck,
      cards: [...deck.cards, card],
      updatedAt: new Date().toISOString(),
    };
    saveDeck(updated);
  }, [saveDeck]);

  const removeCardFromDeck = useCallback((deckId: string, cardId: string) => {
    const deck = decksRef.current.find((d) => d.id === deckId);
    if (!deck) return;
    const updated: DeckPayload = {
      ...deck,
      cards: deck.cards.filter((c) => c.id !== cardId),
      updatedAt: new Date().toISOString(),
    };
    saveDeck(updated);
  }, [saveDeck]);

  const renameDeck = useCallback((id: string, name: string) => {
    const deck = decksRef.current.find((d) => d.id === id);
    if (!deck) return;
    saveDeck({ ...deck, name, updatedAt: new Date().toISOString() });
  }, [saveDeck]);

  /**
   * Reorder a card within a deck by swapping it from `fromIndex` to `toIndex`.
   */
  /**
   * Remove a card from every deck that contains it.
   * Useful when deleting a card from the collection entirely.
   */
  const removeCardFromAllDecks = useCallback((cardId: string) => {
    for (const deck of decksRef.current) {
      if (deck.cards.some((c) => c.id === cardId)) {
        saveDeck({
          ...deck,
          cards: deck.cards.filter((c) => c.id !== cardId),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [saveDeck]);

  const updateCardInDecks = useCallback((card: CardPayload) => {
    for (const deck of decksRef.current) {
      if (deck.cards.some((existingCard) => existingCard.id === card.id)) {
        saveDeck({
          ...deck,
          cards: deck.cards.map((existingCard) => (existingCard.id === card.id ? card : existingCard)),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [saveDeck]);

  const moveCardInDeck = useCallback((deckId: string, fromIndex: number, toIndex: number) => {
    const deck = decksRef.current.find((d) => d.id === deckId);
    if (!deck) return;
    const cards = [...deck.cards];
    const [moved] = cards.splice(fromIndex, 1);
    cards.splice(toIndex, 0, moved);
    saveDeck({ ...deck, cards, updatedAt: new Date().toISOString() });
  }, [saveDeck]);

  const moveDeck = useCallback((fromIndex: number, toIndex: number) => {
    const orderedDecks = normalizeDeckOrder(decksRef.current);
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= orderedDecks.length ||
      toIndex >= orderedDecks.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const reordered = [...orderedDecks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const normalized = reordered.map((deck, index) => ({ ...deck, sortOrder: index, updatedAt: new Date().toISOString() }));

    setDecks(normalized);

    if (uid) {
      void Promise.all(normalized.map((deck) => setDoc(doc(db, "users", uid, "decks", deck.id), deck))).catch(console.error);
    }
  }, [uid]);

  /**
   * Save a card to the user's first deck, creating "My Deck" if none exists.
   * Respects DECK_CARD_LIMIT.  Returns whether the target deck was already full.
   */
  const saveCardToFirstDeck = useCallback((card: CardPayload): { deckFull: boolean } => {
    const currentDecks = decksRef.current;

    if (currentDecks.length > 0) {
      const firstDeck = currentDecks[0];
      if (firstDeck.cards.length >= DECK_CARD_LIMIT) {
        return { deckFull: true };
      }
      addCardToDeck(firstDeck.id, card);
      return { deckFull: false };
    }

    // No decks exist yet — create one containing the card
    const deck: DeckPayload = {
      id: `deck-${Date.now()}`,
      version: "1.0.0",
      name: "My Deck",
      cards: [card],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (uid) {
      setDoc(doc(db, "users", uid, "decks", deck.id), deck).catch(console.error);
    } else {
      setDecks((prev) => [...prev, deck]);
    }
    return { deckFull: false };
  }, [uid, addCardToDeck]);

  const setPrimaryDeck = useCallback((deckId: string) => {
    const now = new Date().toISOString();
    const updates = decksRef.current.map((deck) => {
      const shouldBePrimary = deck.id === deckId;
      if (Boolean(deck.isPrimary) === shouldBePrimary) return null;
      return { ...deck, isPrimary: shouldBePrimary, updatedAt: now };
    }).filter((d): d is DeckPayload => d !== null);
    if (updates.length === 0) return;
    if (uid) {
      void Promise.all(updates.map((deck) => setDoc(doc(db, "users", uid, "decks", deck.id), deck)))
        .catch(console.error);
    } else {
      setDecks((prev) => prev.map((d) => {
        const next = updates.find((u) => u.id === d.id);
        return next ?? d;
      }));
    }
  }, [uid]);

  const setChallengerCard = useCallback((deckId: string, cardId: string | null) => {
    const deck = decksRef.current.find((d) => d.id === deckId);
    if (!deck) return;
    if (cardId && !deck.cards.some((c) => c.id === cardId)) return;
    const next: DeckPayload = {
      ...deck,
      ...(cardId ? { challengerCardId: cardId } : { challengerCardId: undefined }),
      updatedAt: new Date().toISOString(),
    };
    saveDeck(next);
  }, [saveDeck]);

  return {
    decks,
    createDeck,
    deleteDeck,
    addCardToDeck,
    removeCardFromDeck,
    removeCardFromAllDecks,
    updateCardInDecks,
    renameDeck,
    moveCardInDeck,
    moveDeck,
    saveCardToFirstDeck,
    setPrimaryDeck,
    setChallengerCard,
  };
}
