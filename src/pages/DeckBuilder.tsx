import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";
import type { DeckPayload, CardPayload } from "../lib/types";
import { useDecks, DECK_CARD_LIMIT } from "../hooks/useDecks";
import { useCollection } from "../hooks/useCollection";
import { useBattle, MIN_BATTLE_CARDS } from "../hooks/useBattle";
import { CardThumbnail } from "../components/CardThumbnail";
import { DeckStatsPanel } from "../components/DeckStatsPanel";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { computeDeckTotalPower } from "../lib/battle";
import { exportJson } from "../lib/storage";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";
import { sfxSuccess, sfxRemove, sfxClick } from "../lib/sfx";
import {
  isFirstDeck,
  canAddToFirstDeck,
  getFirstDeckInitiationStatus,
  FIRST_DECK_MIN_PUNCH_SKATERS,
} from "../lib/deckValidation";

const PORTRAIT_CARD_WIDTH = 120;
const PORTRAIT_CARD_HEIGHT = 168;
const DECK_SLOT_CARD_WIDTH = 110;
const DECK_SLOT_CARD_HEIGHT = 154;
const DECK_PREVIEW_CARD_WIDTH = 80;
const DECK_PREVIEW_CARD_HEIGHT = 112;
const MOBILE_LONG_PRESS_DELAY_MS = 280;
const TOUCH_MOVEMENT_THRESHOLD_PX = 10;

interface DeckTouchState {
  index: number;
  pointerId: number;
  dragging: boolean;
  startX: number;
  startY: number;
  element: HTMLDivElement | null;
}

function exceedsMovementThreshold(startX: number, startY: number, currentX: number, currentY: number, threshold: number) {
  return Math.hypot(currentX - startX, currentY - startY) > threshold;
}

