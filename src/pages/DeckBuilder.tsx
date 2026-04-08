import { useState, useEffect } from "react";
import type { DeckPayload, CardPayload } from "../lib/types";
import { useDecks, DECK_CARD_LIMIT } from "../hooks/useDecks";
import { useCollection } from "../hooks/useCollection";
import { CardThumbnail } from "../components/CardThumbnail";
import { exportJson } from "../lib/storage";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";

export function DeckBuilder() {
  const { decks, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, renameDeck, moveCardInDeck } = useDecks();
  const { cards } = useCollection();
  const { tier, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];

  const [activeDeck, setActiveDeck] = useState<DeckPayload | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Auto-select the first deck when decks load (and none is selected)
  useEffect(() => {
    if (!activeDeck && decks.length > 0) {
      setActiveDeck(decks[0]);
    }
  }, [decks, activeDeck]);

  // Keep activeDeck in sync with Firestore updates
  useEffect(() => {
    if (activeDeck) {
      const fresh = decks.find((d) => d.id === activeDeck.id);
      if (fresh) setActiveDeck(fresh);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks]);

  // Free-tier users: see an empty gallery page with upgrade prompt
  if (!tierData.canSave) {
    return (
      <div className="page">
        <h1 className="page-title">My Decks</h1>
        <div className="empty-state">
          <span className="empty-icon">🗂️</span>
          <p>Your deck gallery is empty.</p>
          <p className="page-sub">Upgrade to start forging and saving cards to your decks.</p>
          <button className="btn-primary" onClick={openUpgradeModal}>Upgrade to Save Cards</button>
        </div>
      </div>
    );
  }

  const canCreateDeck = tierData.maxDecks === null || decks.length < tierData.maxDecks;

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
    if (activeDeck.cards.length >= DECK_CARD_LIMIT) return;
    addCardToDeck(activeDeck.id, card);
  };

  const handleRemoveCard = (cardId: string) => {
    if (!activeDeck) return;
    removeCardFromDeck(activeDeck.id, cardId);
  };

  const handleStartRename = (deck: DeckPayload) => {
    setRenaming(deck.id);
    setRenameVal(deck.name);
  };

  const handleConfirmRename = () => {
    if (renaming && renameVal.trim()) {
      renameDeck(renaming, renameVal.trim());
    }
    setRenaming(null);
  };

  const handleDrop = (toIndex: number) => {
    if (dragIdx === null || !activeDeck) return;
    const fromCard = activeDeck.cards[dragIdx];
    if (!fromCard) return;
    if (dragIdx !== toIndex) {
      moveCardInDeck(activeDeck.id, dragIdx, toIndex);
    }
    setDragIdx(null);
    setDragOver(null);
  };

  const availableCards = cards.filter(
    (c) => !activeDeck?.cards.some((dc) => dc.id === c.id)
  );

  const slotsRemaining = activeDeck ? DECK_CARD_LIMIT - activeDeck.cards.length : 0;

  return (
    <div className="page">
      <h1 className="page-title">My Decks</h1>

      <div className={tierData.canEditDecks ? "deck-layout" : ""}>
        {/* Sidebar: deck list — only shown for Deck Master (tier3) */}
        {tierData.canEditDecks && (
          <div className="deck-sidebar">
            {canCreateDeck && (
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
            )}

            <div className="deck-list">
              {decks.length === 0 && (
                <p className="empty-text">No decks yet.</p>
              )}
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className={`deck-item ${activeDeck?.id === deck.id ? "deck-item--active" : ""}`}
                  onClick={() => setActiveDeck(deck)}
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
                  <span className="deck-count">{deck.cards.length}/{DECK_CARD_LIMIT}</span>
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
        )}

        <div className="deck-main">
          {!activeDeck ? (
            <div className="empty-state">
              <span className="empty-icon">🗂️</span>
              <p>
                {decks.length === 0
                  ? "No decks yet. Save cards to your Collection first, then add them here to build a deck."
                  : "Select a deck to view its cards."}
              </p>
            </div>
          ) : (
            <>
              <div className="deck-header">
                <h2>{activeDeck.name}</h2>
                <span className="deck-count">{activeDeck.cards.length}/{DECK_CARD_LIMIT} cards</span>
                <button className="btn-outline" onClick={() => handleExportDeck(activeDeck)}>Export JSON</button>
              </div>

              {/* 6-slot card gallery with drag-to-reorder */}
              <div className="deck-section">
                <h3>Cards — drag to reorder</h3>
                <div className="deck-slots">
                  {Array.from({ length: DECK_CARD_LIMIT }).map((_, slotIdx) => {
                    const card = activeDeck.cards[slotIdx];
                    const isDraggingOver = dragOver === slotIdx;
                    return (
                      <div
                        key={slotIdx}
                        className={`deck-slot${card ? " deck-slot--filled" : " deck-slot--empty"}${isDraggingOver ? " deck-slot--drag-over" : ""}`}
                        draggable={!!card}
                        onDragStart={() => { if (card) setDragIdx(slotIdx); }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(slotIdx); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => handleDrop(slotIdx)}
                        onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
                      >
                        {card ? (
                          <div className="deck-slot-card">
                            <div className="deck-slot-art">
                              <CardThumbnail card={card} width={110} height={76} />
                            </div>
                            <div className="deck-slot-info">
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
                        ) : (
                          <div className="deck-slot-placeholder">
                            <span className="deck-slot-num">{slotIdx + 1}</span>
                            <span className="deck-slot-hint">Empty slot</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add from collection */}
              {slotsRemaining > 0 && availableCards.length > 0 && (
                <div className="deck-section">
                  <h3>Add from Collection ({slotsRemaining} slot{slotsRemaining !== 1 ? "s" : ""} remaining)</h3>
                  <div className="card-grid card-grid--small">
                    {availableCards.map((card) => (
                      <div key={card.id} className="card-thumb card-thumb--add">
                        <CardThumbnail card={card} width={120} height={84} />
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
                </div>
              )}

              {slotsRemaining === 0 && (
                <div className="deck-full-notice">
                  <span>🃏 Deck is full ({DECK_CARD_LIMIT}/{DECK_CARD_LIMIT} cards).</span>
                  {canCreateDeck ? (
                    <span> Create a new deck to save more cards.</span>
                  ) : (
                    <span> <button className="btn-outline btn-sm" onClick={openUpgradeModal}>Upgrade for more decks</button></span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
