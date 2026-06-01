import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { resolveUserDisplayName, resolveUserInitial } from "../lib/userIdentity";
import type { LeaderboardEntry } from "../lib/types";
import { warmRoutes } from "../lib/routePrefetch";
import { REFERRAL_CREDITS_KEY } from "../services/referrals";

interface RivalIntel {
  id: string;
  coverIdentity: string;
  rank: number;
  xpToPass: number;
  score: number;
  ozzies: number;
}

const CREW_CARD_TITLES = ["Point Runner", "Rail Ghost", "Signal Bruiser", "Deck Medic", "Data Ace", "Vault Spark"];
const DEFAULT_USER_RANK = 947;
const MIN_PROGRESS_PCT = 8;
const MAX_PROGRESS_PCT = 96;
const DEFAULT_PROGRESS_PCT = 28;

function buildFallbackRivals(userRank: number): RivalIntel[] {
  return [
    { id: "rival-neon-1", coverIdentity: "Vex Chromakick", rank: Math.max(1, userRank - 3), xpToPass: 150, score: 18_900, ozzies: 1_260 },
    { id: "rival-neon-2", coverIdentity: "Static Marlowe", rank: Math.max(1, userRank - 2), xpToPass: 320, score: 19_070, ozzies: 1_380 },
    { id: "rival-neon-3", coverIdentity: "Crash Halogen", rank: Math.max(1, userRank - 1), xpToPass: 610, score: 19_360, ozzies: 1_510 },
  ];
}

function getEntryScore(entry: LeaderboardEntry): number {
  return Math.round(entry.crewXp ?? entry.seasonalRankScore ?? entry.leaderboardScore ?? entry.deckPower ?? 0);
}

function buildRivals(entries: LeaderboardEntry[], currentXp: number, userRank: number, uid?: string): RivalIntel[] {
  const fallbackRivals = buildFallbackRivals(userRank);
  if (entries.length === 0) return fallbackRivals;

  const currentIndex = uid ? entries.findIndex((entry) => entry.uid === uid) : -1;
  const rivalEntries = currentIndex > 0
    ? entries.slice(Math.max(0, currentIndex - 3), currentIndex)
    : entries.filter((entry) => entry.uid !== uid).slice(0, 3);

  const mapped = rivalEntries.map((entry) => ({
    id: entry.uid,
    coverIdentity: entry.displayName || entry.deckName || "Unknown Skater",
    rank: entries.findIndex((candidate) => candidate.uid === entry.uid) + 1,
    xpToPass: Math.max(150, getEntryScore(entry) - currentXp + 150),
    score: getEntryScore(entry),
    ozzies: entry.crewOzzies ?? entry.ozzies ?? 0,
  }));

  return [...fallbackRivals.slice(0, Math.max(0, 3 - mapped.length)), ...mapped].slice(-3);
}

