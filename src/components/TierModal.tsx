import { useState } from "react";
import { TIERS, saveEmail, type TierLevel } from "../lib/tiers";
import { useTier } from "../context/TierContext";

interface TierModalProps {
  onClose: () => void;
}

export function TierModal({ onClose }: TierModalProps) {
  const { tier, email, setTier } = useTier();
  const [signupEmail, setSignupEmail] = useState(email);
  const [signupStep, setSignupStep] = useState<TierLevel | null>(null);
  const [error, setError] = useState("");

  const handleSelectTier = (level: TierLevel) => {
    if (level === "free") {
      setTier("free");
      onClose();
      return;
    }
    setSignupStep(level);
    setError("");
  };

  const handleProceedToPayment = () => {
    if (!signupStep) return;
    const emailVal = signupEmail.trim();
    if (!emailVal || !emailVal.includes("@")) {
      setError("Enter a valid email to continue.");
      return;
    }
    const tierData = TIERS[signupStep];
    if (!tierData.stripeUrl) return;

    // Store email so it's available after Stripe redirect
    saveEmail(emailVal);

    // Build redirect URL with tier & email params so we can restore state
    const redirectBase = window.location.origin + window.location.pathname;
    const returnUrl = `${redirectBase}?tier=${signupStep}&email=${encodeURIComponent(emailVal)}`;
    const paymentUrl = `${tierData.stripeUrl}?success_url=${encodeURIComponent(returnUrl)}&client_reference_id=${encodeURIComponent(emailVal)}`;
    window.open(paymentUrl, "_blank", "noopener");

    // Also set tier locally (optimistic — works for demo/test mode)
    setTier(signupStep, emailVal);
    onClose();
  };

  const tierOrder: TierLevel[] = ["free", "tier2", "tier3"];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Choose Your Tier</h2>
        <p className="modal-sub">Pick the access level that fits your style.</p>

        {!signupStep ? (
          <div className="tier-cards">
            {tierOrder.map((lvl) => {
              const t = TIERS[lvl];
              const isCurrent = tier === lvl;
              return (
                <div
                  key={lvl}
                  className={`tier-card ${isCurrent ? "tier-card--active" : ""} ${lvl === "tier3" ? "tier-card--featured" : ""}`}
                >
                  {lvl === "tier3" && <span className="tier-badge">BEST VALUE</span>}
                  <div className="tier-name">{t.name}</div>
                  <div className="tier-price">{t.price}</div>
                  <p className="tier-desc">{t.description}</p>
                  <ul className="tier-features">
                    {t.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                  <button
                    className={`btn-primary tier-select-btn ${lvl === "tier3" ? "btn-featured" : ""}`}
                    onClick={() => handleSelectTier(lvl)}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : lvl === "free" ? "Use Free" : `Upgrade — ${t.price}`}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tier-signup">
            <button className="btn-outline tier-back" onClick={() => setSignupStep(null)}>← Back</button>
            <h3 className="tier-signup-title">Sign up for {TIERS[signupStep].name}</h3>
            <p className="tier-signup-desc">
              Enter your email to link your purchase. After payment you'll be redirected back with your tier activated.
            </p>
            <input
              className="input"
              type="email"
              placeholder="your@email.com"
              value={signupEmail}
              onChange={(e) => { setSignupEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleProceedToPayment()}
            />
            {error && <p className="tier-error">{error}</p>}
            <button className="btn-primary btn-lg" onClick={handleProceedToPayment}>
              Continue to Payment — {TIERS[signupStep].price}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
