import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CardPayload, Rarity, Archetype, Faction, District } from "../lib/types";
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
import { sfxClick, sfxRemove, sfxSuccess } from "../lib/sfx";

type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "rarity";

const RARITY_ORDER: Record<Rarity, number> = {
  "Legendary": 0,
  "Rare": 1,
  "Master": 2,
  "Apprentice": 3,
  "Punch Skater": 4,
};
const UNKNOWN_RARITY_ORDER = 5;

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

  // ── Search, filter & sort state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRarity, setFilterRarity] = useState<Rarity | "">("");
  const [filterArchetype, setFilterArchetype] = useState<Archetype | "">("");
  const [filterFaction, setFilterFaction] = useState<Faction | "">("");
  const [filterDistrict, setFilterDistrict] = useState<District | "">("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const existingIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);

  useEffect(() => {
    const validIds = new Set(cards.map((card) => card.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setSelected((prev) => (prev && !validIds.has(prev.id) ? null : prev));
  }, [cards]);

  // Derive unique values from actual cards for filter dropdowns
  const filterOptions = useMemo(() => {
    const rarities = new Set<Rarity>();
    const archetypes = new Set<Archetype>();
    const factions = new Set<Faction>();
    const districts = new Set<District>();
    for (const c of cards) {
      rarities.add(c.prompts.rarity);
      archetypes.add(c.prompts.archetype);
      factions.add(c.identity.crew);
      districts.add(c.prompts.district);
    }
    return {
      rarities: [...rarities].sort(),
      archetypes: [...archetypes].sort(),
      factions: [...factions].sort(),
      districts: [...districts].sort(),
    };
  }, [cards]);

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (filterRarity ? 1 : 0) +
    (filterArchetype ? 1 : 0) +
    (filterFaction ? 1 : 0) +
    (filterDistrict ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterRarity("");
    setFilterArchetype("");
    setFilterFaction("");
    setFilterDistrict("");
    setSortBy("newest");
  };

  // ── Filtered & sorted cards ──────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = cards.filter((c) => {
      if (q) {
        const haystack = [
          c.identity.name,
          getDisplayedArchetype(c),
          c.identity.crew,
          c.prompts.rarity,
          c.prompts.district,
          c.flavorText,
          ...c.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterRarity && c.prompts.rarity !== filterRarity) return false;
      if (filterArchetype && c.prompts.archetype !== filterArchetype) return false;
      if (filterFaction && c.identity.crew !== filterFaction) return false;
      if (filterDistrict && c.prompts.district !== filterDistrict) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.identity.name.localeCompare(b.identity.name);
        case "name-desc":
          return b.identity.name.localeCompare(a.identity.name);
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "rarity":
          return (RARITY_ORDER[a.prompts.rarity] ?? UNKNOWN_RARITY_ORDER) - (RARITY_ORDER[b.prompts.rarity] ?? UNKNOWN_RARITY_ORDER);
        case "newest":
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

    return result;
  }, [cards, searchQuery, filterRarity, filterArchetype, filterFaction, filterDistrict, sortBy]);

  const selectedCards = useMemo(
    () => cards.filter((card) => selectedIds.has(card.id)),
    [cards, selectedIds],
  );
  const visibleSelectedCount = useMemo(
    () => filteredCards.reduce((count, card) => count + (selectedIds.has(card.id) ? 1 : 0), 0),
    [filteredCards, selectedIds],
  );
  const hasSelection = selectedIds.size > 0;
  const allFilteredSelected = filteredCards.length > 0 && visibleSelectedCount === filteredCards.length;

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredCards.forEach((card) => next.delete(card.id));
      } else {
        filteredCards.forEach((card) => next.add(card.id));
      }
      return next;
    });
  };

  const handleExport = (targetCards: CardPayload[] = cards, filename = "skpd-collection.json") => {
    exportJson({ version: "1.0.0", cards: targetCards, exportedAt: new Date().toISOString() }, filename);
  };

  const handleImportCards = (incoming: CardPayload[]) => {
    for (const card of incoming) addCard(card);
    if (incoming.length > 0) sfxSuccess();
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
        selected.prompts.rarity,
        selected.backgroundImageUrl,
        selected.characterImageUrl,
        selected.frameImageUrl,
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleBulkRemove = () => {
    if (selectedCards.length === 0) return;
    sfxRemove();
    for (const card of selectedCards) {
      removeCardFromAllDecks(card.id);
      removeCard(card.id);
    }
    if (selected && selectedIds.has(selected.id)) {
      setSelected(null);
    }
    clearSelection();
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
              Export All
            </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p>No cards yet. Head to the Card Forge to create your first courier.</p>
        </div>
      ) : (
        <>
          {/* ── Search / Filter / Sort toolbar ─────────────────────────── */}
          <div className="collection-toolbar">
            <div className="collection-search-row">
              <input
                className="input collection-search-input"
                type="text"
                placeholder="Search by name, archetype, faction, tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className={`btn-outline btn-sm collection-filter-toggle ${showFilters ? "collection-filter-toggle--active" : ""}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
              <select
                className="input collection-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name A → Z</option>
                <option value="name-desc">Name Z → A</option>
                <option value="rarity">Rarity</option>
              </select>
            </div>

            {showFilters && (
              <div className="collection-filters">
                <select
                  className="input collection-filter-select"
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value as Rarity | "")}
                >
                  <option value="">All Rarities</option>
                  {filterOptions.rarities.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <select
                  className="input collection-filter-select"
                  value={filterArchetype}
                  onChange={(e) => setFilterArchetype(e.target.value as Archetype | "")}
                >
                  <option value="">All Archetypes</option>
                  {filterOptions.archetypes.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>

                <select
                  className="input collection-filter-select"
                  value={filterFaction}
                  onChange={(e) => setFilterFaction(e.target.value as Faction | "")}
                >
                  <option value="">All Factions</option>
                  {filterOptions.factions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                <select
                  className="input collection-filter-select"
                  value={filterDistrict}
                  onChange={(e) => setFilterDistrict(e.target.value as District | "")}
                >
                  <option value="">All Districts</option>
                  {filterOptions.districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {activeFilterCount > 0 && (
                  <button className="btn-outline btn-sm" onClick={clearFilters}>
                    ✕ Clear All
                  </button>
                )}
              </div>
            )}

            {filteredCards.length !== cards.length && (
              <p className="collection-result-count">
                Showing {filteredCards.length} of {cards.length} card{cards.length !== 1 ? "s" : ""}
              </p>
            )}

            <div className="collection-bulk-bar">
              <span className="collection-bulk-count">
                {hasSelection
                  ? `${selectedIds.size} selected`
                  : `${filteredCards.length} visible`}
              </span>
              <div className="collection-bulk-actions">
                <button
                  className="btn-outline btn-sm"
                  onClick={toggleSelectAllFiltered}
                  disabled={filteredCards.length === 0}
                >
                  {allFilteredSelected ? "Clear Visible" : "Select All"}
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={clearSelection}
                  disabled={!hasSelection}
                >
                  Clear Selection
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => handleExport(selectedCards, "skpd-selected-collection.json")}
                  disabled={!hasSelection}
                >
                  Export Selected
                </button>
                {tierData.canEditDecks ? (
                  <button
                    className="btn-danger btn-sm"
                    onClick={handleBulkRemove}
                    disabled={!hasSelection}
                  >
                    Delete Selected
                  </button>
                ) : (
                  <button
                    className="btn-outline btn-sm"
                    onClick={openUpgradeModal}
                  >
                    🔒 Upgrade to Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>No cards match your search or filters.</p>
              <button className="btn-outline btn-sm" onClick={clearFilters}>Clear Filters</button>
            </div>
          ) : (
          <div className="collection-layout">
          <div className="card-grid">
            {filteredCards.map((card) => {
              const isCardSelected = selectedIds.has(card.id);
              return (
                <div
                  key={card.id}
                  className={`card-thumb ${selected?.id === card.id ? "card-thumb--active" : ""} ${isCardSelected ? "card-thumb--selected" : ""}`}
                 onClick={() => {
                   const next = selected?.id === card.id ? null : card;
                   if (next) sfxClick();
                   setSelected(next);
                 }}
               >
                 <button
                   type="button"
                   className={`card-thumb-select ${isCardSelected ? "card-thumb-select--active" : ""}`}
                   aria-label={`${isCardSelected ? "Deselect" : "Select"} ${card.identity.name}`}
                   onClick={(e) => {
                     e.stopPropagation();
                     toggleCardSelection(card.id);
                   }}
                 >
                   {isCardSelected ? "✓" : "+"}
                 </button>
                 <CardThumbnail card={card} width={160} height={224} />
                  <div className="card-thumb-info">
                    <span className="card-name">{card.identity.name}</span>
                    <span className="card-sub">{getDisplayedArchetype(card)} · {card.prompts.rarity}</span>
                  </div>
                </div>
              );
            })}
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
                      sfxRemove();
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
        </>
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
