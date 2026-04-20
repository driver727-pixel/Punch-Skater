interface ForgeWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ForgeWelcomeModal({ open, onClose }: ForgeWelcomeModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay forge-welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-welcome-title"
      onClick={onClose}
    >
      <div className="modal-panel forge-welcome-panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="close-btn modal-close"
          aria-label="Close welcome"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="forge-welcome__eyebrow">Start Here</div>
        <h2 id="forge-welcome-title" className="forge-welcome__title">Welcome to Punch Skater, rookie.</h2>
        <p className="forge-welcome__lede">
          The Card Forge is where you build your first deck, uncover hidden factions, and chase wild new combos across more than 4 million possible character variations.
        </p>
        <div className="forge-welcome__grid">
          <div className="forge-welcome__item">
            <h3>What</h3>
            <p>Create Punch Skater cards, upgrade your squad with a Master card, and assemble a six-card deck built for missions, battles, and trades.</p>
          </div>
          <div className="forge-welcome__item">
            <h3>How</h3>
            <p>Start by forging 5 Punch Skater class cards and 1 Master class card, then tune their look, district, and board loadout before you lock them into your lineup.</p>
          </div>
          <div className="forge-welcome__item">
            <h3>Why</h3>
            <p>Earn points and power-ups on Missions, bring your best deck into the Battle Arena, and trade for the cards that complete your next big strategy.</p>
          </div>
        </div>
        <div className="forge-welcome__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Got it, let's forge
          </button>
        </div>
      </div>
    </div>
  );
}
