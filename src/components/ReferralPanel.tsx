import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useTier } from "../context/TierContext";
import { getReferralCreditCount } from "../services/referrals";

/**
 * ReferralPanel
 *
 * Shown on the Card Forge page when the user is logged in.
 * Displays their personal referral link and the number of credits they have
 * earned from referrals.  When a friend visits via the link the referrer's
 * credit count (stored in Firestore) is incremented.
 */
export function ReferralPanel() {
  const { user } = useAuth();
  const { generateCredits } = useTier();
  const [copied, setCopied] = useState(false);
  const [firestoreCredits, setFirestoreCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState(false);

  const referralLink = user
    ? `${window.location.origin}/?ref=${user.uid}`
    : null;

  // Load the live credit count from Firestore
  useEffect(() => {
    if (!user) return;
    setCreditsLoading(true);
    setCreditsError(false);
    getReferralCreditCount(user.uid)
      .then((count) => {
        setFirestoreCredits(count);
        setCreditsLoading(false);
      })
      .catch(() => {
        setCreditsError(true);
        setCreditsLoading(false);
      });
  }, [user]);

  const handleCopy = useCallback(() => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralLink]);

  if (!user) return null;

  const displayCredits = firestoreCredits ?? generateCredits;

  return (
    <div className="referral-panel" data-testid="referral-panel">
      <h3 className="referral-panel__title">🎟 Referral Credits</h3>
      <p className="referral-panel__desc">
        Share your link below. Every friend who visits earns you{" "}
        <strong>1 free generate credit</strong>.
      </p>

      <div className="referral-panel__credits">
        Credits earned:{" "}
        {creditsLoading ? (
          <span className="referral-panel__count" aria-label="Loading credits…">…</span>
        ) : creditsError ? (
          <span className="referral-panel__count referral-panel__count--error" title="Could not load from server">
            {generateCredits} <small>(local)</small>
          </span>
        ) : (
          <span className="referral-panel__count">{displayCredits}</span>
        )}
      </div>

      <div className="referral-panel__link-row">
        <input
          className="input referral-panel__input"
          readOnly
          value={referralLink ?? ""}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          data-testid="referral-link-input"
        />
        <button
          className="btn-outline referral-panel__copy"
          onClick={handleCopy}
          data-testid="referral-copy-btn"
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
