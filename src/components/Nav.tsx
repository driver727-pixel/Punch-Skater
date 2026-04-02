import { NavLink } from "react-router-dom";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";
import { SupportButton } from "./SupportButton";
import { TierModal } from "./TierModal";

export function Nav() {
  const { tier, email, logout, showUpgradeModal, openUpgradeModal, closeUpgradeModal } = useTier();
  const tierData = TIERS[tier];

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-logo">⚡</span>
          <span className="nav-title">SKATER PUNK</span>
          <span className="nav-subtitle">DECK BUILDER</span>
        </div>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Card Forge
          </NavLink>
          <NavLink to="/collection" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Collection
          </NavLink>
          <NavLink to="/decks" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Deck Builder
          </NavLink>
        </div>

        <div className="nav-right">
          <SupportButton />
          <button
            className={`tier-badge-btn tier-badge-btn--${tier}`}
            onClick={openUpgradeModal}
            title="Manage your tier"
          >
            {tierData.name}
          </button>
          {tier !== "free" && email && (
            <button className="btn-outline nav-logout" onClick={logout} title="Sign out">
              ⏏
            </button>
          )}
        </div>
      </nav>

      {showUpgradeModal && <TierModal onClose={closeUpgradeModal} />}
    </>
  );
}
