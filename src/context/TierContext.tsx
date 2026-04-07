import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { loadTier, saveTier, loadEmail, saveEmail, clearAccount, TIERS, type TierLevel } from "../lib/tiers";
import { claimReferral, REFERRAL_CREDITS_KEY } from "../services/referrals";

function loadStoredCredits(): number {
  const v = localStorage.getItem(REFERRAL_CREDITS_KEY);
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function saveStoredCredits(n: number): void {
  localStorage.setItem(REFERRAL_CREDITS_KEY, String(Math.max(0, n)));
}

interface TierContextValue {
  tier: TierLevel;
  email: string;
  /** Number of referral-earned generate credits remaining. */
  generateCredits: number;
  /** True when the user may forge a card (paid tier OR has credits). */
  canForge: boolean;
  setTier: (level: TierLevel, email?: string) => void;
  logout: () => void;
  /** Consume one generate credit (call after a successful forge on free tier). */
  consumeCredit: () => void;
  showUpgradeModal: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
}

const TierContext = createContext<TierContextValue | null>(null);

function resolveInitialTier(): TierLevel {
  const params = new URLSearchParams(window.location.search);
  const tierParam = params.get("tier");
  if (tierParam === "tier2" || tierParam === "tier3") {
    saveTier(tierParam);
    const emailParam = params.get("email");
    if (emailParam) saveEmail(emailParam);
    const clean = window.location.pathname;
    window.history.replaceState({}, "", clean);
    return tierParam;
  }
  return loadTier();
}

function resolveInitialEmail(): string {
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  if (emailParam) return emailParam;
  return loadEmail();
}

/** Extracts a referrer UID from the URL query string without mutating history. */
function extractReferrerUid(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") ?? null;
}

export function TierProvider({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState<TierLevel>(resolveInitialTier);
  const [email, setEmailState] = useState<string>(resolveInitialEmail);
  const [generateCredits, setGenerateCredits] = useState<number>(loadStoredCredits);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // ── Handle referral link on first mount ───────────────────────────────────
  useEffect(() => {
    const referrerUid = extractReferrerUid();
    if (!referrerUid) return;

    // Strip ref param from URL so it doesn't persist on reload
    const params = new URLSearchParams(window.location.search);
    params.delete("ref");
    const newSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (newSearch ? `?${newSearch}` : "")
    );

    // Claim asynchronously — visitorUid unknown at this point (auth is separate)
    claimReferral(referrerUid, null).catch((err) => {
      console.warn("[Referral] Failed to record referral claim:", err);
    });
  }, []);

  const canForge = TIERS[tier].canGenerate || generateCredits > 0;

  const setTier = useCallback((level: TierLevel, newEmail?: string) => {
    setTierState(level);
    saveTier(level);
    if (newEmail !== undefined) {
      setEmailState(newEmail);
      saveEmail(newEmail);
    }
  }, []);

  const logout = useCallback(() => {
    clearAccount();
    setTierState("free");
    setEmailState("");
  }, []);

  const consumeCredit = useCallback(() => {
    setGenerateCredits((prev) => {
      const next = Math.max(0, prev - 1);
      saveStoredCredits(next);
      return next;
    });
  }, []);

  const openUpgradeModal = useCallback(() => setShowUpgradeModal(true), []);
  const closeUpgradeModal = useCallback(() => setShowUpgradeModal(false), []);

  return (
    <TierContext.Provider value={{
      tier, email, generateCredits, canForge,
      setTier, logout, consumeCredit,
      showUpgradeModal, openUpgradeModal, closeUpgradeModal,
    }}>
      {children}
    </TierContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used inside TierProvider");
  return ctx;
}

