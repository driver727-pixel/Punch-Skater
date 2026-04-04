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
import { SupportButton } from "./SupportButton";
import { TierModal } from "./TierModal";

export function Nav() {
  const { tier, logout: tierLogout, showUpgradeModal, openUpgradeModal, closeUpgradeModal } = useTier();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const tierData = TIERS[tier];
  const uid = user?.uid ?? null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingTrades, setPendingTrades] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Count pending incoming trades for the badge
  useEffect(() => {
    if (!uid) { setPendingTrades(0); return; }
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

  const handleLogout = async () => {
    setMenuOpen(false);
    tierLogout();
    await signOut();
    navigate("/");
  };

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
          <NavLink to="/trades" className={({ isActive }) => `nav-link${isActive ? " active" : ""}${pendingTrades > 0 ? " nav-link--badge" : ""}`}>
            Trades{pendingTrades > 0 && <span className="nav-badge">{pendingTrades}</span>}
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

          {user ? (
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
        </div>
      </nav>

      {showUpgradeModal && <TierModal onClose={closeUpgradeModal} />}
    </>
  );
}
