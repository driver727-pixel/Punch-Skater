import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTier } from "../context/TierContext";
import { useCollection } from "../hooks/useCollection";
import { DECK_CARD_LIMIT, useDecks } from "../hooks/useDecks";
import { useFactionDiscovery } from "../hooks/useFactionDiscovery";
import { TIERS } from "../lib/tiers";
import { sfxNavigate } from "../lib/sfx";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { CardThumbnail } from "../components/CardThumbnail";
import { resolveUserDisplayName, resolveUserInitial } from "../lib/userIdentity";
import { computeDeckTotalPower } from "../lib/battle";
import { getForgeClassOptions } from "../lib/cardClassProgression";
import { computeCrewOzzies, computeCrewXp } from "../lib/progression";
import { WalletPanel } from "../components/WalletPanel";

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

const PRIMARY_DECK_CARD_WIDTH = 160;
const PRIMARY_DECK_CARD_HEIGHT = 224;

export function UserProfile() {
  const { user, userProfile } = useAuth();
  const { tier } = useTier();
  const tierData = TIERS[tier];
  const { cards } = useCollection();
  const { decks } = useDecks();
  const { discoveredFactions } = useFactionDiscovery();
  const { myEntry } = useLeaderboard();

  const primaryDeck = decks.find((d) => d.isPrimary) ?? null;
  const primaryDeckCards = primaryDeck?.cards ?? [];
  const deckPower = computeDeckTotalPower(primaryDeckCards);
  const crewOzzies = computeCrewOzzies(primaryDeckCards);
  const crewXp = computeCrewXp(primaryDeckCards);
  const missionXp = userProfile?.missionXp ?? 0;
  const missionOzzies = Number(userProfile?.missionOzzies ?? 0);
  const forgeOptions = getForgeClassOptions({ missionXp: Number(missionXp), missionOzzies, deckPower });
  const highestUnlockedForge = [...forgeOptions].reverse().find((option) => option.unlocked)?.rarity ?? "Punch Skater™";
  const nextUnlock = forgeOptions.find((option) => !option.unlocked) ?? null;

  const displayName = resolveUserDisplayName({
    profileDisplayName: userProfile?.displayName,
    authDisplayName: user?.displayName,
    email: user?.email,
    fallbackName: "Courier",
  });
  const avatarLetter = resolveUserInitial(displayName);
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

      {/* ── Primary Deck ───────────────────────────────────── */}
      <section className="profile-primary-deck">
        <h2 className="profile-hub-heading">
          Primary Deck
          {primaryDeck && (
            <span className="profile-primary-deck__name"> — {primaryDeck.name}</span>
          )}
        </h2>
        {primaryDeck ? (
          <div className="profile-primary-deck__cards">
            {primaryDeck.cards.map((card) => (
              <div key={card.id} className="profile-primary-deck__card">
                <CardThumbnail card={card} width={PRIMARY_DECK_CARD_WIDTH} height={PRIMARY_DECK_CARD_HEIGHT} />
                <span className="profile-primary-deck__card-name">{card.identity.name}</span>
              </div>
            ))}
            {primaryDeck.cards.length === 0 && (
              <p className="profile-primary-deck__empty">No cards in this deck yet.</p>
            )}
          </div>
        ) : (
          <p className="profile-primary-deck__empty">
            No primary deck set — head to the <strong>Deck Builder</strong> and star a deck to feature it here.
          </p>
        )}
      </section>

      {/* ── Progress snapshot ──────────────────────────────── */}
      <section className="profile-section">
        <h2 className="profile-hub-heading">Progress Snapshot</h2>
        <div className="forge-objective-card forge-objective-card--snapshot">
          <div className="forge-objective-stats">
            <div className="forge-objective-stat">
              <span className="forge-objective-stat-label">Collection</span>
              <strong>{cards.length}</strong>
            </div>
            <div className="forge-objective-stat">
              <span className="forge-objective-stat-label">Crew size</span>
              <strong>{primaryDeckCards.length}/{DECK_CARD_LIMIT}</strong>
            </div>
            <div className="forge-objective-stat">
              <span className="forge-objective-stat-label">Crew power</span>
              <strong>{deckPower}</strong>
            </div>
            <div className="forge-objective-stat">
              <span className="forge-objective-stat-label">Crew Ozzies</span>
              <strong>{crewOzzies.toLocaleString()}</strong>
            </div>
            <div className="forge-objective-stat">
              <span className="forge-objective-stat-label">Mission XP</span>
              <strong>{Number(missionXp).toLocaleString()}</strong>
            </div>
            <div className="forge-objective-stat">
              <span className="forge-objective-stat-label">Crew XP</span>
              <strong>{crewXp.toLocaleString()}</strong>
            </div>
          </div>
          <div className="forge-objective-unlocks">
            <p>
              <span className="forge-objective-stat-label">Highest forge unlocked</span>
              <strong>{highestUnlockedForge}</strong>
            </p>
            <p>
              <span className="forge-objective-stat-label">Next unlock</span>
              <strong>{nextUnlock?.rarity ?? "Legendary stays reward-only"}</strong>
            </p>
            {nextUnlock?.unlockHint && (
              <p className="forge-objective-unlock-hint">{nextUnlock.unlockHint}</p>
            )}
            {user && missionOzzies > 0 && (
              <p className="forge-objective-unlock-hint">
                Mission Ozzies banked: {missionOzzies.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Ozzies wallet ──────────────────────────────────── */}
      <section className="profile-section">
        <h2 className="profile-hub-heading">Ozzies Wallet</h2>
        <WalletPanel />
      </section>

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
