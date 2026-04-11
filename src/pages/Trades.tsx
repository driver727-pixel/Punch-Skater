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
  const pendingOutboxCount = outbox.filter((trade) => trade.status === "pending").length;
  const resolvedOutboxCount = outbox.length - pendingOutboxCount;

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
      const tradeRef = doc(db, "trades", trade.id);
      const fromCardRef = doc(db, "users", trade.fromUid, "cards", trade.offeredCard.id);
      const toCardRef = doc(db, "users", trade.toUid, "cards", trade.offeredCard.id);

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
          <p className="page-sub">Send, receive, and manage direct card offers with other players.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)} disabled={cards.length === 0}>
          + New Card Offer
        </button>
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
              <p>No pending incoming offers.</p>
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
              <p>You haven't sent any card offers yet.</p>
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
