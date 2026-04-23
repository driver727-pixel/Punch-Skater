import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  saveTier,
  loadEmail,
  saveEmail,
  clearAccount,
  TIERS,
  loadCheckoutSessionId,
  saveCheckoutSessionId,
  clearCheckoutSessionId,
  FREE_CARD_USED_KEY,
  type TierLevel,
} from "../lib/tiers";
import { claimReferral, REFERRAL_CREDITS_KEY } from "../services/referrals";
import { useChargeUp, type ChargeUpState } from "../hooks/useChargeUp";
import { useAuth } from "./AuthContext";
import { db } from "../lib/firebase";
import { resolveApiUrl } from "../lib/apiUrls";

const CHECKOUT_VERIFY_API_URL = resolveApiUrl(
  import.meta.env.VITE_CHECKOUT_VERIFY_API_URL as string | undefined,
  "/api/verify-checkout-session",
);

interface VerifiedCheckout {
  sessionId: string;
  tier: Exclude<TierLevel, "free">;
  email: string;
}

function loadStoredCredits(): number {
  const v = localStorage.getItem(REFERRAL_CREDITS_KEY);
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function saveStoredCredits(n: number): void {
  localStorage.setItem(REFERRAL_CREDITS_KEY, String(Math.max(0, n)));
}

function loadFreeCardUsed(): boolean {
  return localStorage.getItem(FREE_CARD_USED_KEY) === "1";
}

interface TierContextValue {
  tier: TierLevel;
  email: string;
  /** Number of referral-earned generate credits remaining. */
  generateCredits: number;
  /** True when the user may forge a card (paid tier OR has credits OR free card available OR charge up). */
  canForge: boolean;
  /** True when the free tier's one complimentary card has already been used. */
  freeCardUsed: boolean;
  /** Charge Up timer state (8-hour free forge). */
  chargeUp: ChargeUpState;
  setTier: (level: TierLevel, email?: string) => void;
  logout: () => void;
  /** Consume one generate credit (call after a successful forge on free tier). */
  consumeCredit: () => void;
  /** Mark the free tier's one complimentary card as used. */
  markFreeCardUsed: () => void;
  showUpgradeModal: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
}

const TierContext = createContext<TierContextValue | null>(null);

function resolveInitialEmail(): string {
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  if (emailParam) return emailParam;
  return loadEmail();
}

/** Extracts a Stripe Checkout Session ID from the URL query string. */
function extractCheckoutSessionId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("checkout_session_id");
}

/** Extracts a referrer UID from the URL query string without mutating history. */
function extractReferrerUid(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") ?? null;
}

export function TierProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  const [tier, setTierState] = useState<TierLevel>("free");
  const [email, setEmailState] = useState<string>(resolveInitialEmail);
  const [generateCredits, setGenerateCredits] = useState<number>(loadStoredCredits);
  const [freeCardUsed, setFreeCardUsed] = useState<boolean>(loadFreeCardUsed);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [verifiedCheckout, setVerifiedCheckout] = useState<VerifiedCheckout | null>(null);

  // ── Capture Checkout Session IDs returned from Stripe ──────────────────────
  useEffect(() => {
    const sessionId = extractCheckoutSessionId();
    if (!sessionId) return;
    saveCheckoutSessionId(sessionId);

    const params = new URLSearchParams(window.location.search);
    params.delete("checkout_session_id");
    const newSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (newSearch ? `?${newSearch}` : "")
    );
  }, []);

  // ── Verify pending Stripe checkout sessions before trusting tier access ────
  useEffect(() => {
    const sessionId = loadCheckoutSessionId();
    if (!sessionId) return;
    const storedEmail = loadEmail().trim();
    if (!storedEmail) {
      console.warn("[Tier] Checkout verification skipped because no purchase email is stored.");
      return;
    }

    let cancelled = false;
    const verifyUrl = new URL(CHECKOUT_VERIFY_API_URL, window.location.origin);
    verifyUrl.searchParams.set("session_id", sessionId);
    verifyUrl.searchParams.set("email", storedEmail);
    fetch(verifyUrl.toString())
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(
            `Failed to verify checkout session (HTTP ${resp.status}): ${data.error ?? "Unknown error"}`,
          );
        }
        if (data?.tier !== "tier2" && data?.tier !== "tier3") {
          throw new Error("Checkout verification returned an invalid tier.");
        }
        return {
          sessionId,
          tier: data.tier,
          email: typeof data.email === "string" ? data.email : "",
        } as VerifiedCheckout;
      })
      .then((checkout) => {
        if (cancelled) return;
        setVerifiedCheckout(checkout);
        // Preserve an existing tier3 grant (for example admin access or a higher
        // paid plan already stored on the device) rather than downgrading it
        // when a verified tier2 checkout is restored.
        setTierState((prev) => {
          const nextTier = prev === "tier3" ? prev : checkout.tier;
          saveTier(nextTier);
          return nextTier;
        });
        if (checkout.email) {
          setEmailState(checkout.email);
          saveEmail(checkout.email);
        }
      })
      .catch((error) => {
        console.warn("[Tier] Checkout verification failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Sync tier from Firestore when user logs in ────────────────────────────
  useEffect(() => {
    if (!user || !db) return;
    const verifiedEmail = verifiedCheckout?.email.trim().toLowerCase();
    const userEmail = user.email?.trim().toLowerCase() ?? "";
    const profileRef = doc(db, "userProfiles", user.uid);

    return onSnapshot(profileRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;

      // Admin users always get tier3
      if (userProfile?.isAdmin) {
        setTierState("tier3");
        saveTier("tier3");
        clearCheckoutSessionId();
        return;
      }

      if (data?.tier === "tier2" || data?.tier === "tier3") {
        setTierState(data.tier);
        saveTier(data.tier);
        clearCheckoutSessionId();
        return;
      }

      if (
        verifiedCheckout &&
        verifiedEmail &&
        userEmail &&
        verifiedEmail !== userEmail
      ) {
        setTierState("free");
        saveTier("free");
        return;
      }

      if (
        verifiedCheckout &&
        verifiedEmail &&
        userEmail &&
        verifiedEmail === userEmail
      ) {
        setTierState(verifiedCheckout.tier);
        saveTier(verifiedCheckout.tier);
        clearCheckoutSessionId();
        return;
      }

      if (data?.tier === "free" || !data?.tier) {
        setTierState("free");
        saveTier("free");
      }
    }, () => {/* non-fatal */});
  }, [user, userProfile?.isAdmin, verifiedCheckout]);

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

  const chargeUp = useChargeUp();
  const canForge = TIERS[tier].canGenerate || generateCredits > 0 || (tier === "free" && !freeCardUsed) || chargeUp.available;

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

  const markFreeCardUsed = useCallback(() => {
    localStorage.setItem(FREE_CARD_USED_KEY, "1");
    setFreeCardUsed(true);
  }, []);

  const openUpgradeModal = useCallback(() => setShowUpgradeModal(true), []);
  const closeUpgradeModal = useCallback(() => setShowUpgradeModal(false), []);

  return (
    <TierContext.Provider value={{
      tier, email, generateCredits, canForge, freeCardUsed, chargeUp,
      setTier, logout, consumeCredit, markFreeCardUsed,
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
