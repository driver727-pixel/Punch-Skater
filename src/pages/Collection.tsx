import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { CardPayload, Rarity, Archetype, Faction, District } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useAuth } from "../context/AuthContext";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { CardThumbnail } from "../components/CardThumbnail";
import { TradeModal } from "../components/TradeModal";
import { ImportModal } from "../components/ImportModal";
import { ShareModal } from "../components/ShareModal";
import { CardViewer3D } from "../components/CardViewer3D";
import { PrintModal } from "../components/PrintModal";
import { PrintedCardPreviewPair } from "../components/PrintedCardFaces";
import { CardContainer } from "../components/CardContainer";
import { exportJson } from "../lib/storage";
import { buildCardVars } from "../lib/cardVars";
import { downloadCardAsJpg } from "../services/cardDownload";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";
import { sfxClick, sfxRemove, sfxSuccess } from "../lib/sfx";
import { DeckBuilder } from "./DeckBuilder";
import {
  evaluateCollectionRewards,
  type CollectionRewardEvaluation,
  type CollectionRewardFilter,
} from "../lib/collectionRewards";
import { claimCollectionReward, fetchCollectionRewards } from "../services/collectionRewards";

type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "rarity";
const COLLECTION_PAGE_SIZE = 24;

const RARITY_ORDER: Record<Rarity, number> = {
  "Legendary": 0,
  "Rare": 1,
  "Master": 2,
  "Apprentice": 3,
  "Punch Skater™": 4,
};
const UNKNOWN_RARITY_ORDER = 5;
const COLLECTION_CAROUSEL_SWIPE_THRESHOLD = 40;
const COLLECTION_CAROUSEL_MAX_Z_INDEX = 30;
type CarouselCardStyle = CSSProperties & {
  "--carousel-offset": number;
  "--carousel-abs-offset": number;
};

function formatCollectionRewardMeta(track: string, seasonal?: boolean): string {
  return seasonal ? `${track} · seasonal` : track;
}

