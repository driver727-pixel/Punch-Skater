import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { CardPayload } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { CardDisplay } from "../components/CardDisplay";
import { CardArt } from "../components/CardArt";
import { TradeModal } from "../components/TradeModal";
import { ImportModal } from "../components/ImportModal";
import { exportJson } from "../lib/storage";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";

export function Collection() {
  const { cards, removeCard, addCard, migrationPending, importLocalCards, dismissMigration } = useCollection();
  const { tier, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];
  const navigate = useNavigate();

  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [tradeTarget, setTradeTarget] = useState<CardPayload | null>(null);
  const [showImport, setShowImport] = useState(false);

  const existingIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);

  const handleExport = () => {
    exportJson({ version: "1.0.0", cards, exportedAt: new Date().toISOString() }, "skpd-collection.json");
  };

  const handleImportCards = (incoming: CardPayload[]) => {
    for (const card of incoming) addCard(card);
  };

  if (!tierData.canSave) {
    return (
      <div className="page">
        <h1 className="page-title">Collection</h1>
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <p>Account saving requires a paid tier.</p>
          <button className="btn-primary" onClick={openUpgradeModal}>Upgrade to Save Cards</button>
        </div>
      </div>
    );
  }

  const cardLimit = tierData.cardLimit;
  const atLimit = cardLimit !== null && cards.length >= cardLimit;

  return (
    <div className="page">
      {migrationPending && (
        <div className="migration-banner">
          <span>📦 You have cards saved locally. Import them to your cloud account?</span>
          <div className="migration-actions">
            <button className="btn-primary btn-sm" onClick={importLocalCards}>Import Cards</button>
            <button className="btn-outline btn-sm" onClick={dismissMigration}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Collection</h1>
          <p className="page-sub">
            {cardLimit !== null
              ? `${cards.length}/${cardLimit} cards saved`
              : `${cards.length} card${cards.length !== 1 ? "s" : ""} saved`}
          </p>
        </div>
        <div className="page-header-actions">
          {atLimit && (
              <button className="btn-primary btn-sm" onClick={openUpgradeModal}>
                Upgrade for More
              </button>
            )}
            <button className="btn-outline btn-sm" onClick={() => setShowImport(true)}>
              Import JSON
            </button>
            <button className="btn-outline" onClick={handleExport} disabled={cards.length === 0}>
            Export JSON
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p>No cards yet. Head to the Card Forge to create your first courier.</p>
        </div>
      ) : (
        <div className="collection-layout">
          <div className="card-grid">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`card-thumb ${selected?.id === card.id ? "card-thumb--active" : ""}`}
                onClick={() => setSelected(selected?.id === card.id ? null : card)}
              >
                <CardArt card={card} width={160} height={112} />
                <div className="card-thumb-info">
                  <span className="card-name">{card.identity.name}</span>
                  <span className="card-sub">{card.prompts.archetype} · {card.prompts.rarity}</span>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="card-detail-panel">
              <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
              <CardDisplay
                card={selected}
                showShare={true}
                onEdit={tierData.canSave ? () => navigate(`/edit/${selected.id}`) : undefined}
                onRemove={tierData.canEditDecks ? () => {
                  removeCard(selected.id);
                  setSelected(null);
                } : undefined}
              />
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => setTradeTarget(selected)}
                >
                  🤝 Offer Trade
                </button>
              </div>
              {!tierData.canEditDecks && (
                <div className="tier-lock-note">
                  <span>🔒 Upgrade to Deck Master to remove cards</span>
                  <button className="btn-outline btn-sm" onClick={openUpgradeModal}>Upgrade</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tradeTarget && (
        <TradeModal
          cards={cards}
          preselectedCard={tradeTarget}
          onClose={() => setTradeTarget(null)}
        />
      )}

      {showImport && (
        <ImportModal
          existingIds={existingIds}
          onImport={handleImportCards}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
