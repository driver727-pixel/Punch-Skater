import { useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import type { CardPayload } from "../lib/types";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!user) return;
    if (!selectedCard) { setError("Select a card to offer."); return; }
    const email = recipientEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setError("Enter a valid recipient email."); return; }
    if (email === (user.email ?? "").toLowerCase()) { setError("You can't trade with yourself."); return; }

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
        offeredCard: selectedCard,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
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
            <h2 className="modal-title">Trade Offer Sent!</h2>
            <p className="modal-sub">
              Your offer for <strong>{selectedCard?.identity.name}</strong> has been sent to{" "}
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
        <h2 className="modal-title">Offer a Trade</h2>
        <p className="modal-sub">Choose a card to give and enter the recipient's email.</p>

        <div className="form-group">
          <label>Card to Offer</label>
          <div className="trade-card-picker">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`trade-pick-thumb ${selectedCard?.id === card.id ? "trade-pick-thumb--active" : ""}`}
                onClick={() => setSelectedCard(card)}
              >
                <CardArt card={card} width={80} height={56} />
                <span className="trade-pick-name">{card.identity.name}</span>
              </div>
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

        <button className="btn-primary btn-lg" onClick={handleSend} disabled={loading}>
          {loading ? "⏳ Sending…" : "🤝 Send Trade Offer"}
        </button>
      </div>
    </div>
  );
}
