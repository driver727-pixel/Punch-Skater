import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { CardPayload } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { CardDisplay } from "../components/CardDisplay";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { CardThumbnail } from "../components/CardThumbnail";
import { TradeModal } from "../components/TradeModal";
import { ImportModal } from "../components/ImportModal";
import { ShareModal } from "../components/ShareModal";
import { CardViewer3D } from "../components/CardViewer3D";
import { PrintModal } from "../components/PrintModal";
import { exportJson } from "../lib/storage";
import { downloadCardAsJpg } from "../services/cardDownload";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";

export function Collection() {
  const { cards, removeCard, addCard, updateCard, migrationPending, importLocalCards, dismissMigration } = useCollection();
  const { removeCardFromAllDecks } = useDecks();
  const { tier, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];
  const navigate = useNavigate();

  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [tradeTarget, setTradeTarget] = useState<CardPayload | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [viewing3D, setViewing3D] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const existingIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);

  const handleExport = () => {
    exportJson({ version: "1.0.0", cards, exportedAt: new Date().toISOString() }, "skpd-collection.json");
  };

  const handleImportCards = (incoming: CardPayload[]) => {
    for (const card of incoming) addCard(card);
  };

  const handleCardUpdate = (updates: { name?: string; age?: string; flavorText?: string }) => {
    if (!selected) return;
    const updated: CardPayload = {
      ...selected,
      identity: {
        ...selected.identity,
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.age !== undefined ? { age: updates.age } : {}),
      },
      flavorText: updates.flavorText ?? selected.flavorText,
    };
    updateCard(updated);
    setSelected(updated);
  };

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      await downloadCardAsJpg(
        selected.identity.name,
        selected.backgroundImageUrl,
        selected.characterImageUrl,
        selected.frameImageUrl,
      );
    } finally {
      setDownloading(false);
    }
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
                <CardThumbnail card={card} width={160} height={224} />
                <div className="card-thumb-info">
                  <span className="card-name">{card.identity.name}</span>
                  <span className="card-sub">{getDisplayedArchetype(card)} · {card.prompts.rarity}</span>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="card-detail-panel">
              <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
              <CardDisplay
                card={selected}
                onUpdate={tierData.canSave ? handleCardUpdate : undefined}
                hideAllActions
              />
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {tierData.canSave && (
                  <button
                    className="btn-outline btn-sm"
                    onClick={() => navigate(`/edit/${selected.id}`)}
                  >
                    ✎ Edit
                  </button>
                )}
                <button
                  className="btn-outline btn-3d btn-sm"
                  onClick={() => setViewing3D(true)}
                  title="View card in 3D"
                >
                  ◈ 3D
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => setPrinting(true)}
                  title="Print this card"
                >
                  🖨 Print
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => setSharing(true)}
                >
                  ↗ Share
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={handleDownload}
                  disabled={downloading}
                  title="Download card as image"
                >
                  {downloading ? "⏳ Downloading…" : "⬇ Download"}
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => setTradeTarget(selected)}
                >
                  🤝 Send Offer
                </button>
                {tierData.canEditDecks ? (
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => {
                      removeCardFromAllDecks(selected.id);
                      removeCard(selected.id);
                      setSelected(null);
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <div className="tier-lock-note">
                    <span>🔒 Upgrade to Deck Master to remove cards</span>
                    <button className="btn-outline btn-sm" onClick={openUpgradeModal}>Upgrade</button>
                  </div>
                )}
              </div>
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

      {sharing && selected && (
        <ShareModal card={selected} onClose={() => setSharing(false)} />
      )}

      {viewing3D && selected && (
        <CardViewer3D
          card={selected}
          backgroundImageUrl={selected.backgroundImageUrl}
          characterImageUrl={selected.characterImageUrl}
          frameImageUrl={selected.frameImageUrl}
          onClose={() => setViewing3D(false)}
        />
      )}

      {printing && selected && (
        <PrintModal
          card={selected}
          backgroundImageUrl={selected.backgroundImageUrl}
          characterImageUrl={selected.characterImageUrl}
          frameImageUrl={selected.frameImageUrl}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