export function Collection() {
  const { user } = useAuth();
  const { cards, removeCard, addCard, migrationPending, importLocalCards, dismissMigration } = useCollection();
  const { removeCardFromAllDecks } = useDecks();
  const { tier, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"collection" | "decks">(
    () => (searchParams.get("tab") === "decks" ? "decks" : "collection")
  );

  // Sync tab state with URL on external navigation (back/forward)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const urlTab = tabParam === "decks" ? "decks" : "collection";
    setActiveTab(urlTab);
  }, [searchParams]);

  const handleTabChange = (tab: "collection" | "decks") => {
    setSearchParams(tab === "decks" ? { tab: "decks" } : {}, { replace: true });
  };

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
  const [rewardFilter, setRewardFilter] = useState<CollectionRewardFilter>("all");
  const [rewardEvaluation, setRewardEvaluation] = useState<CollectionRewardEvaluation>(() => evaluateCollectionRewards([]));
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardClaimingId, setRewardClaimingId] = useState<string | null>(null);
  const [rewardMessage, setRewardMessage] = useState("");
  const [rewardError, setRewardError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselSwipeStartX = useRef<number | null>(null);

  const existingIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);

  useEffect(() => {
    let cancelled = false;
    setRewardError("");
    setRewardMessage("");

    if (!user) {
      setRewardEvaluation(evaluateCollectionRewards(cards));
      return;
    }

    setRewardLoading(true);
    fetchCollectionRewards(user)
      .then((result) => {
        if (!cancelled) setRewardEvaluation(result.evaluation);
      })
      .catch((error) => {
        if (!cancelled) {
          setRewardEvaluation(evaluateCollectionRewards(cards));
          setRewardError(error instanceof Error ? error.message : "Failed to load collection rewards.");
        }
      })
      .finally(() => {
        if (!cancelled) setRewardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cards, user]);

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
    setSelected((prev) => (prev ? cards.find((card) => card.id === prev.id) ?? null : prev));
  }, [cards]);

  // Close card detail panel on Escape key
  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selected]);

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
          c.class.badgeLabel,
          c.role.label,
          c.role.coverRole,
          c.identity.serialNumber,
          c.prompts.rarity,
          c.prompts.district,
          c.front.flavorTextEnglish ?? c.front.flavorText ?? "",
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
  const pageSize = COLLECTION_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pagedCards = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPageSafe, pageSize]);
  const carouselCardCount = pagedCards.length;
  const visibleSelectedCount = useMemo(
    () => pagedCards.reduce((count, card) => count + (selectedIds.has(card.id) ? 1 : 0), 0),
    [pagedCards, selectedIds],
  );
  const hasSelection = selectedIds.size > 0;
  const allPagedSelected = pagedCards.length > 0 && visibleSelectedCount === pagedCards.length;
  const rewardMilestones = useMemo(() => {
    const milestones = rewardEvaluation.milestones;
    switch (rewardFilter) {
      case "claimable":
        return milestones.filter((entry) => entry.eligible && !entry.claimed);
      case "owned":
        return milestones.filter((entry) => entry.claimed);
      case "locked":
        return milestones.filter((entry) => !entry.eligible);
      case "faction":
        return milestones.filter((entry) => entry.milestone.track === "faction");
      case "district":
        return milestones.filter((entry) => entry.milestone.track === "district");
      case "seasonal":
        return milestones.filter((entry) => entry.milestone.seasonal);
      case "all":
      default:
        return milestones;
    }
  }, [rewardEvaluation.milestones, rewardFilter]);
  const claimableRewardCount = rewardEvaluation.milestones.filter((entry) => entry.eligible && !entry.claimed).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRarity, filterArchetype, filterFaction, filterDistrict, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [currentPageSafe, searchQuery, filterRarity, filterArchetype, filterFaction, filterDistrict, sortBy]);

  const handleClaimReward = async (milestoneId: string) => {
    if (!user) return;
    setRewardClaimingId(milestoneId);
    setRewardError("");
    setRewardMessage("");
    try {
      const result = await claimCollectionReward(user, milestoneId);
      setRewardEvaluation(result.evaluation);
      setRewardMessage(
        result.claimed
          ? `Claimed ${result.rewards.map((reward) => reward.name).join(", ")}.`
          : "Milestone was already claimed.",
      );
      if (result.claimed) sfxSuccess();
    } catch (error) {
      setRewardError(error instanceof Error ? error.message : "Failed to claim collection reward.");
    } finally {
      setRewardClaimingId(null);
    }
  };

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
      if (allPagedSelected) {
        pagedCards.forEach((card) => next.delete(card.id));
      } else {
        pagedCards.forEach((card) => next.add(card.id));
      }
      return next;
    });
  };

  const spinCarousel = (direction: -1 | 1) => {
    if (carouselCardCount <= 1) return;
    setCarouselIndex((prev) => (prev + direction + carouselCardCount) % carouselCardCount);
  };

  const getCarouselOffset = (index: number) => {
    if (carouselCardCount <= 1) return 0;
    let offset = index - carouselIndex;
    const halfway = carouselCardCount / 2;
    if (offset > halfway) offset -= carouselCardCount;
    if (offset < -halfway) offset += carouselCardCount;
    return offset;
  };

  const handleCarouselSwipeEnd = (clientX: number) => {
    if (carouselSwipeStartX.current === null) return;
    const deltaX = clientX - carouselSwipeStartX.current;
    carouselSwipeStartX.current = null;
    if (Math.abs(deltaX) < COLLECTION_CAROUSEL_SWIPE_THRESHOLD) return;
    spinCarousel(deltaX > 0 ? -1 : 1);
  };

  const handleExport = (targetCards: CardPayload[] = cards, filename = "skpd-collection.json") => {
    exportJson({ version: "1.0.0", cards: targetCards, exportedAt: new Date().toISOString() }, filename);
  };

  const handleImportCards = (incoming: CardPayload[]) => {
    for (const card of incoming) addCard(card);
    if (incoming.length > 0) sfxSuccess();
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
        selected.frameSeed,
        selected.visuals.accentColor,
        1,
        selected.board.imageUrl,
        selected.characterSeed,
        selected.board.placement,
        selected.characterPlacement,
        selected.board.layerOrder,
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

  const tabBar = (
    <div className="collection-tabs">
      <button
        className={`collection-tab${activeTab === "collection" ? " collection-tab--active" : ""}`}
        onClick={() => handleTabChange("collection")}
      >
        Collection
      </button>
      <button
        className={`collection-tab${activeTab === "decks" ? " collection-tab--active" : ""}`}
        onClick={() => handleTabChange("decks")}
      >
        My Decks
      </button>
    </div>
  );

  if (!tierData.canSave) {
    return (
      <div className="page">
        {tabBar}
        {activeTab === "decks" ? (
          <DeckBuilder embedded />
        ) : (
          <>
            <h1 className="page-title">Collection</h1>
            <div className="empty-state">
              <span className="empty-icon">🔒</span>
              <p>Account saving requires a paid tier.</p>
              <button className="btn-outline" onClick={() => navigate("/forge")}>Back to Card Forge</button>
              <button className="btn-primary" onClick={openUpgradeModal}>Upgrade to Save Cards</button>
            </div>
          </>
        )}
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

      {tabBar}

      {activeTab === "decks" ? (
        <DeckBuilder embedded />
      ) : (
      <>
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
            <button className="btn-outline" onClick={() => handleExport()} disabled={cards.length === 0}>
              Export All
            </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p>No cards yet. Head to the Card Forge to create your first courier.</p>
          <button className="btn-primary btn-sm" onClick={() => navigate("/forge")}>Open Card Forge</button>
        </div>
      ) : (
        <>
          <section className="collection-rewards-panel" aria-label="Collection rewards">
            <div className="collection-rewards-header">
              <div>
                <p className="eyebrow">Cosmetic Prestige</p>
                <h2>Collection Rewards</h2>
                <p>
                  Badges, titles, frames, lore, and capped cosmetic reroll tokens. No stat boosts, rarity guarantees,
                  Deck Power bonuses, or battle advantages.
                </p>
              </div>
              <div className="collection-rewards-score">
                <span>Collection Score</span>
                <strong>{rewardEvaluation.score}</strong>
                <small>{rewardEvaluation.uniqueCardCount} unique  ·  {rewardEvaluation.duplicateVolumeScore} duplicate volume</small>
              </div>
            </div>

            <div className="collection-rewards-stats">
              <span><strong>{rewardEvaluation.state.badgeIds.length}</strong> Badges</span>
              <span><strong>{rewardEvaluation.state.titleIds.length}</strong> Titles</span>
              <span><strong>{rewardEvaluation.state.frameIds.length}</strong> Frames</span>
              <span><strong>{rewardEvaluation.state.loreIds.length}</strong> Lore</span>
              <span><strong>{rewardEvaluation.state.rerollTokens}</strong> Cosmetic rerolls</span>
              <span><strong>{claimableRewardCount}</strong> Claimable</span>
            </div>

            <div className="collection-rewards-filters">
              {(["all", "claimable", "owned", "locked", "faction", "district", "seasonal"] as CollectionRewardFilter[]).map((filter) => (
                <button
                  key={filter}
                  className={rewardFilter === filter ? "btn-primary btn-sm" : "btn-outline btn-sm"}
                  type="button"
                  onClick={() => setRewardFilter(filter)}
                >
                  {filter[0].toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {rewardMessage && <div className="collection-rewards-message collection-rewards-message--ok">{rewardMessage}</div>}
            {rewardError && <div className="collection-rewards-message collection-rewards-message--error">{rewardError}</div>}
            {rewardLoading && <div className="collection-rewards-message app-status-banner">Syncing reward claims…</div>}

            <div className="collection-rewards-list">
              {rewardMilestones.slice(0, 12).map((entry) => (
                <article
                  key={entry.milestone.id}
                  className={`collection-reward-card${entry.claimed ? " collection-reward-card--owned" : ""}${entry.eligible && !entry.claimed ? " collection-reward-card--claimable" : ""}`}
                >
                  <div className="collection-reward-card__top">
                    <div>
                      <strong>{entry.milestone.name}</strong>
                      <span>{formatCollectionRewardMeta(entry.milestone.track, entry.milestone.seasonal)}</span>
                    </div>
                    <span className="collection-reward-card__status">
                      {entry.claimed ? "Owned" : entry.eligible ? "Claimable" : `${entry.percent}%`}
                    </span>
                  </div>
                  <p>{entry.milestone.description}</p>
                  <div className="collection-reward-progress" aria-label={`${entry.current} of ${entry.target}`}>
                    <span style={{ width: `${entry.percent}%` }} />
                  </div>
                  <div className="collection-reward-card__rewards">
                    {entry.rewards.map((reward) => (
                      <span key={reward.id} className={`collection-reward-chip collection-reward-chip--${reward.kind}`}>
                        {reward.kind.replace(/_/g, " ")} · {reward.name}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    type="button"
                    disabled={!entry.eligible || entry.claimed || rewardClaimingId !== null || !user}
                    onClick={() => handleClaimReward(entry.milestone.id)}
                  >
                    {rewardClaimingId === entry.milestone.id ? "Claiming…" : entry.claimed ? "Claimed" : "Claim"}
                  </button>
                </article>
              ))}
            </div>
          </section>

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

            <div className="collection-pagination" role="navigation" aria-label="Collection pages">
              <button
                className="btn-outline btn-sm"
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPageSafe <= 1}
              >
                Prev
              </button>
              <span className="collection-pagination__meta">
                Page {currentPageSafe} of {totalPages}
              </span>
              <button
                className="btn-outline btn-sm"
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPageSafe >= totalPages}
              >
                Next
              </button>
            </div>

            <div className="collection-bulk-bar">
              <span className="collection-bulk-count">
                {hasSelection
                  ? `${selectedIds.size} selected`
                  : totalPages === 1
                    ? `${pagedCards.length} visible`
                    : `${pagedCards.length} on this page`}
              </span>
              <div className="collection-bulk-actions">
                <button
                  className="btn-outline btn-sm"
                  onClick={toggleSelectAllFiltered}
                  disabled={pagedCards.length === 0}
                >
                  {allPagedSelected ? "Clear Page" : "Select All on Page"}
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
          <>
          {selected && (
            <div
              className="card-detail-backdrop"
              aria-hidden="true"
              onClick={() => setSelected(null)}
            />
          )}
          <div className="collection-layout collection-layout--carousel">
          <section className="collection-carousel-panel" aria-label="Card carousel">
            <div className="collection-carousel-header">
              <div>
                <p className="eyebrow">Swipe gallery</p>
                <h2>Spin through your cards</h2>
                <p>Swipe left or right on mobile, or use the arrows to rotate the gallery.</p>
              </div>
              <div className="collection-carousel-controls">
                <button
                  className="btn-outline collection-carousel-arrow"
                  type="button"
                  aria-label="Previous card"
                  onClick={() => spinCarousel(-1)}
                  disabled={carouselCardCount <= 1}
                >
                  ‹
                </button>
                <span className="collection-carousel-count">
                  {carouselIndex + 1} / {carouselCardCount}
                </span>
                <button
                  className="btn-outline collection-carousel-arrow"
                  type="button"
                  aria-label="Next card"
                  onClick={() => spinCarousel(1)}
                  disabled={carouselCardCount <= 1}
                >
                  ›
                </button>
              </div>
            </div>
            <div
              className="collection-carousel-stage"
              role="list"
              aria-live="polite"
              onPointerDown={(event) => {
                carouselSwipeStartX.current = event.clientX;
              }}
              onPointerUp={(event) => handleCarouselSwipeEnd(event.clientX)}
              onPointerCancel={() => {
                carouselSwipeStartX.current = null;
              }}
            >
            {pagedCards.map((card, index) => {
              const isCardSelected = selectedIds.has(card.id);
              const carouselOffset = getCarouselOffset(index);
              const isCarouselActive = carouselOffset === 0;
              const isCarouselVisible = Math.abs(carouselOffset) <= 3;
              return (
                <div
                  key={card.id}
                  className={`card-thumb collection-carousel-card ${selected?.id === card.id ? "card-thumb--active" : ""} ${isCardSelected ? "card-thumb--selected" : ""} ${isCarouselActive ? "collection-carousel-card--center" : ""}`}
                 style={{
                   "--carousel-offset": carouselOffset,
                   "--carousel-abs-offset": Math.abs(carouselOffset),
                   zIndex: isCarouselVisible ? COLLECTION_CAROUSEL_MAX_Z_INDEX - Math.abs(carouselOffset) : 0,
                 } satisfies CarouselCardStyle}
                 role={isCarouselVisible ? "listitem" : "presentation"}
                 aria-current={isCarouselActive ? "true" : undefined}
                 aria-hidden={!isCarouselVisible}
                 data-carousel-hidden={!isCarouselVisible ? "true" : undefined}
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
                <button
                 type="button"
                 className="collection-carousel-card__button"
                 aria-label={`Open ${card.identity.name}`}
                 onClick={() => {
                   setCarouselIndex(index);
                   const next = selected?.id === card.id ? null : card;
                   if (next) sfxClick();
                   setSelected(next);
                 }}
                 onKeyDown={(event) => {
                   if (event.key === "ArrowLeft") {
                     event.preventDefault();
                     spinCarousel(-1);
                   }
                   if (event.key === "ArrowRight") {
                     event.preventDefault();
                     spinCarousel(1);
                   }
                 }}
                >
                 <CardThumbnail card={card} width={160} height={224} />
                  <div className="card-thumb-info">
                    <span className="card-name">{card.identity.name}</span>
                    <span className="card-sub">{getDisplayedArchetype(card)} · {card.prompts.rarity}</span>
                    {card.activeFrameId && <span className="card-sub">Prestige frame · {card.activeFrameId.replace(/-/g, " ")}</span>}
                  </div>
                 </button>
                </div>
              );
            })}
            </div>
          </section>

          {selected && (
              <div className="card-detail-panel">
                <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
              <CardContainer cardVars={buildCardVars(selected, "collection")}>
                <PrintedCardPreviewPair
                  card={selected}
                  backgroundImageUrl={selected.backgroundImageUrl}
                  characterImageUrl={selected.characterImageUrl}
                  frameImageUrl={selected.frameImageUrl}
                  className="print-preview-area--collection"
                />
              </CardContainer>
              {selected.activeFrameId && (
                <p className="collection-result-count">
                  Prestige frame unlocked: {selected.activeFrameId.replace(/-/g, " ")}
                </p>
              )}
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {tierData.canSave && (
                  <>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => navigate(`/edit/${selected.id}`)}
                    >
                      ✎ Customize Card
                    </button>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => navigate(`/edit/${selected.id}?mode=identity&focus=name`)}
                    >
                      Rename
                    </button>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => navigate(`/edit/${selected.id}?mode=layout`)}
                    >
                      ↔ Reposition Art
                    </button>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => navigate(`/edit/${selected.id}?mode=art`)}
                    >
                      ✨ Refresh Art
                    </button>
                  </>
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
                  <button
                    className="btn-outline btn-sm"
                    onClick={() => navigate(`/workshop?card=${selected.id}`)}
                  >
                    🛹 Workshop
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
          </>
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
      </>
      )}
    </div>
  );
}
