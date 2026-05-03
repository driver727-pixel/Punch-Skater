import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
  limit,
} from "firebase/firestore";
import type { TradePayload } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { CardArt } from "../components/CardArt";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { TradeModal } from "../components/TradeModal";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { formatStatLabel } from "../lib/battle";
import { sfxSuccess, sfxRemove, sfxClick } from "../lib/sfx";

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
    if (!uid) return;

    setError("");

    const handleSnapshotError = (err: Error) => {
      console.error("Trades snapshot error:", err);
      setError("Failed to load trades. Please try refreshing.");
    };

    const inboxUnsub = onSnapshot(
      query(collection(db, "trades"), where("toUid", "==", uid), where("status", "==", "pending")),
      (snap) => setInbox(snap.docs.map((d) => d.data() as TradePayload)),
      handleSnapshotError,
    );

    const outboxUnsub = onSnapshot(
      query(collection(db, "trades"), where("fromUid", "==", uid)),
      (snap) => setOutbox(snap.docs.map((d) => d.data() as TradePayload)),
      handleSnapshotError,
    );

    const marketUnsub = onSnapshot(
      query(
        collection(db, "trades"),
        where("status", "==", "pending"),
        limit(50)
      ),
      (snap) => {
        const all = snap.docs.map((d) => d.data() as TradePayload);
        // Exclude the current user's own listings (already in Inbox / Sent),
        // then sort by most recent first (client-side, avoids composite index).
        setMarket(
          all
            .filter((t) => t.fromUid !== uid && t.toUid !== uid)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
        );
      },
      handleSnapshotError,
    );

    return () => { inboxUnsub(); outboxUnsub(); marketUnsub(); };
  }, [uid, refreshKey]);

  const handleAccept = async (trade: TradePayload) => {
    if (!user) return;
    setActionLoading(trade.id);
    setError("");
    try {
      const offeredCardId = trade.offeredCardId ?? trade.offeredCard.id;
      const tradeRef = doc(db, "trades", trade.id);
      const fromCardRef = doc(db, "users", trade.fromUid, "cards", offeredCardId);
      const toCardRef = doc(db, "users", trade.toUid, "cards", offeredCardId);

      await runTransaction(db, async (tx) => {
        const [tradeSnap, fromCardSnap, toCardSnap] = await Promise.all([
          tx.get(tradeRef),
          tx.get(fromCardRef),
          tx.get(toCardRef),
        ]);

        if (!tradeSnap.exists()) {
          throw new Error("This offer no longer exists.");
        }

        const currentTrade = tradeSnap.data() as TradePayload;

        if (currentTrade.status !== "pending") {
          throw new Error("This offer is no longer pending.");
        }

        if (currentTrade.toUid !== user.uid) {
          throw new Error("This offer is no longer assigned to your account.");
        }

        if (!fromCardSnap.exists()) {
          throw new Error("The sender no longer owns this card.");
        }

        if (toCardSnap.exists()) {
          throw new Error("You already have this card in your collection.");
        }

        const currentOfferedCard = fromCardSnap.data() as TradePayload["offeredCard"];

        tx.delete(fromCardRef);
        tx.set(toCardRef, currentOfferedCard);
        tx.update(tradeRef, {
          status: "accepted",
          updatedAt: new Date().toISOString(),
        });
      });
      sfxSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept trade.");
    } finally {
      setActionLoading(null);
    }
  };

  const updatePendingTradeStatus = async (
    trade: TradePayload,
    nextStatus: "declined" | "cancelled",
    expectedActorUid: string,
    ownershipError: string,
  ) => {
    const tradeRef = doc(db, "trades", trade.id);
    await runTransaction(db, async (tx) => {
      const tradeSnap = await tx.get(tradeRef);
      if (!tradeSnap.exists()) {
        throw new Error("This offer no longer exists.");
      }

      const currentTrade = tradeSnap.data() as TradePayload;
      if (currentTrade.status !== "pending") {
        throw new Error("This offer is no longer pending.");
      }

      const actorUid = nextStatus === "declined" ? currentTrade.toUid : currentTrade.fromUid;
      if (actorUid !== expectedActorUid) {
        throw new Error(ownershipError);
      }

      tx.update(tradeRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    });
  };

  const handleDecline = async (trade: TradePayload) => {
    if (!user) return;
    setActionLoading(trade.id);
    setError("");
    try {
      await updatePendingTradeStatus(
        trade,
        "declined",
        user.uid,
        "This offer is no longer assigned to your account.",
      );
      sfxRemove();
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
      await updatePendingTradeStatus(
        trade,
        "cancelled",
        user.uid,
        "This offer is no longer owned by your account.",
      );
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trades</h1>
          <p className="page-sub">Send, receive, and manage direct card offers with other players.</p>
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
                  <CardArt card={trade.offeredCard} width={80} height={112} />
                  <div className="trade-info">
                    <div className="trade-card-name">{trade.offeredCard.identity.name}</div>
                    <div className="trade-card-sub">{getDisplayedArchetype(trade.offeredCard)} · {trade.offeredCard.prompts.rarity}</div>
                    <div className="trade-from">From: <strong>{trade.fromEmail}</strong></div>
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
                  <CardArt card={trade.offeredCard} width={80} height={112} />
                  <div className="trade-info">
                    <div className="trade-card-name">{trade.offeredCard.identity.name}</div>
                    <div className="trade-card-sub">{getDisplayedArchetype(trade.offeredCard)} · {trade.offeredCard.prompts.rarity}</div>
                    <div className="trade-from">To: <strong>{trade.toEmail}</strong></div>
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
                    <CardArt card={trade.offeredCard} width={100} height={140} />
                  </div>
                  <div className="market-card-info">
                    <div className="trade-card-name">{trade.offeredCard.identity.name}</div>
                    <div className="trade-card-sub">
                      {getDisplayedArchetype(trade.offeredCard)} · {trade.offeredCard.prompts.rarity}
                    </div>
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
              Upload your best deck to the online leaderboard and find out who is <strong>The Best Sk8r Punk in the World!</strong>
            </p>
          </div>

          {uid && (
            <div className="leaderboard-upload-section">
              <h3 className="leaderboard-upload-title">Submit Your Deck</h3>
              {decks.filter((d) => d.cards.length > 0).length === 0 ? (
                <p className="trade-helper-text">Build a deck with at least one card to participate.</p>
              ) : (
                <>
                  <div className="leaderboard-deck-picker">
                    {decks.filter((d) => d.cards.length > 0).map((deck) => (
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
                    {uploading ? "⏳ Uploading…" : "🏆 Upload to Leaderboard"}
                  </button>
                  {leaderboardSuccess && (
                    <p className="leaderboard-success">Your deck stats have been uploaded! 🎉</p>
                  )}
                </>
              )}
            </div>
          )}

          {myEntry && (
            <div className="leaderboard-my-entry">
              <span className="leaderboard-my-entry-label">Your entry:</span>
              <strong>{myEntry.deckName}</strong> · ⚡ {myEntry.deckPower} ·{" "}
              💰 {myEntry.ozzies} Ozzies ·{" "}
              🎯 {formatStatLabel(myEntry.strongestStat)} {myEntry.strongestStatTotal} ·{" "}
              🤝 +{myEntry.synergyBonusPct}%
            </div>
          )}

          {leaderboardEntries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏆</span>
              <p>No leaderboard entries yet. Be the first to upload your deck!</p>
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
                    <th className="leaderboard-th">⚡ Power</th>
                    <th className="leaderboard-th">💰 Ozzies</th>
                    <th className="leaderboard-th">Best Stat</th>
                    <th className="leaderboard-th">Synergy</th>
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
                      <td className="leaderboard-td leaderboard-power">{entry.deckPower}</td>
                      <td className="leaderboard-td leaderboard-ozzies">{entry.ozzies ?? 0}</td>
                      <td className="leaderboard-td">
                        {formatStatLabel(entry.strongestStat)} {entry.strongestStatTotal}
                      </td>
                      <td className="leaderboard-td leaderboard-center">+{entry.synergyBonusPct}%</td>
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
