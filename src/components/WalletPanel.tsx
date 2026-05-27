import ozziesConfig from "../lib/ozziesConfig.json";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";

function formatTransactionTime(value: string): string {
  if (!value) return "Just now";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function WalletPanel() {
  const { user } = useAuth();
  const { wallet, recentTransactions, loading, error } = useWallet();

  if (!user || !wallet) return null;

  return (
    <section className="wallet-panel" aria-label="Ozzies wallet">
      <div className="wallet-panel__header">
        <div>
          <h2 className="wallet-panel__title">💰 Ozzies Wallet</h2>
          <p className="wallet-panel__subtitle">
            Card Forge spend path: {ozziesConfig.cardForgeCost} Ozzies per extra forge.
          </p>
        </div>
        <div className="wallet-panel__balance">
          <span className="wallet-panel__balance-label">Balance</span>
          <strong>{wallet.currentBalance}</strong>
        </div>
      </div>
      <div className="wallet-panel__stats">
        <span>Lifetime earned: {wallet.lifetimeEarned}</span>
        <span>Lifetime spent: {wallet.lifetimeSpent}</span>
      </div>
      {error && <p className="wallet-panel__error" role="alert">{error}</p>}
      <div className="wallet-panel__ledger">
        <div className="wallet-panel__ledger-header">Recent transactions</div>
        {loading && recentTransactions.length === 0 ? (
          <p className="wallet-panel__empty">Loading wallet activity…</p>
        ) : recentTransactions.length === 0 ? (
          <p className="wallet-panel__empty">No Ozzies activity yet.</p>
        ) : (
          <ul className="wallet-panel__list">
            {recentTransactions.map((entry) => (
              <li key={entry.id} className="wallet-panel__entry">
                <div>
                  <span className={`wallet-panel__delta wallet-panel__delta--${entry.direction}`}>
                    {entry.direction === "credit" ? "+" : "-"}{entry.amount}
                  </span>
                  <span className="wallet-panel__description">{entry.description}</span>
                </div>
                <div className="wallet-panel__meta">
                  <span>Bal {entry.balanceAfter}</span>
                  <span>{formatTransactionTime(entry.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
