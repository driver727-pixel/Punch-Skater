import { useState } from "react";
import type { CardPayload } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { CardDisplay } from "../components/CardDisplay";
import { CardArt } from "../components/CardArt";
import { exportJson } from "../lib/storage";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";

export function Collection() {
  const { cards, removeCard } = useCollection();
  const { tier, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];
  const [selected, setSelected] = useState<CardPayload | null>(null);

  const handleExport = () => {
    exportJson({ version: "1.0.0", cards, exportedAt: new Date().toISOString() }, "skpd-collection.json");
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

  if (cards.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Collection</h1>
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p>No cards yet. Head to the Card Forge to create your first courier.</p>
        </div>
      </div>
    );
  }

  const cardLimit = tierData.cardLimit;
  const atLimit = cardLimit !== null && cards.length >= cardLimit;

  return (
    <div className="page">
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
          <button className="btn-outline" onClick={handleExport}>
            Export JSON
          </button>
        </div>
      </div>

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
              onRemove={tierData.canEditDecks ? () => {
                removeCard(selected.id);
                setSelected(null);
              } : undefined}
            />
            {!tierData.canEditDecks && (
              <div className="tier-lock-note">
                <span>🔒 Upgrade to Deck Master to remove cards</span>
                <button className="btn-outline btn-sm" onClick={openUpgradeModal}>Upgrade</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
