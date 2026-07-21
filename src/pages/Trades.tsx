import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import type { TradePayload } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { CardThumbnail } from "../components/CardThumbnail";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { TradeModal } from "../components/TradeModal";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { formatStatLabel } from "../lib/battle";
import {
  ACTIVE_LEADERBOARD_SEASON,
  SEASONAL_FAIR_PLAY_RULES,
  SEASONAL_REWARD_TIERS,
} from "../lib/seasonalLeaderboard";
import { estimateCardTradeValue, formatTradeValue, getTradeValueBand } from "../lib/tradeEconomy";
import { sfxSuccess, sfxClick, sfxTradeAccepted, sfxTradeDeclined } from "../lib/sfx";
import { getTradeMarket, resolveTradeStatus } from "../services/trades";

type Tab = "inbox" | "outbox" | "market" | "leaderboard";

export function Trades() {
  const { user } = useAuth();
  const { cards } = useCollection();
  const { decks } = useDecks();
  const { entries: leaderboardEntries, uploadDeck, uploading, myEntry } = useLeaderboard();
  const uid = user?.uid ?? null;
  const [tab, setTab] = useState<Tab>("inbox");
  const [inbox, setInbox] = useState<TradePayload[]>([]);
  const [outbox, setOutbox] = useState<TradePayload[]>([]);
  const [market, setMarket] = useState<TradePayload[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLeaderboardDeckId, setSelectedLeaderboardDeckId] = useState<string | null>(null);
  const [leaderboardSuccess, setLeaderboardSuccess] = useState(false);
  const pendingOutboxCount = outbox.filter((trade) => trade.status === "pending").length;
  const resolvedOutboxCount = outbox.length - pendingOutboxCount;

  useEffect(() => {
    setInbox([]);
    setOutbox([]);
    setMarket([]);
    setSelectedLeaderboardDeckId(null);
    setLeaderboardSuccess(false);
    if (!uid || !db) return;

    setError("");

    const handleSnapshotError = (err: Error) => {
      console.error("Trades snapshot error:", err);
      setError("Failed to load trades. Please try refreshing.");
    };

    let cancelled = false;

    const inboxUnsub = onSnapshot(
      query(collection(db, "trades"), where("toUid", "==", uid), where("status", "==", "pending")),
      (snap) => {
        if (!cancelled) {
          setInbox(snap.docs.map((d) => d.data() as TradePayload));
        }
      },
      handleSnapshotError,
    );

    const outboxUnsub = onSnapshot(
      query(collection(db, "trades"), where("fromUid", "==", uid)),
      (snap) => {
        if (!cancelled) {
          setOutbox(snap.docs.map((d) => d.data() as TradePayload));
        }
      },
      handleSnapshotError,
    );

    void getTradeMarket(user)
      .then((marketOffers) => {
        if (cancelled || !uid) return;
        setMarket(
          marketOffers
            .filter((t) => t.fromUid !== uid && t.toUid !== uid)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
        );
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Market load error:", err);
          setError("Failed to load the community market. Please try refreshing.");
        }
      });

    return () => {
      cancelled = true;
      inboxUnsub();
      outboxUnsub();
    };
  }, [uid, refreshKey]);

  const applyTradeMutation = (updatedTrade: TradePayload) => {
    setInbox((prev) => prev.map((trade) => (trade.id === updatedTrade.id ? updatedTrade : trade)));
    setOutbox((prev) => prev.map((trade) => (trade.id === updatedTrade.id ? updatedTrade : trade)));
    setMarket((prev) => prev.filter((trade) => trade.id !== updatedTrade.id));
  };

  const handleAccept = async (trade: TradePayload) => {
    if (!user) return;
    setActionLoading(trade.id);
    setError("");
    try {
      const { trade: updatedTrade } = await resolveTradeStatus(user, trade.id, "accepted");
      applyTradeMutation(updatedTrade);
      sfxTradeAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept trade.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (trade: TradePayload) => {
    if (!user) return;
    setActionLoading(trade.id);
    setError("");
    try {
      const { trade: updatedTrade } = await resolveTradeStatus(user, trade.id, "declined");
      applyTradeMutation(updatedTrade);
      sfxTradeDeclined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline trade.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (trade: TradePayload) => {
    if (!user) return;
    setActionLoading(trade.id);
    setError("");
    try {
      const { trade: updatedTrade } = await resolveTradeStatus(user, trade.id, "cancelled");
      applyTradeMutation(updatedTrade);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel trade.");
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor: Record<TradePayload["status"], string> = {
    pending:   "var(--accent2)",
    accepted:  "var(--accent)",
    declined:  "var(--danger)",
    cancelled: "var(--text-dim)",
  };

  const getEstimatedTradeValue = (trade: TradePayload) => trade.estimatedValue ?? estimateCardTradeValue(trade.offeredCard);

  const renderTradeEconomyDetails = (trade: TradePayload) => {
    const estimatedValue = getEstimatedTradeValue(trade);
    const valueBand = trade.valueBand ?? getTradeValueBand(estimatedValue);
    const reputation = trade.senderReputation;
    return (
      <div className="trade-economy-details">
        <span className={`trade-value-pill trade-value-pill--${valueBand}`}>
          {formatTradeValue(estimatedValue)} · {valueBand}
        </span>
        <span className="trade-reputation-chip">
          {reputation ? `${reputation.label} · ${reputation.score}/100` : "New trader · reputation building"}
        </span>
        {(trade.fairPlay?.flags ?? []).map((flag) => (
          <span key={flag} className="trade-fairplay-flag">{flag}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trades</h1>
          <p className="page-sub">Send, receive, and manage fair card-only offers with estimated values and trader reputation.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-outline" onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh trades">
            ↻ Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)} disabled={cards.length === 0}>
            + New Card Offer
          </button>
        </div>
      </div>

      {error && <p className="forge-image-error" style={{ marginBottom: "16px" }}>{error}</p>}

      <div className="trade-summary-grid">
        <div className="trade-summary-card">
          <span className="trade-summary-label">Incoming</span>
          <strong className="trade-summary-value">{inbox.length}</strong>
          <span className="trade-summary-note">Offers waiting on your response</span>
        </div>
        <div className="trade-summary-card">
          <span className="trade-summary-label">Outgoing</span>
          <strong className="trade-summary-value">{pendingOutboxCount}</strong>
          <span className="trade-summary-note">Cards you currently have on hold</span>
        </div>
        <div className="trade-summary-card">
          <span className="trade-summary-label">Resolved</span>
          <strong className="trade-summary-value">{resolvedOutboxCount}</strong>
          <span className="trade-summary-note">Accepted, declined, or cancelled offers</span>
        </div>
        <div className="trade-summary-card trade-summary-card--fair">
          <span className="trade-summary-label">Fair economy</span>
          <strong className="trade-summary-value">0¢</strong>
          <span className="trade-summary-note">No real-money trades, no pay-to-win boosts, and card value is estimated from earned play.</span>
        </div>
      </div>

      <div className="trades-tabs">
        <button
          className={`login-tab ${tab === "inbox" ? "login-tab--active" : ""}`}
          onClick={() => { sfxClick(); setTab("inbox"); }}
        >
          Inbox {inbox.length > 0 && <span className="trade-badge">{inbox.length}</span>}
        </button>
        <button
          className={`login-tab ${tab === "outbox" ? "login-tab--active" : ""}`}
          onClick={() => { sfxClick(); setTab("outbox"); }}
        >
          Sent
        </button>
        <button
          className={`login-tab ${tab === "market" ? "login-tab--active" : ""}`}
          onClick={() => { sfxClick(); setTab("market"); }}
        >
          🌐 Market {market.length > 0 && <span className="trade-badge trade-badge--market">{market.length}</span>}
        </button>
        <button
          className={`login-tab ${tab === "leaderboard" ? "login-tab--active" : ""}`}
          onClick={() => { sfxClick(); setTab("leaderboard"); }}
        >
          🏆 Leaderboard
        </button>
      </div>

      {tab === "inbox" && (
        <>
          {inbox.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📬</span>
              <p>No pending incoming offers.</p>
            </div>
          ) : (
            <div className="trades-list">
              {inbox.map((trade) => (
                <div key={trade.id} className="trade-item">
                  <CardThumbnail card={trade.offeredCard} width={80} height={112} />
                  <div className="trade-info">
                    <div className="trade-card-name">{trade.offeredCard.identity.name}</div>
                    <div className="trade-card-sub">{getDisplayedArchetype(trade.offeredCard)} · {trade.offeredCard.prompts.rarity}</div>
                    <div className="trade-from">From: <strong>{trade.fromEmail}</strong></div>
                    {renderTradeEconomyDetails(trade)}
                  </div>
                  <div className="trade-actions-row">
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => handleAccept(trade)}
                      disabled={actionLoading === trade.id}
                    >
                      {actionLoading === trade.id ? "⏳" : "✓ Accept"}
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => handleDecline(trade)}
                      disabled={actionLoading === trade.id}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "outbox" && (
        <>
          {outbox.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📤</span>
              <p>You haven't sent any card offers yet.</p>
            </div>
          ) : (
            <div className="trades-list">
              {outbox.map((trade) => (
                <div key={trade.id} className="trade-item">
                  <CardThumbnail card={trade.offeredCard} width={80} height={112} />
                  <div className="trade-info">
                    <div className="trade-card-name">{trade.offeredCard.identity.name}</div>
                    <div className="trade-card-sub">{getDisplayedArchetype(trade.offeredCard)} · {trade.offeredCard.prompts.rarity}</div>
                    <div className="trade-from">To: <strong>{trade.toEmail}</strong></div>
                    {renderTradeEconomyDetails(trade)}
                  </div>
                  <div className="trade-actions-row">
                    <span
                      className="trade-status"
                      style={{ color: statusColor[trade.status] }}
                    >
                      {trade.status.toUpperCase()}
                    </span>
                    {trade.status === "pending" && (
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => handleCancel(trade)}
                        disabled={actionLoading === trade.id}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "market" && (
        <>
          <div className="market-header">
            <p className="market-desc">
              Live feed of cards actively offered across the community.
              To claim one, contact the player and ask them to send the offer to your account email.
            </p>
          </div>
          {market.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏪</span>
              <p>No community listings right now. Be the first to send a card offer.</p>
            </div>
          ) : (
            <div className="market-grid">
              {market.map((trade) => (
                <div key={trade.id} className="market-card">
                  <div className="market-card-art">
                    <CardThumbnail card={trade.offeredCard} width={100} height={140} />
                  </div>
                  <div className="market-card-info">
                    <div className="trade-card-name">{trade.offeredCard.identity.name}</div>
                    <div className="trade-card-sub">
                      {getDisplayedArchetype(trade.offeredCard)} · {trade.offeredCard.prompts.rarity}
                    </div>
                    {renderTradeEconomyDetails(trade)}
                    <div className="market-card-district">
                      {trade.offeredCard.prompts.district}
                    </div>
                    <div className="market-card-trader">
                      <span className="market-trader-label">Offered by</span>{" "}
                      <strong>{trade.fromEmail}</strong>
                    </div>
                    <div className="market-card-age">
                      {new Date(trade.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && (
        <>
          <div className="leaderboard-header">
            <p className="market-desc">
              Submit a 6-card Crew for <strong>{ACTIVE_LEADERBOARD_SEASON.label}</strong>. Seasonal rank uses current Deck Power only,
              while lifetime progress still tracks Crew XP and Ozzies separately.
            </p>
            <div className="leaderboard-rules">
              <div>
                <strong>Fair rewards:</strong>{" "}
                {SEASONAL_REWARD_TIERS.map((tier) => tier.label).join(" · ")}
              </div>
              <div>
                <strong>Anti-abuse:</strong> {SEASONAL_FAIR_PLAY_RULES.join(" ")}
              </div>
            </div>
          </div>

          {uid && (
            <div className="leaderboard-upload-section">
              <h3 className="leaderboard-upload-title">Submit Your Seasonal Crew</h3>
              {decks.filter((d) => d.cards.length === 6).length === 0 ? (
                <p className="trade-helper-text">Build a deck with exactly 6 unique cards to participate.</p>
              ) : (
                <>
                  <div className="leaderboard-deck-picker">
                    {decks.filter((d) => d.cards.length === 6).map((deck) => (
                      <button
                        key={deck.id}
                        type="button"
                        className={`arena-deck-option ${selectedLeaderboardDeckId === deck.id ? "arena-deck-option--active" : ""}`}
                        onClick={() => { setSelectedLeaderboardDeckId(deck.id); setLeaderboardSuccess(false); }}
                      >
                        <span className="arena-deck-option-name">{deck.name}</span>
                        <span className="arena-deck-option-count">{deck.cards.length} cards</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn-primary leaderboard-upload-btn"
                    disabled={uploading || !selectedLeaderboardDeckId}
                    onClick={async () => {
                      const deck = decks.find((d) => d.id === selectedLeaderboardDeckId);
                      if (!deck) return;
                      setLeaderboardSuccess(false);
                      setError("");
                      try {
                        await uploadDeck(deck);
                        sfxSuccess();
                        setLeaderboardSuccess(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to upload deck.");
                      }
                    }}
                  >
                    {uploading ? "⏳ Uploading…" : "🏆 Submit Seasonal Crew"}
                  </button>
                  {leaderboardSuccess && (
                    <p className="leaderboard-success">Your server-verified seasonal entry has been submitted! 🎉</p>
                  )}
                </>
              )}
            </div>
          )}

          {myEntry && (
            <div className="leaderboard-my-entry">
              <span className="leaderboard-my-entry-label">Your entry:</span>
              <strong>{myEntry.deckName}</strong> · Seasonal score {myEntry.seasonalRankScore ?? myEntry.deckPower} ·{" "}
              Lifetime score {myEntry.leaderboardScore ?? myEntry.deckPower} ·{" "}
              🎯 {formatStatLabel(myEntry.strongestStat)} {myEntry.strongestStatTotal} ·{" "}
              🤝 +{myEntry.synergyBonusPct}%
            </div>
          )}

          {leaderboardEntries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏆</span>
              <p>No seasonal entries yet. Be the first to submit a verified 6-card Crew!</p>
            </div>
          ) : (
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th className="leaderboard-th">#</th>
                    <th className="leaderboard-th">Player</th>
                    <th className="leaderboard-th">Deck</th>
                    <th className="leaderboard-th">Cards</th>
                    <th className="leaderboard-th">Season Score</th>
                    <th className="leaderboard-th">Lifetime</th>
                    <th className="leaderboard-th">Best Stat</th>
                    <th className="leaderboard-th">Synergy</th>
                    <th className="leaderboard-th">Reward Track</th>
                    <th className="leaderboard-th">Archetype</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardEntries.map((entry, index) => (
                    <tr
                      key={entry.uid}
                      className={`leaderboard-row ${entry.uid === uid ? "leaderboard-row--me" : ""}`}
                    >
                      <td className="leaderboard-td leaderboard-rank">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                      </td>
                      <td className="leaderboard-td leaderboard-player">{entry.displayName}</td>
                      <td className="leaderboard-td">{entry.deckName}</td>
                      <td className="leaderboard-td leaderboard-center">{entry.cardCount}</td>
                      <td className="leaderboard-td leaderboard-power">{entry.seasonalRankScore ?? entry.deckPower}</td>
                      <td className="leaderboard-td leaderboard-ozzies">{entry.leaderboardScore ?? entry.deckPower}</td>
                      <td className="leaderboard-td">
                        {formatStatLabel(entry.strongestStat)} {entry.strongestStatTotal}
                      </td>
                      <td className="leaderboard-td leaderboard-center">+{entry.synergyBonusPct}%</td>
                      <td className="leaderboard-td leaderboard-center">
                        {(entry.projectedRewardTierIds ?? ["participation"]).length} tiers
                      </td>
                      <td className="leaderboard-td leaderboard-archetype">{entry.archetypeHint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModal && (
        <TradeModal
          cards={cards}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
