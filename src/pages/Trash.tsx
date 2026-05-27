import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../context/AuthContext";

export function Trash() {
  const { user } = useAuth();
  const { cards } = useCollection();

  // Cards that have been explicitly flagged as trashed (future feature).
  // For now, the trash bin is empty until the trashing workflow is wired up.
  const trashedCards = cards.filter((c) => (c as { trashed?: boolean }).trashed === true);

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <p>Sign in to view your trash bin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Trash</h1>
      <p className="page-sub">Cards you have discarded — recover them before they are gone for good</p>

      {trashedCards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🗑</span>
          <p>Your trash bin is empty.</p>
          <p className="empty-hint">
            Cards you remove from your collection will appear here before being permanently deleted.
          </p>
        </div>
      ) : (
        <div className="trash-grid">
          {trashedCards.map((card) => (
            <div key={card.id} className="trash-card-item">
              <span className="trash-card-name">{card.identity?.name ?? "Unnamed Card"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
