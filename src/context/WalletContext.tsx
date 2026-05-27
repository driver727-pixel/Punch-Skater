import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlayerWallet, WalletTransaction } from "../lib/sharedTypes";
import { useAuth } from "./AuthContext";
import { fetchWalletState, type WalletMutationResponse } from "../services/wallet";

interface WalletContextValue {
  wallet: PlayerWallet | null;
  recentTransactions: WalletTransaction[];
  loading: boolean;
  error: string | null;
  refreshWallet: () => Promise<void>;
  applyWalletMutation: (payload: WalletMutationResponse) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  const [wallet, setWallet] = useState<PlayerWallet | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fallbackUid = userProfile?.uid ?? "";
  const fallbackBalance = userProfile?.ozziesBalance ?? 0;
  const fallbackLifetimeEarned = userProfile?.ozziesLifetimeEarned ?? 0;
  const fallbackLifetimeSpent = userProfile?.ozziesLifetimeSpent ?? 0;

  const refreshWallet = useCallback(async () => {
    if (!user) {
      setWallet(null);
      setRecentTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchWalletState(user);
      setWallet(payload.wallet);
      setRecentTransactions(payload.recentTransactions);
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Failed to load wallet.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const applyWalletMutation = useCallback((payload: WalletMutationResponse) => {
    setWallet(payload.wallet);
    setRecentTransactions((current) => {
      const next = [payload.transaction, ...current.filter((entry) => entry.id !== payload.transaction.id)];
      return next.slice(0, 8);
    });
    setError(null);
  }, []);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      setRecentTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }
    void refreshWallet();
  }, [refreshWallet, user]);

  const walletValue = useMemo<PlayerWallet | null>(() => {
    if (wallet) return wallet;
    if (!fallbackUid) return null;
    return {
      uid: fallbackUid,
      currentBalance: fallbackBalance,
      lifetimeEarned: fallbackLifetimeEarned,
      lifetimeSpent: fallbackLifetimeSpent,
      updatedAt: "",
    };
  }, [
    wallet,
    fallbackUid,
    fallbackBalance,
    fallbackLifetimeEarned,
    fallbackLifetimeSpent,
  ]);

  return (
    <WalletContext.Provider value={{ wallet: walletValue, recentTransactions, loading, error, refreshWallet, applyWalletMutation }}>
      {children}
    </WalletContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
