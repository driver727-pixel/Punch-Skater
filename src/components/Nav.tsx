import { NavLink } from "react-router-dom";

export function Nav() {
  return (
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
    </nav>
  );
}
