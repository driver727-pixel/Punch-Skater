interface ForgeWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const RARITY_TIERS = [
  { label: "Punch Skater", chance: "82%", note: "most common" },
  { label: "Apprentice",   chance: "12%", note: "uncommon pull" },
  { label: "Master",       chance: "4%",  note: "rare pull" },
  { label: "Rare",         chance: "2%",  note: "ultra-rare pull" },
  { label: "Legendary",    chance: "—",   note: "reward-only, earned through gameplay" },
] as const;

const GAME_LOOP_STEPS = [
  { icon: "⚡", label: "Forge", desc: "Configure your skater and reveal a random class card — every pull is a blind drop." },
  { icon: "👥", label: "Build a 6-Card Crew", desc: "Assemble exactly 6 cards into an active Crew. Crew Power and Ozzies determine your rank." },
  { icon: "🗺️", label: "Run Missions", desc: "Daily Rituals earn XP, Ozzies, and loot. Mission outcomes can boost or strain your cards." },
  { icon: "🏆", label: "Win Jousts", desc: "Face rival skaters in card-based joust encounters. Choose your tactic, leverage crew stats, and take the win." },
  { icon: "💰", label: "Earn Rewards", desc: "Collect XP, Ozzies, card packs, lore unlocks, and rare cards. Reaching Deck Power thresholds unlocks higher rarity forges." },
  { icon: "🤝", label: "Trade Cards", desc: "Swap cards with other players to fill crew gaps, chase rare pulls, or build the perfect faction lineup." },
  { icon: "📊", label: "Climb the Leaderboard", desc: "Post your best 6-card Crew and compete for the top rank on the neon underground leaderboard." },
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
        <h2 id="forge-welcome-title" className="forge-welcome__title">Welcome to Punch Skater, Rookie.</h2>
        <p className="forge-welcome__tagline">
          Create your skater. Build your crew. Win the joust. Rule the neon streets.
        </p>
        <p className="forge-welcome__lede">
          Punch Skater is a collectible card game built around creation, crews, missions, jousting, trading, and underground glory. Every card you forge is a cyberpunk electric-skate warrior. Your goal: forge a legendary 6-card crew, dominate joust encounters, and climb to the top of the neon leaderboard.
        </p>

        <h3 className="forge-welcome__loop-title">The Game Loop</h3>
        <ol className="forge-welcome__loop">
          {GAME_LOOP_STEPS.map((step, i) => (
            <li key={step.label} className="forge-welcome__loop-step">
              <span className="forge-welcome__loop-num" aria-hidden="true">{i + 1}</span>
              <span className="forge-welcome__loop-icon" aria-hidden="true">{step.icon}</span>
              <span className="forge-welcome__loop-label">{step.label}</span>
              <span className="forge-welcome__loop-desc">{step.desc}</span>
            </li>
          ))}
        </ol>

        <div className="forge-welcome__odds">
          <h3 className="forge-welcome__odds-title">Forge Class Odds</h3>
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
            Got it — let's forge
          </button>
        </div>
      </div>
    </div>
  );
}
