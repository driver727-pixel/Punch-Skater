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

export function useDecks() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [decks, setDecks] = useState<DeckPayload[]>([]);

  // ── Subscribe to Firestore or localStorage ────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setDecks(loadDecks());
      return;
    }
    const colRef = collection(db, "users", uid, "decks");
    const unsub = onSnapshot(colRef, (snap) => {
      setDecks(snap.docs.map((d) => d.data() as DeckPayload));
    });
    return unsub;
  }, [uid]);

  // ── Persist to localStorage for guests ────────────────────────────────────
  useEffect(() => {
    if (!uid) saveDecks(decks);
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
    const deck: DeckPayload = {
      id: `deck-${Date.now()}`,
      version: "1.0.0",
      name,
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (uid) {
      setDoc(doc(db, "users", uid, "decks", deck.id), deck).catch(console.error);
    } else {
      setDecks((prev) => [...prev, deck]);
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

  return { decks, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, renameDeck };
}
