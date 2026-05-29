import { useState } from "react";
import { SEASON_PASS, TIERS, saveEmail, type PaidBillingPeriod, type TierLevel } from "../lib/tiers";
import { useTier } from "../context/TierContext";
import { resolveApiUrl } from "../lib/apiUrls";
import { ReferralPanel } from "./ReferralPanel";
import { useModalA11y } from "../hooks/useModalA11y";

interface TierModalProps {
  onClose: () => void;
}

type CheckoutTierSelection = Exclude<TierLevel, "free"> | "seasonPass";

const CHECKOUT_API_URL = resolveApiUrl(
  import.meta.env.VITE_CHECKOUT_API_URL as string | undefined,
  "/api/create-checkout-session",
);

export function TierModal({ onClose }: TierModalProps) {
  const { tier, email, setTier } = useTier();
  const [signupEmail, setSignupEmail] = useState(email);
  const [signupStep, setSignupStep] = useState<CheckoutTierSelection | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<PaidBillingPeriod>("monthly");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useModalA11y<HTMLDivElement>({ onClose });

  const handleSelectTier = (level: TierLevel | "seasonPass") => {
    if (level === "free") {
      setTier("free");
      onClose();
      return;
    }
    setSignupStep(level);
    setError("");
  };

  const handleProceedToPayment = async () => {
    if (!signupStep) return;
    const emailVal = signupEmail.trim();
    if (!emailVal || !emailVal.includes("@")) {
      setError("Enter a valid email to continue.");
      return;
    }
    const isSeasonPassCheckout = signupStep === "seasonPass";
    const selectedTier = signupStep !== "seasonPass" ? TIERS[signupStep] : null;
    const selectedPriceId = isSeasonPassCheckout
      ? SEASON_PASS.stripePriceId
      : billingPeriod === "annual"
        ? selectedTier?.stripeAnnualPriceId
        : selectedTier?.stripePriceId;
    if (!selectedPriceId) {
      setError("This billing option is not configured yet.");
      return;
    }

    // Store email so it's available after Stripe redirect
    saveEmail(emailVal);

    // Stripe replaces {CHECKOUT_SESSION_ID} after payment so the app can verify
    // the completed purchase with the server before restoring tier access.
    const redirectBase = window.location.origin + window.location.pathname;
    const successUrl = isSeasonPassCheckout
      ? redirectBase
      : `${redirectBase}?checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${redirectBase}`;

    setLoading(true);
    setError("");
    try {
      const resp = await fetch(CHECKOUT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailVal,
          priceId: selectedPriceId,
          successUrl,
          cancelUrl,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.url) {
        setError(data.error ?? "Failed to start checkout. Please try again.");
        return;
      }
      // Redirect to the Stripe-hosted checkout page
      window.location.href = data.url;
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const tierOrder: TierLevel[] = ["free", "tier2", "tier3"];
  const signupTier = signupStep && signupStep !== "seasonPass" ? TIERS[signupStep] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-modal-title"
      >
        <button className="close-btn modal-close" onClick={onClose} aria-label="Close tier selection">✕</button>
        <h2 className="modal-title" id="tier-modal-title">Choose Your Tier</h2>
        <p className="modal-sub">Subscribe for forge credits, collection tools, and cosmetics. Gameplay power still comes from play.</p>

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
                  {t.annualPrice && <div className="tier-annual-price">{t.annualPrice}</div>}
                   <p className="tier-desc">{t.description}</p>
                   <ul className="tier-features">
                     {t.features.map((f) => (
                       <li key={f}>✓ {f}</li>
                     ))}
                   </ul>
                   {lvl === "free" && (
                     <div className="tier-card-note">
                       <strong>Referral credits:</strong> sign in on the free tier to copy your referral
                       link and earn extra forge credits.
                     </div>
                   )}
                   {lvl === "free" && isCurrent && <ReferralPanel />}
                   <button
                     className={`btn-primary tier-select-btn ${lvl === "tier3" ? "btn-featured" : ""}`}
                     onClick={() => handleSelectTier(lvl)}
                     disabled={isCurrent}
                   >
                    {isCurrent ? "Current Plan" : lvl === "free" ? "Use Free" : `Subscribe — ${t.price}`}
                  </button>
                </div>
              );
            })}
            <div className="tier-card tier-card--season">
              <div className="tier-name">{SEASON_PASS.name}</div>
              <div className="tier-price">{SEASON_PASS.price}</div>
              <p className="tier-desc">{SEASON_PASS.description}</p>
              <ul className="tier-features">
                {SEASON_PASS.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <button
                className="btn-outline tier-select-btn"
                type="button"
                disabled={!SEASON_PASS.stripePriceId}
                onClick={() => handleSelectTier("seasonPass")}
              >
                {SEASON_PASS.stripePriceId ? `Buy — ${SEASON_PASS.price}` : "Coming Soon"}
              </button>
            </div>
          </div>
        ) : (
          <div className="tier-signup">
            <button className="btn-outline tier-back" onClick={() => setSignupStep(null)}>← Back</button>
            <h3 className="tier-signup-title">
              {signupStep === "seasonPass" ? `Buy ${SEASON_PASS.name}` : `Sign up for ${signupTier.name}`}
            </h3>
            <p className="tier-signup-desc">
              {signupStep === "seasonPass"
                ? "Enter your email to start your Season Pass purchase."
                : "Enter your email to link your subscription. After payment you'll be redirected back with your tier activated."}
            </p>
            {signupTier && (
              <div className="tier-billing-toggle" role="group" aria-label="Billing period">
                <button
                  type="button"
                  className={`btn-outline btn-sm${billingPeriod === "monthly" ? " tier-billing-toggle--active" : ""}`}
                  onClick={() => setBillingPeriod("monthly")}
                >
                  Monthly · {signupTier.price}
                </button>
                <button
                  type="button"
                  className={`btn-outline btn-sm${billingPeriod === "annual" ? " tier-billing-toggle--active" : ""}`}
                  onClick={() => setBillingPeriod("annual")}
                  disabled={!signupTier.stripeAnnualPriceId}
                >
                  Annual · {signupTier.annualPrice ?? "Coming Soon"}
                </button>
              </div>
            )}
            <input
              className="input"
              type="email"
              placeholder="your@email.com"
              value={signupEmail}
              onChange={(e) => { setSignupEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleProceedToPayment()}
            />
            {error && <p className="tier-error">{error}</p>}
            <button className="btn-primary btn-lg" onClick={handleProceedToPayment} disabled={loading}>
              {loading
                ? "Redirecting to payment…"
                : `Continue to Payment — ${
                  signupStep === "seasonPass"
                    ? SEASON_PASS.price
                    : billingPeriod === "annual"
                      ? signupTier.annualPrice ?? signupTier.price
                      : signupTier.price
                }`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
