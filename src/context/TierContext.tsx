import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { loadTier, saveTier, loadEmail, saveEmail, clearAccount, type TierLevel } from "../lib/tiers";

interface TierContextValue {
  tier: TierLevel;
  email: string;
  setTier: (level: TierLevel, email?: string) => void;
  logout: () => void;
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

export function TierProvider({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState<TierLevel>(resolveInitialTier);
  const [email, setEmailState] = useState<string>(resolveInitialEmail);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  const openUpgradeModal = useCallback(() => setShowUpgradeModal(true), []);
  const closeUpgradeModal = useCallback(() => setShowUpgradeModal(false), []);

  return (
    <TierContext.Provider value={{ tier, email, setTier, logout, showUpgradeModal, openUpgradeModal, closeUpgradeModal }}>
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
