import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import type { CardPayload, TradePayload } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { CardThumbnail } from "./CardThumbnail";
import {
  createTradeReputationSnapshot,
  estimateCardTradeValue,
  formatTradeValue,
  getTradeFairnessFlags,
  getTradeValueBand,
  MAX_PENDING_OUTGOING_OFFERS,
} from "../lib/tradeEconomy";
import { createTradeOffer } from "../services/trades";
import { useModalA11y } from "../hooks/useModalA11y";

interface TradeModalProps {
  cards: CardPayload[];
  onClose: () => void;
  preselectedCard?: CardPayload;
}

export function TradeModal({ cards, onClose, preselectedCard }: TradeModalProps) {
  const { user } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardPayload | null>(preselectedCard ?? null);
  const [sentTrades, setSentTrades] = useState<TradePayload[]>([]);
  const [loadingPendingOffers, setLoadingPendingOffers] = useState(false);
  const [confirmedFairTrade, setConfirmedFairTrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const dialogRef = useModalA11y<HTMLDivElement>({ onClose });
  const pendingTrades = useMemo(() => sentTrades.filter((trade) => trade.status === "pending"), [sentTrades]);
  const pendingOfferCardIds = useMemo(
    () => pendingTrades.map((trade) => trade.offeredCardId ?? trade.offeredCard.id),
    [pendingTrades],
  );
  const selectedCardValue = selectedCard ? estimateCardTradeValue(selectedCard) : 0;
  const selectedCardValueBand = selectedCard ? getTradeValueBand(selectedCardValue) : null;
  const selectedCardFairnessFlags = selectedCard ? getTradeFairnessFlags(selectedCard, selectedCardValue) : [];
  const senderReputation = user ? createTradeReputationSnapshot(sentTrades, user.uid) : null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadPendingOffers = async () => {
      setLoadingPendingOffers(true);
      try {
        const sentTradesSnap = await getDocs(
          query(collection(db, "trades"), where("fromUid", "==", user.uid))
        );
        if (cancelled) return;
        setSentTrades(sentTradesSnap.docs.map((docSnap) => docSnap.data() as TradePayload));
      } catch {
        if (!cancelled) setSentTrades([]);
      } finally {
        if (!cancelled) setLoadingPendingOffers(false);
      }
    };

    void loadPendingOffers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const availableCards = useMemo(
    () => cards.filter((card) => !pendingOfferCardIds.includes(card.id)),
    [cards, pendingOfferCardIds],
  );

  useEffect(() => {
    const isSelectedCardInvalid =
      !selectedCard ||
      pendingOfferCardIds.includes(selectedCard.id) ||
      !cards.some((card) => card.id === selectedCard.id);

    if (isSelectedCardInvalid) {
      setSelectedCard(availableCards[0] ?? null);
    }
  }, [availableCards, cards, pendingOfferCardIds, selectedCard]);

  const handleSend = async () => {
    if (!user) return;
    if (!selectedCard) { setError("Select a card to offer."); return; }
    if (!confirmedFairTrade) { setError("Confirm the fair-trade checklist before sending."); return; }
    const email = recipientEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setError("Enter a valid recipient email."); return; }
    if (email === (user.email ?? "").toLowerCase()) { setError("You can't trade with yourself."); return; }
    if (!cards.some((card) => card.id === selectedCard.id)) { setError("That card is no longer in your collection."); return; }
    if (pendingOfferCardIds.includes(selectedCard.id)) { setError("That card already has a pending offer."); return; }

    setLoading(true);
    setError("");
    try {
      const response = await createTradeOffer(user, {
        offeredCardId: selectedCard.id,
        recipientEmail: email,
      });
      setSentTrades((current) => [...current, response.trade]);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send trade offer.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel modal-panel--sm"
          onClick={(e) => e.stopPropagation()}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trade-modal-success-title"
        >
          <button className="modal-close close-btn" onClick={onClose} aria-label="Close trade dialog">✕</button>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🤝</div>
            <h2 className="modal-title" id="trade-modal-success-title">Offer Sent!</h2>
            <p className="modal-sub">
              Your card offer for <strong>{selectedCard?.identity.name}</strong> has been sent to{" "}
              <strong>{recipientEmail}</strong>.
            </p>
            <button className="btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel--sm"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-modal-title"
      >
        <button className="modal-close close-btn" onClick={onClose} aria-label="Close trade dialog">✕</button>
        <h2 className="modal-title" id="trade-modal-title">Send a Card Offer</h2>
        <p className="modal-sub">Choose one card from your collection and send the offer directly to another player.</p>

        <div className="form-group">
          <label>Card to Offer</label>
          {loadingPendingOffers ? (
            <p className="trade-helper-text">Checking your pending offers…</p>
          ) : availableCards.length === 0 ? (
            <p className="trade-helper-text">Every card in your collection already has a pending offer.</p>
          ) : (
            <p className="trade-helper-text">Cards with an active outgoing offer are disabled until that offer is resolved.</p>
          )}
          <div className="trade-card-picker">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`trade-pick-thumb ${selectedCard?.id === card.id ? "trade-pick-thumb--active" : ""}`}
                onClick={() => { setSelectedCard(card); setConfirmedFairTrade(false); }}
                disabled={pendingOfferCardIds.includes(card.id)}
                title={pendingOfferCardIds.includes(card.id) ? "This card already has a pending offer." : `Offer ${card.identity.name}`}
              >
                <CardThumbnail card={card} width={80} height={56} />
                <span className="trade-pick-name">{card.identity.name}</span>
                {pendingOfferCardIds.includes(card.id) && (
                  <span className="trade-pick-status">Pending offer</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedCard && (
          <div className="trade-selected-info">
            Offering: <strong>{selectedCard.identity.name}</strong>{" "}
            <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>
              ({selectedCard.prompts.rarity} · {formatTradeValue(selectedCardValue)} · {selectedCardValueBand})
            </span>
            {selectedCardFairnessFlags.length > 0 && (
              <ul className="trade-fairness-list">
                {selectedCardFairnessFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="form-group">
          <label>Recipient Email</label>
          <input
            className="input"
            type="email"
            placeholder="their@email.com"
            value={recipientEmail}
            onChange={(e) => { setRecipientEmail(e.target.value); setConfirmedFairTrade(false); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>

        <div className="trade-reputation-panel">
          <strong>{senderReputation?.label ?? "New trader"}</strong>
          <span>Reputation {senderReputation?.score ?? 55}/100 · {senderReputation?.completedTrades ?? 0} resolved trades</span>
          <span>Pending offers {pendingTrades.length}/{MAX_PENDING_OUTGOING_OFFERS}</span>
        </div>

        <label className="trade-confirm-check">
          <input
            type="checkbox"
            checked={confirmedFairTrade}
            onChange={(e) => { setConfirmedFairTrade(e.target.checked); setError(""); }}
          />
          <span>I reviewed the estimated value, verified the recipient, and agree this is a fair card-only trade with no real-money payment.</span>
        </label>

        {error && <p className="tier-error">{error}</p>}

        <button className="btn-primary btn-lg" onClick={handleSend} disabled={loading || loadingPendingOffers || !selectedCard || !confirmedFairTrade}>
          {loading ? "⏳ Sending…" : "🤝 Send Card Offer"}
        </button>
      </div>
    </div>
  );
}