export function DeckBuilder({ embedded = false }: { embedded?: boolean } = {}) {
  const { decks, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, renameDeck, moveCardInDeck, moveDeck } = useDecks();
  const { cards } = useCollection();
  const { tier, openUpgradeModal } = useTier();
  const { readyDeck, unreadyDeck, myArenaEntry } = useBattle();
  const tierData = TIERS[tier];

  const [activeDeck, setActiveDeck] = useState<DeckPayload | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [deckDragIdx, setDeckDragIdx] = useState<number | null>(null);
  const [deckDragOver, setDeckDragOver] = useState<number | null>(null);
  const [touchDraggingDeckId, setTouchDraggingDeckId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const deckLongPressTimerRef = useRef<number | null>(null);
  const deckTouchStateRef = useRef<DeckTouchState | null>(null);
  const ignoreDeckClickRef = useRef(false);

  // First-deck initiation status (only relevant when activeDeck is the first deck)
  const firstDeckInitStatus = useMemo(() => {
    if (!activeDeck || !isFirstDeck(activeDeck, decks)) return null;
    return getFirstDeckInitiationStatus(activeDeck.cards);
  }, [activeDeck, decks]);

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

  useEffect(() => () => {
    if (deckLongPressTimerRef.current !== null) {
      window.clearTimeout(deckLongPressTimerRef.current);
    }
  }, []);

  const deckTotalPowerById = useMemo(() => Object.fromEntries(
    decks.map((deck) => [
      deck.id,
      computeDeckTotalPower(deck.cards),
    ]),
  ), [decks]);

  // Free-tier users: see an empty gallery page with upgrade prompt
  if (!tierData.canSave) {
    const inner = (
      <>
        {!embedded && <h1 className="page-title">My Decks</h1>}
        <div className="empty-state">
          <span className="empty-icon">🗂️</span>
          <p>Your deck gallery is empty.</p>
          <p className="page-sub">Upgrade to start forging and saving cards to your decks.</p>
          <button className="btn-primary" onClick={openUpgradeModal}>Upgrade to Save Cards</button>
        </div>
      </>
    );
    return embedded ? inner : <div className="page">{inner}</div>;
  }

  const canCreateDeck = tierData.maxDecks === null || decks.length < tierData.maxDecks;

  const handleCreate = () => {
    const name = newDeckName.trim() || `Deck ${decks.length + 1}`;
    const deck = createDeck(name);
    sfxSuccess();
    setActiveDeck(deck);
    setNewDeckName("");
  };

  const handleExportDeck = (deck: DeckPayload) => {
    exportJson(deck, `${deck.name.replace(/\s+/g, "-").toLowerCase()}.json`);
  };

  const handleAddCard = (card: CardPayload) => {
    if (!activeDeck) return;
    if (activeDeck.cards.length >= DECK_CARD_LIMIT) return;

    // Enforce first-deck initiation rules
    if (isFirstDeck(activeDeck, decks)) {
      const check = canAddToFirstDeck(activeDeck.cards, card);
      if (!check.allowed) {
        setBlockedReason(check.reason);
        return;
      }
    }

    setBlockedReason(null);
    sfxClick();
    addCardToDeck(activeDeck.id, card);
  };

  const handleRemoveCard = (cardId: string) => {
    if (!activeDeck) return;
    sfxRemove();
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

  const clearDeckLongPressTimer = () => {
    if (deckLongPressTimerRef.current !== null) {
      window.clearTimeout(deckLongPressTimerRef.current);
      deckLongPressTimerRef.current = null;
    }
  };

  const resetDeckDragState = () => {
    clearDeckLongPressTimer();
    setDeckDragIdx(null);
    setDeckDragOver(null);
    setTouchDraggingDeckId(null);
    deckTouchStateRef.current = null;
  };

  const resolveDeckDropIndex = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-deck-index]");
    if (!target) return null;
    const value = Number.parseInt(target.dataset.deckIndex ?? "", 10);
    return Number.isNaN(value) ? null : value;
  };

  const handleDeckReorder = (toIndex: number | null) => {
    if (deckDragIdx !== null && toIndex !== null && deckDragIdx !== toIndex) {
      moveDeck(deckDragIdx, toIndex);
    }
    resetDeckDragState();
  };

  const handleDeckClick = (deck: DeckPayload) => {
    if (ignoreDeckClickRef.current) {
      ignoreDeckClickRef.current = false;
      return;
    }
    handleSetActiveDeck(deck);
  };

  const handleDeckDragStart = (event: ReactDragEvent<HTMLDivElement>, index: number) => {
    if ((event.target as HTMLElement).closest("button, input")) {
      event.preventDefault();
      return;
    }
    setDeckDragIdx(index);
    setDeckDragOver(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDeckPointerDown = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (event.pointerType !== "touch" || (event.target as HTMLElement).closest("button, input")) return;
    clearDeckLongPressTimer();
    deckTouchStateRef.current = {
      index,
      pointerId: event.pointerId,
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      element: event.currentTarget,
    };
    deckLongPressTimerRef.current = window.setTimeout(() => {
      const state = deckTouchStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      state.dragging = true;
      state.element?.setPointerCapture(event.pointerId);
      ignoreDeckClickRef.current = true;
      setDeckDragIdx(index);
      setDeckDragOver(index);
      setTouchDraggingDeckId(decks[index]?.id ?? null);
    }, MOBILE_LONG_PRESS_DELAY_MS);
  };

  const handleDeckPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = deckTouchStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (!state.dragging) {
      if (exceedsMovementThreshold(state.startX, state.startY, event.clientX, event.clientY, TOUCH_MOVEMENT_THRESHOLD_PX)) {
        clearDeckLongPressTimer();
        deckTouchStateRef.current = null;
      }
      return;
    }
    event.preventDefault();
    setDeckDragOver(resolveDeckDropIndex(event.clientX, event.clientY) ?? state.index);
  };

  const handleDeckPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = deckTouchStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    clearDeckLongPressTimer();
    if (state.element?.hasPointerCapture(event.pointerId)) {
      state.element.releasePointerCapture(event.pointerId);
    }
    if (state.dragging) {
      event.preventDefault();
      handleDeckReorder(resolveDeckDropIndex(event.clientX, event.clientY) ?? deckDragOver ?? state.index);
      return;
    }
    deckTouchStateRef.current = null;
  };

  const handleDeckPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = deckTouchStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    clearDeckLongPressTimer();
    if (state.element?.hasPointerCapture(event.pointerId)) {
      state.element.releasePointerCapture(event.pointerId);
    }
    resetDeckDragState();
  };

  const availableCards = cards.filter(
    (c) => !activeDeck?.cards.some((dc) => dc.id === c.id)
  );

  // Clear any blocked-card notice when switching decks
  const handleSetActiveDeck = (deck: DeckPayload) => {
    setBlockedReason(null);
    setActiveDeck(deck);
  };

  const slotsRemaining = activeDeck ? DECK_CARD_LIMIT - activeDeck.cards.length : 0;

  return (
    <div className={embedded ? undefined : "page"}>
      {!embedded && <h1 className="page-title">My Decks</h1>}

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
          <button className="btn-primary" onClick={() => { sfxClick(); handleCreate(); }}>+ New Deck</button>
              </div>
            )}

             <div className="deck-list" aria-describedby={decks.length > 0 ? "deck-reorder-hint" : undefined}>
               {decks.length === 0 && (
                 <p className="empty-text">No decks yet.</p>
               )}
               {decks.length > 0 && (
                 <p id="deck-reorder-hint" className="deck-reorder-hint" aria-live="polite">Drag decks to reorder them. On mobile, long-press and drag.</p>
               )}
               {decks.map((deck, deckIndex) => (
                 <div
                   key={deck.id}
                   data-deck-index={deckIndex}
                   className={`deck-item ${activeDeck?.id === deck.id ? "deck-item--active" : ""}${deckDragOver === deckIndex ? " deck-item--drag-over" : ""}${deckDragIdx === deckIndex ? " deck-item--dragging" : ""}${touchDraggingDeckId === deck.id ? " deck-item--touch-dragging" : ""}`}
                   draggable={renaming !== deck.id}
                   onClick={() => handleDeckClick(deck)}
                   onDragStart={(event) => handleDeckDragStart(event, deckIndex)}
                   onDragOver={(event) => {
                     event.preventDefault();
                     setDeckDragOver(deckIndex);
                   }}
                   onDragLeave={() => setDeckDragOver(null)}
                   onDrop={() => handleDeckReorder(deckIndex)}
                   onDragEnd={resetDeckDragState}
                   onPointerDown={(event) => handleDeckPointerDown(event, deckIndex)}
                   onPointerMove={handleDeckPointerMove}
                   onPointerUp={handleDeckPointerUp}
                   onPointerCancel={handleDeckPointerCancel}
                 >
                   <div className="deck-item-preview" aria-hidden="true">
                     {deck.cards.length > 0 ? (
                       deck.cards.slice(0, 5).map((card, previewIdx, previewCards) => {
                         const spread = previewIdx - (previewCards.length - 1) / 2;
                         const previewStyle = {
                           "--deck-preview-offset": `${spread * 18}px`,
                           "--deck-preview-rotate": `${spread * 6}deg`,
                           zIndex: previewIdx + 1,
                         } as CSSProperties;
                         return (
                           <div key={card.id} className="deck-preview-card" style={previewStyle}>
                             <CardThumbnail card={card} width={DECK_PREVIEW_CARD_WIDTH} height={DECK_PREVIEW_CARD_HEIGHT} />
                           </div>
                         );
                       })
                     ) : (
                       Array.from({ length: 3 }).map((_, previewIdx) => {
                         const spread = previewIdx - 1;
                         const previewStyle = {
                           "--deck-preview-offset": `${spread * 18}px`,
                           "--deck-preview-rotate": `${spread * 6}deg`,
                           zIndex: previewIdx + 1,
                         } as CSSProperties;
                         return (
                           <div key={previewIdx} className="deck-preview-card deck-preview-card--placeholder" style={previewStyle} />
                         );
                       })
                     )}
                   </div>

                   <div className="deck-item-row">
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
                       <div className="deck-item-info">
                         <span className="deck-name">{deck.name}</span>
                         <span className="deck-power">
                           <span aria-hidden="true">⚡</span> {deckTotalPowerById[deck.id] ?? 0} Power
                         </span>
                       </div>
                     )}
                     <span className="deck-count">{deck.cards.length}/{DECK_CARD_LIMIT}</span>
                   </div>

                   <div className="deck-actions" onClick={(e) => e.stopPropagation()}>
                     <button className="icon-btn" title="Rename" onClick={() => { sfxClick(); handleStartRename(deck); }}>✎</button>
                     <button className="icon-btn" title="Export" onClick={() => { sfxClick(); handleExportDeck(deck); }}>⬇</button>
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
                <button className="btn-outline" onClick={() => { sfxClick(); handleExportDeck(activeDeck); }}>Export JSON</button>
                {activeDeck.cards.length >= MIN_BATTLE_CARDS && (
                  <label className="battle-ready-toggle" title="Toggle Battle Ready status for this deck">
                    <input
                      type="checkbox"
                      checked={myArenaEntry?.deckId === activeDeck.id}
                      onChange={(e) => {
                        if (e.target.checked) {
                          readyDeck(activeDeck);
                        } else {
                          unreadyDeck();
                        }
                      }}
                    />
                    <span className="battle-ready-label">⚔️ Battle Ready</span>
                  </label>
                )}
              </div>

              {/* First-deck initiation banner */}
              {firstDeckInitStatus && !firstDeckInitStatus.initiated && (
                <div className="deck-initiation-banner">
                  <span className="deck-initiation-icon">🛹</span>
                  <div className="deck-initiation-text">
                    <strong>First Deck Initiation</strong>
                    <span>
                      Add {firstDeckInitStatus.punchSkatersNeeded} more Punch Skater card{firstDeckInitStatus.punchSkatersNeeded !== 1 ? "s" : ""} to unlock all card types.
                      {" "}You currently have {firstDeckInitStatus.punchSkaterCount}/{FIRST_DECK_MIN_PUNCH_SKATERS} Punch Skaters
                      {firstDeckInitStatus.legendaryCount > 0 && " · 1 Legendary slot used"}.
                    </span>
                  </div>
                </div>
              )}
              {firstDeckInitStatus?.initiated && (
                <div className="deck-initiation-banner deck-initiation-banner--complete">
                  <span className="deck-initiation-icon">✅</span>
                  <span>First deck initiated — all card types may be added freely.</span>
                </div>
              )}

              {/* Blocked-add notice */}
              {blockedReason && (
                <div className="deck-blocked-notice" role="alert">
                  <span>⚠️ {blockedReason}</span>
                  <button
                    className="icon-btn"
                    aria-label="Dismiss"
                    onClick={() => { sfxClick(); setBlockedReason(null); }}
                  >✕</button>
                </div>
              )}

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
                               <CardThumbnail card={card} width={DECK_SLOT_CARD_WIDTH} height={DECK_SLOT_CARD_HEIGHT} />
                             </div>
                             <div className="deck-slot-info">
                               <span className="card-name">{card.identity.name}</span>
                              <span className="card-sub">{getDisplayedArchetype(card)}</span>
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

              {/* Deck Stats — total power bars */}
              {activeDeck.cards.length > 0 && (
                <DeckStatsPanel cards={activeDeck.cards} maxCardsInDeck={DECK_CARD_LIMIT} />
              )}

              {/* Add from collection */}
              {slotsRemaining > 0 && availableCards.length > 0 && (
                <div className="deck-section">
                  <h3>Add from Collection ({slotsRemaining} slot{slotsRemaining !== 1 ? "s" : ""} remaining)</h3>
                  <div className="card-grid card-grid--small">
                    {availableCards.map((card) => {
                      const addCheck = isFirstDeck(activeDeck, decks)
                        ? canAddToFirstDeck(activeDeck.cards, card)
                        : { allowed: true as const };
                      const blocked = !addCheck.allowed;
                       return (
                         <div key={card.id} className={`card-thumb card-thumb--add${blocked ? " card-thumb--blocked" : ""}`}>
                           <CardThumbnail card={card} width={PORTRAIT_CARD_WIDTH} height={PORTRAIT_CARD_HEIGHT} />
                           <div className="card-thumb-info">
                             <span className="card-name">{card.identity.name}</span>
                            <span className="card-sub">{getDisplayedArchetype(card)}</span>
                            <button
                              className={blocked ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
                              title={blocked ? addCheck.reason : undefined}
                              onClick={() => handleAddCard(card)}
                            >
                              {blocked ? "Locked 🔒" : "Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {slotsRemaining === 0 && (
                <div className="deck-full-notice">
                  <span>🃏 Deck is full ({DECK_CARD_LIMIT}/{DECK_CARD_LIMIT} cards).</span>
                  {canCreateDeck ? (
                    <span> Create a new deck to save more cards.</span>
                  ) : (
                    <span> <button className="btn-outline btn-sm" onClick={() => { sfxClick(); openUpgradeModal(); }}>Upgrade for more decks</button></span>
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
