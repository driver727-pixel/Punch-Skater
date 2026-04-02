import { useState, useEffect } from "react";
import type { CardPayload } from "../lib/types";
import { loadCollection, saveCollection } from "../lib/storage";

export function useCollection() {
  const [cards, setCards] = useState<CardPayload[]>(() => loadCollection());

  useEffect(() => {
    saveCollection(cards);
  }, [cards]);

  const addCard = (card: CardPayload) => {
    setCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      return [...prev, card];
    });
  };

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const hasCard = (id: string) => cards.some((c) => c.id === id);

  return { cards, addCard, removeCard, hasCard };
}
