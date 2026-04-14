import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useTier } from "../context/TierContext";
import { useAuth } from "../context/AuthContext";
import { TIERS } from "../lib/tiers";
import { db } from "../lib/firebase";
import { TierModal } from "./TierModal";
import { isAdminEmail } from "../lib/adminUtils";
import { useFactionDiscovery } from "../hooks/useFactionDiscovery";
import { sfxNavigate } from "../lib/sfx";
import { GeoAtlas } from "./GeoAtlas";

export function Nav() {
  const { tier, logout: tierLogout, showUpgradeModal, openUpgradeModal, closeUpgradeModal } = useTier();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const tierData = TIERS[tier];
  const uid = user?.uid ?? null;
  const isAdmin = isAdminEmail(user?.email ?? "");
  const { discoveredFactions } = useFactionDiscovery();

  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [pendingTrades, setPendingTrades] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Count pending incoming trades for the badge
  useEffect(() => {
    if (!uid || !db) { setPendingTrades(0); return; }
    const unsub = onSnapshot(
      query(
        collection(db, "trades"),
        where("toUid", "==", uid),
        where("status", "==", "pending")
      ),
      (snap) => setPendingTrades(snap.size)
    );
    return unsub;
  }, [uid]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile nav when clicking outside
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [navOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    tierLogout();
    await signOut();
    navigate("/");
  };

  const renderNavLinks = (onClick?: () => void) => {
    const handleNav = () => { sfxNavigate(); onClick?.(); };
    return (
    <>
      <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
        Card Forge
      </NavLink>
      <NavLink to="/collection" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
        Collection
      </NavLink>
      <NavLink to="/decks" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
        My Decks
      </NavLink>
      {user && (
        <NavLink to="/mission" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
          Mission
        </NavLink>
      )}
      <NavLink to="/trades" className={({ isActive }) => `nav-link${isActive ? " active" : ""}${pendingTrades > 0 ? " nav-link--badge" : ""}`} onClick={handleNav}>
        Trades{pendingTrades > 0 && <span className="nav-badge">{pendingTrades}</span>}
      </NavLink>
      {user && (
        <NavLink to="/arena" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
          Arena
        </NavLink>
      )}
      <NavLink to="/lore" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
        Codex
      </NavLink>
      {discoveredFactions.length > 0 && (
        <NavLink to="/factions" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={handleNav}>
          Factions
        </NavLink>
      )}
      {isAdmin && (
        <>
          <NavLink to="/admin" className={({ isActive }) => isActive ? "nav-link nav-link--admin active" : "nav-link nav-link--admin"} onClick={handleNav}>
            ⚙ Admin
          </NavLink>
          <NavLink to="/dev/asset-generator" className={({ isActive }) => isActive ? "nav-link nav-link--admin active" : "nav-link nav-link--admin"} onClick={handleNav}>
            🎨 Assets
          </NavLink>
        </>
      )}
    </>
    );
  };

  return (
    <>
      <div className="nav-container" ref={navContainerRef}>
        <nav className="nav">
          <div className="nav-inner">
          <div className="nav-brand">
            <span className="nav-title">Punch Skater</span>
            <span className="nav-subtitle">DECK BUILDER</span>
            <a href="https://sk8rpunk.com" target="_blank" rel="noopener noreferrer" className="nav-game-badge">A Sk8r Punk Game</a>
          </div>

          <GeoAtlas compact section="neon" className="nav-neon-map" />

          <div className="nav-links">
            {renderNavLinks()}
          </div>

          <div className="nav-right">
            <button
              className={`tier-badge-btn tier-badge-btn--${tier} nav-desktop-only`}
              onClick={openUpgradeModal}
              title={`Pricing Tier: ${tierData.name} — Your tier sets the site's visual aesthetic. Click to manage.`}
              data-tier-tooltip={`Pricing Tier: ${tierData.name}`}
            >
              Pricing Tier: {tierData.name}
            </button>

            {authLoading ? (
              <span className="nav-auth-loading" aria-label="Loading…" />
            ) : user ? (
              <div className="user-menu-wrap" ref={menuRef}>
                <button
                  className="user-avatar-btn"
                  onClick={() => setMenuOpen((v) => !v)}
                  title={user.email ?? "Account"}
                >
                  {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                </button>
                {menuOpen && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-email">{user.email}</div>
                    <button
                      className="user-dropdown-item"
                      onClick={() => { setMenuOpen(false); navigate("/account"); }}
                    >
                      ⚙ Account Settings
                    </button>
                    <button
                      className="user-dropdown-item"
                      onClick={() => { setMenuOpen(false); navigate("/trades"); }}
                    >
                      🤝 Trades{pendingTrades > 0 && ` (${pendingTrades})`}
                    </button>
                    <button
                      className="user-dropdown-item"
                      onClick={handleLogout}
                    >
                      ⏏ Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-outline nav-logout"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
            )}

            <button
              className="nav-hamburger"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
            >
              {navOpen ? "✕" : "☰"}
            </button>
          </div>
          </div>
        </nav>

        {navOpen && (
          <div className="nav-mobile-menu">
            {renderNavLinks(() => setNavOpen(false))}
            <div className="nav-mobile-menu-footer">
              <button
                className={`tier-badge-btn tier-badge-btn--${tier}`}
                onClick={() => { setNavOpen(false); openUpgradeModal(); }}
                title={`Pricing Tier: ${tierData.name}`}
              >
                Pricing Tier: {tierData.name}
              </button>
            </div>
          </div>
        )}
      </div>

      {showUpgradeModal && <TierModal onClose={closeUpgradeModal} />}
    </>
  );
}
