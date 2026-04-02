import { useState, useEffect } from "react";
import type { DeckPayload, CardPayload } from "../lib/types";
import { loadDecks, saveDecks } from "../lib/storage";

export function useDecks() {
  const [decks, setDecks] = useState<DeckPayload[]>(() => loadDecks());

  useEffect(() => {
    saveDecks(decks);
  }, [decks]);

  const createDeck = (name: string): DeckPayload => {
    const deck: DeckPayload = {
      id: `deck-${Date.now()}`,
      version: "1.0.0",
      name,
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDecks((prev) => [...prev, deck]);
    return deck;
  };

  const deleteDeck = (id: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== id));
  };

  const addCardToDeck = (deckId: string, card: CardPayload) => {
    setDecks((prev) =>
      prev.map((d) =>
        d.id === deckId
          ? { ...d, cards: [...d.cards, card], updatedAt: new Date().toISOString() }
          : d
      )
    );
  };

  const removeCardFromDeck = (deckId: string, cardId: string) => {
    setDecks((prev) =>
      prev.map((d) =>
        d.id === deckId
          ? {
              ...d,
              cards: d.cards.filter((c) => c.id !== cardId),
              updatedAt: new Date().toISOString(),
            }
          : d
      )
    );
  };

  const renameDeck = (id: string, name: string) => {
    setDecks((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d
      )
    );
  };

  return { decks, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, renameDeck };
}
