import type { ReactNode } from "react";

interface ForgeStartHereProps {
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
  title?: string;
  titleId?: string;
}

const RARITY_TIERS = [
  { label: "Punch Skater™", chance: "82%", note: "most common" },
  { label: "Apprentice", chance: "12%", note: "uncommon pull" },
  { label: "Master", chance: "4%", note: "rare pull" },
  { label: "Rare", chance: "2%", note: "ultra-rare pull" },
  { label: "Legendary", chance: "—", note: "reward-only, earned through gameplay" },
] as const;

const GAME_LOOP_STEPS = [
  { icon: "⚡", label: "Forge", desc: "Roll a fresh skater card from a blind drop." },
  { icon: "👥", label: "Build a Crew", desc: "Pick your best 6 cards into one active crew." },
  { icon: "🗺️", label: "Run Missions", desc: "Earn XP, Ozzies, and rewards through district contracts." },
  { icon: "🏆", label: "Win Jousts", desc: "Counter rival tactics and convert your stat edge into wins." },
  { icon: "💰", label: "Claim Rewards", desc: "Unlock cosmetics, lore, and progression milestones." },
  { icon: "🤝", label: "Trade", desc: "Swap cards to patch weak roles and chase faction goals." },
  { icon: "📊", label: "Climb Rankings", desc: "Submit your crew and push for a top seasonal spot." },
] as const;

export function ForgeStartHere({
  actions,
  className = "",
  eyebrow = "Start Here",
  title = "Welcome to Punch Skater™, Rookie.",
  titleId,
}: ForgeStartHereProps) {
  return (
    <div className={`forge-welcome-panel${className ? ` ${className}` : ""}`}>
      <div className="forge-welcome__eyebrow">{eyebrow}</div>
      <h2 id={titleId} className="forge-welcome__title">{title}</h2>
      <p className="forge-welcome__tagline">
        Forge fast. Build smart. Climb rankings.
      </p>
      <p className="forge-welcome__lede">
        Your progression loop is simple: forge cards, lock a 6-card crew, run contracts, win jousts, and reinvest rewards.
        Legendary status is earned through play, not purchases.
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

      {actions ? <div className="forge-welcome__actions">{actions}</div> : null}
    </div>
  );
}
