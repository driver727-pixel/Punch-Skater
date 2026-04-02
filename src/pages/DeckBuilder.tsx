import { useState } from "react";
import type { DeckPayload, CardPayload } from "../lib/types";
import { useDecks } from "../hooks/useDecks";
import { useCollection } from "../hooks/useCollection";
import { CardArt } from "../components/CardArt";
import { exportJson } from "../lib/storage";
import { useTier } from "../context/TierContext";

export function DeckBuilder() {
  const { decks, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, renameDeck } = useDecks();
  const { cards } = useCollection();
  const { tier, openUpgradeModal } = useTier();

  const [activeDeck, setActiveDeck] = useState<DeckPayload | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  if (tier !== "tier3") {
    return (
      <div className="page">
        <h1 className="page-title">Deck Builder</h1>
        <div className="empty-state">
          <span className="empty-icon">🗂️</span>
          <p>The Deck Builder is available on the <strong>Deck Master</strong> tier.</p>
          <p className="page-sub">Manage multiple decks, edit all cards, and build custom character rosters.</p>
          <button className="btn-primary" onClick={openUpgradeModal}>Upgrade to Deck Master — $10</button>
        </div>
      </div>
    );
  }

  const handleCreate = () => {
    const name = newDeckName.trim() || `Deck ${decks.length + 1}`;
    const deck = createDeck(name);
    setActiveDeck(deck);
    setNewDeckName("");
  };

  const handleExportDeck = (deck: DeckPayload) => {
    exportJson(deck, `${deck.name.replace(/\s+/g, "-").toLowerCase()}.json`);
  };

  const handleAddCard = (card: CardPayload) => {
    if (!activeDeck) return;
    addCardToDeck(activeDeck.id, card);
    setActiveDeck((prev) =>
      prev ? { ...prev, cards: [...prev.cards, card] } : null
    );
  };

  const handleRemoveCard = (cardId: string) => {
    if (!activeDeck) return;
    removeCardFromDeck(activeDeck.id, cardId);
    setActiveDeck((prev) =>
      prev ? { ...prev, cards: prev.cards.filter((c) => c.id !== cardId) } : null
    );
  };

  const syncActiveDeck = (deckId: string) => {
    const fresh = decks.find((d) => d.id === deckId);
    if (fresh) setActiveDeck(fresh);
  };

  const handleStartRename = (deck: DeckPayload) => {
    setRenaming(deck.id);
    setRenameVal(deck.name);
  };

  const handleConfirmRename = () => {
    if (renaming && renameVal.trim()) {
      renameDeck(renaming, renameVal.trim());
      if (activeDeck?.id === renaming) {
        setActiveDeck((prev) => prev ? { ...prev, name: renameVal.trim() } : null);
      }
    }
    setRenaming(null);
  };

  const availableCards = cards.filter(
    (c) => !activeDeck?.cards.some((dc) => dc.id === c.id)
  );

  return (
    <div className="page">
      <h1 className="page-title">Deck Builder</h1>

      <div className="deck-layout">
        <div className="deck-sidebar">
          <div className="deck-create">
            <input
              className="input"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="New deck name..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button className="btn-primary" onClick={handleCreate}>+ New Deck</button>
          </div>

          <div className="deck-list">
            {decks.length === 0 && (
              <p className="empty-text">No decks yet.</p>
            )}
            {decks.map((deck) => (
              <div
                key={deck.id}
                className={`deck-item ${activeDeck?.id === deck.id ? "deck-item--active" : ""}`}
                onClick={() => { setActiveDeck(deck); syncActiveDeck(deck.id); }}
              >
                {renaming === deck.id ? (
                  <input
                    className="input rename-input"
                    value={renameVal}
                    autoFocus
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleConfirmRename(); if (e.key === "Escape") setRenaming(null); }}
                    onBlur={handleConfirmRename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="deck-name">{deck.name}</span>
                )}
                <span className="deck-count">{deck.cards.length} cards</span>
                <div className="deck-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" title="Rename" onClick={() => handleStartRename(deck)}>✎</button>
                  <button className="icon-btn" title="Export" onClick={() => handleExportDeck(deck)}>⬇</button>
                  <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => {
                    deleteDeck(deck.id);
                    if (activeDeck?.id === deck.id) setActiveDeck(null);
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="deck-main">
          {!activeDeck ? (
            <div className="empty-state">
              <span className="empty-icon">🗂️</span>
              <p>Select or create a deck to get started.</p>
            </div>
          ) : (
            <>
              <div className="deck-header">
                <h2>{activeDeck.name}</h2>
                <span className="deck-count">{activeDeck.cards.length} cards</span>
                <button className="btn-outline" onClick={() => handleExportDeck(activeDeck)}>Export JSON</button>
              </div>

              <div className="deck-section">
                <h3>Cards in Deck</h3>
                {activeDeck.cards.length === 0 ? (
                  <p className="empty-text">No cards in deck. Add from your collection below.</p>
                ) : (
                  <div className="card-grid card-grid--small">
                    {activeDeck.cards.map((card) => (
                      <div key={card.id} className="card-thumb">
                        <CardArt card={card} width={120} height={84} />
                        <div className="card-thumb-info">
                          <span className="card-name">{card.identity.name}</span>
                          <span className="card-sub">{card.prompts.archetype}</span>
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => handleRemoveCard(card.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="deck-section">
                <h3>Add from Collection</h3>
                {availableCards.length === 0 ? (
                  <p className="empty-text">
                    {cards.length === 0
                      ? "Your collection is empty. Forge some cards first."
                      : "All collection cards are already in this deck."}
                  </p>
                ) : (
                  <div className="card-grid card-grid--small">
                    {availableCards.map((card) => (
                      <div key={card.id} className="card-thumb card-thumb--add">
                        <CardArt card={card} width={120} height={84} />
                        <div className="card-thumb-info">
                          <span className="card-name">{card.identity.name}</span>
                          <span className="card-sub">{card.prompts.archetype}</span>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => handleAddCard(card)}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
