import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
  orderBy,
  limit,
} from "firebase/firestore";
import type { TradePayload } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { CardArt } from "../components/CardArt";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { TradeModal } from "../components/TradeModal";
import { useCollection } from "../hooks/useCollection";

type Tab = "inbox" | "outbox" | "market";

export function Trades() {
  const { user } = useAuth();
  const { cards } = useCollection();
  const uid = user?.uid ?? null;
  const [tab, setTab] = useState<Tab>("inbox");
  const [inbox, setInbox] = useState<TradePayload[]>([]);
  const [outbox, setOutbox] = useState<TradePayload[]>([]);
  const [market, setMarket] = useState<TradePayload[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;

    const inboxUnsub = onSnapshot(
      query(collection(db, "trades"), where("toUid", "==", uid), where("status", "==", "pending")),
      (snap) => setInbox(snap.docs.map((d) => d.data() as TradePayload))
    );

    const outboxUnsub = onSnapshot(
      query(collection(db, "trades"), where("fromUid", "==", uid)),
      (snap) => setOutbox(snap.docs.map((d) => d.data() as TradePayload))
    );

    const marketUnsub = onSnapshot(
      query(
        collection(db, "trades"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc"),
        limit(50)
      ),
      (snap) => {
        const all = snap.docs.map((d) => d.data() as TradePayload);
        // Exclude the current user's own listings (already in Inbox / Sent)
        setMarket(all.filter((t) => t.fromUid !== uid && t.toUid !== uid));
      }
    );

    return () => { inboxUnsub(); outboxUnsub(); marketUnsub(); };
  }, [uid]);

  const handleAccept = async (trade: TradePayload) => {
    if (!user) return;
    setActionLoading(trade.id);
    setError("");
    try {
      await runTransaction(db, async (tx) => {
        // Remove card from offerer's collection
        tx.delete(doc(db, "users", trade.fromUid, "cards", trade.offeredCard.id));
        // Add card to recipient's (current user's) collection
        tx.set(doc(db, "users", trade.toUid, "cards", trade.offeredCard.id), trade.offeredCard);
        // Mark trade accepted
        tx.update(doc(db, "trades", trade.id), {
          status: "accepted",
          updatedAt: new Date().toISOString(),
        });
      });
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
      await updateDoc(doc(db, "trades", trade.id), {
        status: "declined",
        updatedAt: new Date().toISOString(),
      });
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
      await updateDoc(doc(db, "trades", trade.id), {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });
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
          <p className="page-sub">Offer and manage card trades with other players.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)} disabled={cards.length === 0}>
          + New Trade Offer
        </button>
      </div>

      {error && <p className="forge-image-error" style={{ marginBottom: "16px" }}>{error}</p>}

      <div className="trades-tabs">
        <button
          className={`login-tab ${tab === "inbox" ? "login-tab--active" : ""}`}
          onClick={() => setTab("inbox")}
        >
          Inbox {inbox.length > 0 && <span className="trade-badge">{inbox.length}</span>}
        </button>
        <button
          className={`login-tab ${tab === "outbox" ? "login-tab--active" : ""}`}
          onClick={() => setTab("outbox")}
        >
          Sent
        </button>
        <button
          className={`login-tab ${tab === "market" ? "login-tab--active" : ""}`}
          onClick={() => setTab("market")}
        >
          🌐 Market {market.length > 0 && <span className="trade-badge trade-badge--market">{market.length}</span>}
        </button>
      </div>

      {tab === "inbox" && (
        <>
          {inbox.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📬</span>
              <p>No pending trade offers.</p>
            </div>
          ) : (
            <div className="trades-list">
              {inbox.map((trade) => (
                <div key={trade.id} className="trade-item">
                  <CardArt card={trade.offeredCard} width={80} height={56} />
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
              <p>You haven't sent any trade offers yet.</p>
            </div>
          ) : (
            <div className="trades-list">
              {outbox.map((trade) => (
                <div key={trade.id} className="trade-item">
                  <CardArt card={trade.offeredCard} width={80} height={56} />
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
              Live feed of cards actively offered for trade across the community.
              See something you want? Reach out to the trader directly.
            </p>
          </div>
          {market.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏪</span>
              <p>No community listings right now. Be the first to offer a trade!</p>
            </div>
          ) : (
            <div className="market-grid">
              {market.map((trade) => (
                <div key={trade.id} className="market-card">
                  <div className="market-card-art">
                    <CardArt card={trade.offeredCard} width={100} height={70} />
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

      {showModal && (
        <TradeModal
          cards={cards}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
