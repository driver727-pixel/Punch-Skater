import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTier } from "../context/TierContext";
import { useCollection } from "../hooks/useCollection";
import { useFactionDiscovery } from "../hooks/useFactionDiscovery";
import { TIERS } from "../lib/tiers";
import { sfxNavigate } from "../lib/sfx";
import { useLeaderboard } from "../hooks/useLeaderboard";

interface ProfileLinkProps {
  icon: string;
  label: string;
  to: string;
  badge?: number;
  desc: string;
}

function ProfileLink({ icon, label, to, badge, desc }: ProfileLinkProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="profile-hub-link"
      onClick={() => { sfxNavigate(); navigate(to); }}
    >
      <span className="profile-hub-link__icon">{icon}</span>
      <span className="profile-hub-link__body">
        <span className="profile-hub-link__label">
          {label}
          {badge != null && badge > 0 && (
            <span className="profile-hub-link__badge">{badge}</span>
          )}
        </span>
        <span className="profile-hub-link__desc">{desc}</span>
      </span>
      <span className="profile-hub-link__arrow">›</span>
    </button>
  );
}

export function UserProfile() {
  const { user, userProfile } = useAuth();
  const { tier } = useTier();
  const tierData = TIERS[tier];
  const { cards } = useCollection();
  const { discoveredFactions } = useFactionDiscovery();
  const { myEntry } = useLeaderboard();

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Courier";
  const avatarLetter = displayName[0].toUpperCase();
  const missionXp = userProfile?.missionXp ?? 0;
  const ozzies = userProfile?.ozzies ?? 0;

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <p>Sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page user-profile-page">
      {/* ── Hero card ──────────────────────────────────────── */}
      <div className="profile-hero">
        <div className="profile-avatar">{avatarLetter}</div>
        <div className="profile-hero-info">
          <h1 className="profile-hero-name">{displayName}</h1>
          <span className={`profile-hero-tier profile-hero-tier--${tier}`}>
            {tierData.name}
          </span>
          {user.email && (
            <p className="profile-hero-email">{user.email}</p>
          )}
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="profile-stats-row">
        <div className="profile-stat">
          <span className="profile-stat__value">{cards.length}</span>
          <span className="profile-stat__label">Cards</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">{missionXp.toLocaleString()}</span>
          <span className="profile-stat__label">Mission XP</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">{ozzies.toLocaleString()}</span>
          <span className="profile-stat__label">Ozzies</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">{discoveredFactions.length}</span>
          <span className="profile-stat__label">Factions</span>
        </div>
        {myEntry && (
          <div className="profile-stat">
            <span className="profile-stat__value">{myEntry.seasonalRankScore ?? myEntry.deckPower}</span>
            <span className="profile-stat__label">Season Score</span>
          </div>
        )}
      </div>

      {/* ── Hub links ──────────────────────────────────────── */}
      <section className="profile-hub">
        <h2 className="profile-hub-heading">Your Hub</h2>
        <div className="profile-hub-grid">
          <ProfileLink
            icon="🤝"
            label="Trades"
            to="/trades"
            desc="Incoming offers, outbox, and the open market"
          />
          <ProfileLink
            icon="🔧"
            label="Workshop"
            to="/workshop"
            desc="Customize and upgrade your board loadout"
          />
          <ProfileLink
            icon="🕵️"
            label="Factions Revealed"
            to="/factions"
            badge={discoveredFactions.length}
            desc="The underground crews you have uncovered"
          />
          <ProfileLink
            icon="⚙"
            label="Settings"
            to="/account"
            desc="Display name, password, and linked languages"
          />
          <ProfileLink
            icon="🗑"
            label="Trash"
            to="/trash"
            desc="Cards you have discarded — recover or purge"
          />
        </div>
      </section>
    </div>
  );
}