export function MissionControlDashboard() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { entries, myEntry } = useLeaderboard();
  const [selectedRival, setSelectedRival] = useState<RivalIntel | null>(null);
  const [copyStatus, setCopyStatus] = useState("Copy Link");
  const [referralCredits, setReferralCredits] = useState(0);

  useEffect(() => {
    const storedCredits = Number(localStorage.getItem(REFERRAL_CREDITS_KEY));
    setReferralCredits(Number.isFinite(storedCredits) ? storedCredits : 0);
  }, []);

  const displayName = resolveUserDisplayName({
    profileDisplayName: userProfile?.displayName,
    authDisplayName: user?.displayName,
    email: user?.email,
  });
  const initials = resolveUserInitial(displayName);
  const missionXp = userProfile?.missionXp ?? 0;
  const ozzies = userProfile?.ozziesBalance ?? userProfile?.ozzies ?? 0;
  const userRank = myEntry ? entries.findIndex((entry) => entry.uid === myEntry.uid) + 1 : DEFAULT_USER_RANK;
  const rivals = useMemo(() => buildRivals(entries, missionXp, userRank, user?.uid), [entries, missionXp, userRank, user?.uid]);
  const nextRivalXp = rivals[rivals.length - 1]?.xpToPass ?? 150;
  const progressPct = Math.max(
    MIN_PROGRESS_PCT,
    Math.min(MAX_PROGRESS_PCT, Math.round((missionXp / (missionXp + nextRivalXp)) * 100) || DEFAULT_PROGRESS_PCT),
  );
  const referralLink = user?.uid
    ? `${window.location.origin}/?ref=${encodeURIComponent(user.uid)}`
    : `${window.location.origin}/?ref=SIGN-IN`;

  const handleForgeIntent = () => warmRoutes(["forge"]);
  const handleEnterForge = () => navigate("/forge");
  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus("Copy Link"), 1800);
    } catch {
      setCopyStatus("Copy Failed");
      window.setTimeout(() => setCopyStatus("Copy Link"), 1800);
    }
  };

  return (
    <div className="mission-control-dashboard">
      <section className="mission-rewards-banner" aria-label="Login rewards">
        <div>
          <p className="mission-control-eyebrow">Rewards uplink</p>
          <strong>🔥 13-day streak claimed for +90 XP and +36 Ozzies. Next login reward: +90 XP and +36 Ozzies.</strong>
        </div>
        <button type="button" className="mission-claim-button">CLAIM</button>
      </section>

      <section className="target-board" aria-labelledby="target-board-title">
        <div className="mission-section-heading">
          <p className="mission-control-eyebrow">Rivalry scanner</p>
          <h1 id="target-board-title">Next in the Crosshairs</h1>
        </div>

        <div className="target-stack">
          {rivals.map((rival, index) => (
            <button
              key={rival.id}
              type="button"
              className="rival-panel"
              style={{ "--rival-tilt": `${index % 2 === 0 ? -1.4 : 1.2}deg` } as CSSProperties}
              onClick={() => setSelectedRival(rival)}
            >
              <span className="rival-panel__avatar" aria-hidden="true">{resolveUserInitial(rival.coverIdentity)}</span>
              <span className="rival-panel__copy">
                <span className="rival-panel__name">{rival.coverIdentity}</span>
                <span className="rival-panel__meta">Global rank #{rival.rank.toLocaleString()}</span>
              </span>
              <span className="rival-panel__callout">Δ {rival.xpToPass.toLocaleString()} XP to pass</span>
            </button>
          ))}

          <article className="user-cover-identity">
            <div className="user-cover-identity__avatar" aria-hidden="true">{initials}</div>
            <div className="user-cover-identity__copy">
              <p className="mission-control-eyebrow">Current Cover Identity</p>
              <h2>{displayName}</h2>
              <div className="user-cover-identity__stats">
                <span>Global rank <strong>#{userRank.toLocaleString()}</strong></span>
                <span>Ozzies <strong>{ozzies.toLocaleString()}</strong></span>
                <span>XP <strong>{missionXp.toLocaleString()}</strong></span>
              </div>
              <div className="mission-xp-bar" aria-label={`XP pursuit progress ${progressPct}%`}>
                <span style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="forge-action-center" aria-labelledby="forge-action-title">
        <div className="forge-action-center__burst" aria-hidden="true" />
        <p className="mission-control-eyebrow">Primary objective</p>
        <h2 id="forge-action-title">Build the next street legend.</h2>
        <button
          type="button"
          className="forge-action-button"
          onMouseEnter={handleForgeIntent}
          onFocus={handleForgeIntent}
          onClick={handleEnterForge}
        >
          ENTER THE FORGE
        </button>
      </section>

      <section className="comms-intel-grid" aria-label="Comms and intel terminal">
        <article className="intel-terminal">
          <div className="intel-terminal__chrome">
            <span />
            <span />
            <span />
          </div>
          <p className="mission-control-eyebrow">Patch Notes</p>
          <pre>{`Build 20260531.2115: smoother collection navigation...
Signal: rivalry board now tracks near-pass targets.
Patch: forge route warmed for faster card creation.
Intel: neon districts report fresh Mission Control traffic.`}</pre>
        </article>

        <article className="intel-terminal referral-terminal">
          <div className="intel-terminal__chrome">
            <span />
            <span />
            <span />
          </div>
          <p className="mission-control-eyebrow">Referral Network</p>
          <label htmlFor="mission-referral-link">Encrypted invite link</label>
          <input id="mission-referral-link" value={referralLink} readOnly />
          <div className="referral-terminal__footer">
            <span>Total credits earned: <strong>{referralCredits.toLocaleString()}</strong></span>
            <button type="button" className="terminal-copy-button" onClick={handleCopyReferral}>{copyStatus}</button>
          </div>
        </article>
      </section>

      {selectedRival && (
        <div className="target-intel-overlay" role="dialog" aria-modal="true" aria-labelledby="target-intel-title">
          <div className="target-intel-modal">
            <p className="mission-control-eyebrow">Classified dossier</p>
            <h2 id="target-intel-title">TARGET INTEL: {selectedRival.coverIdentity}</h2>
            <div className="target-intel-grid">
              {CREW_CARD_TITLES.map((title, index) => (
                <article key={title} className="stolen-intel-card">
                  <span className="stolen-intel-card__rank">Intel {index + 1}/6</span>
                  <strong>{title}</strong>
                  <span>{selectedRival.coverIdentity.split(" ")[0]} Crew</span>
                </article>
              ))}
            </div>
            <button type="button" className="target-intel-close" onClick={() => setSelectedRival(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
