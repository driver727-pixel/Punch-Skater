interface ForgeWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const RARITY_TIERS = [
  { label: "Punch Skater", chance: "82%", note: "most common" },
  { label: "Apprentice",   chance: "12%", note: "uncommon pull" },
  { label: "Master",       chance: "4%",  note: "rare pull" },
  { label: "Rare",         chance: "2%",  note: "ultra-rare pull" },
  { label: "Legendary",    chance: "—",   note: "reward-only" },
] as const;

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
            <p>Forge blind pulls, claim a Rare signup bonus, and build toward stronger classes through races, missions, streaks, and house rewards.</p>
          </div>
          <div className="forge-welcome__item">
            <h3>How</h3>
            <p>Every forge is a blind pull — the class stays hidden until the card resolves. Hit the Forge button and find out what you won.</p>
          </div>
          <div className="forge-welcome__item">
            <h3>Why</h3>
            <p>Hidden class reveals keep every forge spicy, push deck diversity, and make the cards you win, trade, or earn feel worth chasing.</p>
          </div>
        </div>
        <div className="forge-welcome__odds">
          <h3 className="forge-welcome__odds-title">Class Odds</h3>
          <ul className="forge-welcome__odds-list">
            {RARITY_TIERS.map((tier) => (
              <li key={tier.label} className="forge-welcome__odds-row">
                <span className="forge-welcome__odds-label">{tier.label}</span>
                <span className="forge-welcome__odds-chance">{tier.chance}</span>
                <span className="forge-welcome__odds-note">{tier.note}</span>
              </li>
            ))}
          </ul>
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
