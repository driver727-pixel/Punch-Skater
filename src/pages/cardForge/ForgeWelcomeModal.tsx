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
            <p>Forge Punch Skater cards, claim a Rare signup bonus, and build toward stronger classes as your crew earns XP and Ozzies.</p>
          </div>
          <div className="forge-welcome__item">
            <h3>How</h3>
            <p>Start with Punch Skater class cards only, then unlock Apprentice, Master, and Rare forging over time. Legendary cards stay off the table.</p>
          </div>
          <div className="forge-welcome__item">
            <h3>Why</h3>
            <p>Build the right deck for each district mission, bring your best lineup into the Battle Arena, and trade for the cards that complete your next big strategy.</p>
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
