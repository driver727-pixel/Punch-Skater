import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import type { CardPayload, TradePayload } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { CardArt } from "./CardArt";

interface TradeModalProps {
  cards: CardPayload[];
  onClose: () => void;
  preselectedCard?: CardPayload;
}

export function TradeModal({ cards, onClose, preselectedCard }: TradeModalProps) {
  const { user } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardPayload | null>(preselectedCard ?? null);
  const [pendingOfferCardIds, setPendingOfferCardIds] = useState<string[]>([]);
  const [loadingPendingOffers, setLoadingPendingOffers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadPendingOffers = async () => {
      setLoadingPendingOffers(true);
      try {
        const existingOffersSnap = await getDocs(
          query(collection(db, "trades"), where("fromUid", "==", user.uid), where("status", "==", "pending"))
        );
        if (cancelled) return;
        setPendingOfferCardIds(
          existingOffersSnap.docs.map((docSnap) => {
            const trade = docSnap.data() as TradePayload;
            return trade.offeredCardId ?? trade.offeredCard.id;
          }),
        );
      } catch {
        if (!cancelled) setPendingOfferCardIds([]);
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
    const email = recipientEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setError("Enter a valid recipient email."); return; }
    if (email === (user.email ?? "").toLowerCase()) { setError("You can't trade with yourself."); return; }
    if (!cards.some((card) => card.id === selectedCard.id)) { setError("That card is no longer in your collection."); return; }
    if (pendingOfferCardIds.includes(selectedCard.id)) { setError("That card already has a pending offer."); return; }

    setLoading(true);
    setError("");
    try {
      // Look up recipient by email
      const snap = await getDocs(
        query(collection(db, "userProfiles"), where("email", "==", email))
      );
      if (snap.empty) {
        setError("No account found with that email address.");
        return;
      }
      const recipientProfile = snap.docs[0].data();
      const tradeId = `trade-${Date.now()}`;
      await setDoc(doc(db, "trades", tradeId), {
        id: tradeId,
        fromUid: user.uid,
        fromEmail: user.email ?? "",
        toUid: recipientProfile.uid,
        toEmail: recipientProfile.email,
        offeredCardId: selectedCard.id,
        offeredCard: selectedCard,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setPendingOfferCardIds((current) => [...current, selectedCard.id]);
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
        <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close close-btn" onClick={onClose}>✕</button>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🤝</div>
            <h2 className="modal-title">Offer Sent!</h2>
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
      <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close close-btn" onClick={onClose}>✕</button>
        <h2 className="modal-title">Send a Card Offer</h2>
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
                onClick={() => setSelectedCard(card)}
                disabled={pendingOfferCardIds.includes(card.id)}
                title={pendingOfferCardIds.includes(card.id) ? "This card already has a pending offer." : `Offer ${card.identity.name}`}
              >
                <CardArt card={card} width={80} height={56} />
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
              ({selectedCard.prompts.rarity})
            </span>
          </div>
        )}

        <div className="form-group">
          <label>Recipient Email</label>
          <input
            className="input"
            type="email"
            placeholder="their@email.com"
            value={recipientEmail}
            onChange={(e) => { setRecipientEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>

        {error && <p className="tier-error">{error}</p>}

        <button className="btn-primary btn-lg" onClick={handleSend} disabled={loading || loadingPendingOffers || !selectedCard}>
          {loading ? "⏳ Sending…" : "🤝 Send Card Offer"}
        </button>
      </div>
    </div>
  );
}
