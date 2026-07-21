/**
 * Classic Race — Top-down arcade racer (Super Off Road-style).
 *
 * Two tabs:
 *   - "My Race Hub"  — Challengers (public starting grid), incoming challenges
 *                      (accept/decline), outgoing pending challenges (cancel),
 *                      and recent finished races (replay link).
 *   - "Arcade Race"  — Launch the real-time top-down Phaser racer.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { useRaceArena } from "../hooks/useRaceArena";
import { fetchRaceArena, type ArenaListEntry } from "../services/race";
import type { RaceCardSnapshot } from "../lib/types";
import { sfxBattleReady, sfxClick } from "../lib/sfx";
import { DEFAULT_RACE_DISTRICT, getRaceDistrictDisplayName, RACE_DISTRICT_OPTIONS } from "../lib/raceDistricts";
import { getRaceTrackDefinition, getRaceTrackSvgPolygonPoints } from "../lib/raceTracks";
import { announceActiveDistrict, getDistrictTheme } from "../lib/districtTheme";
import { useModalA11y } from "../hooks/useModalA11y";

type TabKey = "hub" | "arcade";

const WAGER_PRESETS = [0, 10, 50, 100];

type RaceStats = RaceCardSnapshot["stats"];

function statTotal(stats: RaceStats): number {
  return stats.speed + stats.range + stats.stealth + stats.grit;
}

/** Flavorful odds read derived from the two racers' total stat power. */
function oddsFlavor(mine: number, theirs: number): string {
  const diff = mine - theirs;
  if (diff >= 6) return "🔥 You're the heavy favorite";
  if (diff >= 2) return "📈 Edge in your favor";
  if (diff <= -6) return "⚠️ Long shot — go for glory";
  if (diff <= -2) return "📉 Underdog run";
  return "⚖️ Dead-even matchup";
}

const MATCHUP_STAT_ROWS: { key: keyof Pick<RaceStats, "speed" | "range" | "stealth" | "grit">; label: string; emoji: string }[] = [
  { key: "speed", label: "Speed", emoji: "⚡" },
  { key: "range", label: "Range", emoji: "🛣️" },
  { key: "stealth", label: "Stealth", emoji: "🥷" },
  { key: "grit", label: "Grit", emoji: "💪" },
];

/** Head-to-head stat comparison shown before launching a race. */
function StatMatchup({
  mine,
  theirs,
  myName,
  theirName,
}: {
  mine: RaceStats;
  theirs: RaceStats;
  myName: string;
  theirName: string;
}) {
  const myPower = statTotal(mine);
  const theirPower = statTotal(theirs);
  return (
    <div className="race-matchup">
      <div className="race-matchup-head">
        <span className="race-matchup-name race-matchup-name--mine">{myName} · {myPower}</span>
        <span className="race-matchup-vs">VS</span>
        <span className="race-matchup-name race-matchup-name--theirs">{theirName} · {theirPower}</span>
      </div>
      {MATCHUP_STAT_ROWS.map(({ key, label, emoji }) => {
        const a = mine[key];
        const b = theirs[key];
        const max = Math.max(a, b, 1);
        return (
          <div key={key} className="race-matchup-row" title={label}>
            <span className="race-matchup-bar race-matchup-bar--mine">
              <span className="race-matchup-bar-fill race-matchup-bar-fill--mine" style={{ width: `${(a / max) * 100}%` }} />
              <span className="race-matchup-bar-num">{a}</span>
            </span>
            <span className="race-matchup-stat">{emoji}</span>
            <span className="race-matchup-bar race-matchup-bar--theirs">
              <span className="race-matchup-bar-fill race-matchup-bar-fill--theirs" style={{ width: `${(b / max) * 100}%` }} />
              <span className="race-matchup-bar-num">{b}</span>
            </span>
          </div>
        );
      })}
      <p className="race-matchup-odds">{oddsFlavor(myPower, theirPower)}</p>
    </div>
  );
}

function CardMiniStats({ stats }: { stats: RaceCardSnapshot["stats"] }) {
  return (
    <div className="race-card-stats">
      <span title="Speed">⚡{stats.speed}</span>
      <span title="Range">🛣️{stats.range}</span>
      <span title="Stealth">🥷{stats.stealth}</span>
      <span title="Grit">💪{stats.grit}</span>
    </div>
  );
}

function ArenaCardThumb({
  snapshot,
  isChallenger,
  selected,
  onClick,
  hideChallengeBorder,
}: {
  snapshot: RaceCardSnapshot;
  isChallenger?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** When true the challenger CSS border is suppressed (e.g. solo picker where
   *  only the selected-state border should be shown). The 🏁 flag in the card
   *  name is still rendered so the challenger can still be identified. */
  hideChallengeBorder?: boolean;
}) {
  const hasLayers = snapshot.backgroundImageUrl || snapshot.characterImageUrl || snapshot.frameImageUrl;
  return (
    <button
      type="button"
      className={`race-arena-card${selected ? " race-arena-card--selected" : ""}${isChallenger && !hideChallengeBorder ? " race-arena-card--challenger" : ""}`}
      onClick={onClick}
    >
      <div className="race-arena-card-art">
        {hasLayers ? (
          <>
            {snapshot.backgroundImageUrl && (
              <img src={snapshot.backgroundImageUrl} alt="" className="race-arena-card-art-layer" loading="lazy" />
            )}
            {snapshot.characterImageUrl && (
              <img src={snapshot.characterImageUrl} alt="" className="race-arena-card-art-layer" loading="lazy" />
            )}
            {snapshot.frameImageUrl && (
              <img src={snapshot.frameImageUrl} alt="" className="race-arena-card-art-layer race-arena-card-art-layer--frame" loading="lazy" />
            )}
          </>
        ) : snapshot.imageUrl ? (
          <img src={snapshot.imageUrl} alt="" className="race-arena-card-art-layer" loading="lazy" />
        ) : null}
      </div>
      <div className="race-arena-card-meta">
        <span className="race-arena-card-name">
          {isChallenger && <span className="race-arena-card-flag" title="Challenger">🏁</span>}
          {snapshot.name}
        </span>
        <span className="race-arena-card-sub">{snapshot.archetype} · {snapshot.rarity}</span>
        <CardMiniStats stats={snapshot.stats} />
      </div>
    </button>
  );
}

interface ChallengeModalState {
  opponent: ArenaListEntry;
  defenderCardId: string;
}

function RaceDistrictPicker({
  district,
  onSelect,
}: {
  district: string;
  onSelect: (district: string) => void;
}) {
  return (
    <div className="race-district-picker">
      {RACE_DISTRICT_OPTIONS.map((option) => {
        const theme = getDistrictTheme(option.slug);
        const track = getRaceTrackDefinition(option.slug);
        const active = district === option.slug;
        const svgPolygonPoints = getRaceTrackSvgPolygonPoints(option.slug);
        return (
          <button
            key={option.slug}
            type="button"
            className={`race-district-btn race-district-btn--track${active ? " active btn-outline--active" : ""}`}
            onClick={() => onSelect(option.slug)}
            style={{
              borderColor: active ? theme.border : undefined,
              boxShadow: active ? `0 0 12px ${theme.border}66` : undefined,
            }}
          >
            <span className="race-district-track-preview" aria-hidden="true">
              <svg viewBox="0 0 100 100" role="img">
                <defs>
                  <radialGradient id={`race-track-bg-${option.slug}`} cx="50%" cy="38%" r="72%">
                    <stop offset="0%" stopColor={theme.bg3} />
                    <stop offset="100%" stopColor={theme.bg} />
                  </radialGradient>
                </defs>
                <rect width="100" height="100" rx="12" fill={`url(#race-track-bg-${option.slug})`} />
                <polygon points={svgPolygonPoints} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" />
                <polygon points={svgPolygonPoints} fill="none" stroke={theme.accent2} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
                <polygon points={svgPolygonPoints} fill="none" stroke={theme.accent} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={track.points[0][0] * 100} cy={track.points[0][1] * 100} r="4" fill="#fff" />
              </svg>
            </span>
            <span className="race-district-btn-copy">
              <span className="race-district-btn-label">{option.emoji} {option.displayName}</span>
              <span className="race-district-track-name">{track.name}</span>
              <span className="race-district-track-terrain">{track.terrain}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChallengeModal({
  state,
  onClose,
  onSubmit,
  myChallengerCard,
  busy,
  myOzzies,
}: {
  state: ChallengeModalState;
  onClose: () => void;
  onSubmit: (defenderCardId: string, wager: number, district: string) => Promise<void>;
  myChallengerCard: { id: string; name: string; stats: RaceCardSnapshot["stats"] } | null;
  busy: boolean;
  myOzzies: number;
}) {
  const [defenderCardId, setDefenderCardId] = useState(state.defenderCardId);
  const [wager, setWager] = useState(0);
  const [district, setDistrict] = useState<string>(DEFAULT_RACE_DISTRICT);
  const defenderCard = state.opponent.cards.find((c) => c.id === defenderCardId);
  const cap = Math.max(0, Math.min(myOzzies, 10_000));
  const dialogRef = useModalA11y<HTMLDivElement>({ onClose, active: true });

  useEffect(() => {
    announceActiveDistrict(district);
  }, [district]);

  if (!myChallengerCard) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="race-challenge-need-card-title"
        >
          <h2 id="race-challenge-need-card-title">You need a Challenger first</h2>
          <p>Open <Link to="/collection?tab=decks">My Decks</Link>, mark a deck as Primary (🌟), and tap "🏁 Make Challenger" on the card you want to race with.</p>
          <button className="btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content race-challenge-modal"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="race-challenge-title"
      >
        <h2 id="race-challenge-title">Issue Race Challenge</h2>
        <p className="race-challenge-summary">
          <strong>{myChallengerCard.name}</strong> challenges{" "}
          <strong>{defenderCard?.name ?? "their card"}</strong> from {state.opponent.displayName}'s deck.
        </p>

        <div className="race-challenge-row">
          <label>Pick which of their cards to race:</label>
          <div className="race-arena-card-grid race-arena-card-grid--compact">
            {state.opponent.cards.map((card) => (
              <ArenaCardThumb
                key={card.id}
                snapshot={card}
                isChallenger={state.opponent.challengerCardId === card.id}
                selected={defenderCardId === card.id}
                onClick={() => setDefenderCardId(card.id)}
              />
            ))}
          </div>
        </div>

        {defenderCard && (
          <div className="race-challenge-row">
            <label>Head-to-head:</label>
            <StatMatchup
              mine={myChallengerCard.stats}
              theirs={defenderCard.stats}
              myName={myChallengerCard.name}
              theirName={defenderCard.name}
            />
          </div>
        )}

        <div className="race-challenge-row">
          <label>Wager (Ozzies) — your balance: {myOzzies}</label>
          <div className="race-wager-presets">
            {WAGER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`btn-outline btn-sm${wager === preset ? " btn-outline--active" : ""}`}
                disabled={preset > cap}
                onClick={() => setWager(preset)}
              >
                {preset === 0 ? "Friendly (0)" : `${preset}`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={cap}
            step={5}
            value={Math.min(wager, cap)}
            onChange={(e) => setWager(Number(e.target.value))}
            disabled={cap === 0}
            aria-label="Wager amount"
          />
          <span className="race-wager-value">Wager: <strong>{wager}</strong> Ozzies</span>
        </div>

        <div className="race-challenge-row">
          <label>Choose district:</label>
          <RaceDistrictPicker district={district} onSelect={setDistrict} />
        </div>

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { sfxBattleReady(); onSubmit(defenderCardId, wager, district); }}
            disabled={busy || wager > cap}
          >
            {busy ? "Sending…" : "Send Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClassicRace() {
  const { user, userProfile } = useAuth();
  const { decks } = useDecks();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") === "arcade" ? "arcade" : "hub") as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const arena = useRaceArena();

  const [arenaEntries, setArenaEntries] = useState<ArenaListEntry[]>([]);
  const [arenaLoading, setArenaLoading] = useState(false);
  const [arenaError, setArenaError] = useState<string | null>(null);
  const [modal, setModal] = useState<ChallengeModalState | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [soloDistrict, setSoloDistrict] = useState<string>(DEFAULT_RACE_DISTRICT);
  const [arcadeOpponents, setArcadeOpponents] = useState(3);

  // Discover the player's primary deck + Challenger card.
  const primaryDeck = useMemo(() => {
    if (decks.length === 0) return null;
    return decks.find((d) => d.isPrimary) ?? decks[0];
  }, [decks]);
  const myChallengerCard = useMemo(() => {
    if (!primaryDeck) return null;
    const challengerId = primaryDeck.challengerCardId;
    const card = challengerId
      ? primaryDeck.cards.find((c) => c.id === challengerId)
      : null;
    if (!card) return null;
    return {
      id: card.id,
      name: card.identity?.name ?? "Skater",
      stats: {
        speed: card.stats.speed,
        range: card.stats.range,
        rangeNm: card.stats.rangeNm,
        stealth: card.stats.stealth,
        grit: card.stats.grit,
      },
    };
  }, [primaryDeck]);

  const myOzzies = Number(userProfile?.ozzies ?? 0);

  useEffect(() => {
    announceActiveDistrict(soloDistrict);
  }, [soloDistrict]);

  // Sync tab → URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === "hub") next.delete("tab");
    else next.set("tab", tab);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [tab, searchParams, setSearchParams]);

  // Load the public arena grid when on the hub tab.
  useEffect(() => {
    if (tab !== "hub" || !user) return;
    let cancelled = false;
    setArenaLoading(true);
    setArenaError(null);
    fetchRaceArena()
      .then((entries) => { if (!cancelled) setArenaEntries(entries); })
      .catch((err) => { if (!cancelled) setArenaError(err instanceof Error ? err.message : "Failed to load arena."); })
      .finally(() => { if (!cancelled) setArenaLoading(false); });
    return () => { cancelled = true; };
  }, [tab, user]);

  const incomingPending = arena.incoming.filter((c) => c.status === "pending");
  const outgoingPending = arena.outgoing.filter((c) => c.status === "pending");
  const finishedRaces = useMemo(() =>
    [...arena.incoming, ...arena.outgoing]
      .filter((c) => c.status === "resolved" && c.raceId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 12)
  , [arena.incoming, arena.outgoing]);

  async function handleIssue(defenderCardId: string, wager: number, district: string) {
    if (!modal || !myChallengerCard) return;
    try {
      await arena.issue({
        challengerCardId: myChallengerCard.id,
        defenderUid: modal.opponent.uid,
        defenderCardId,
        ozzyWager: wager,
        district,
      });
      setModal(null);
      setActionMessage("Challenge sent!");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to send challenge.");
    }
  }

  async function handleAccept(challengeId: string) {
    sfxClick();
    try {
      const result = await arena.respond(challengeId, true);
      setActionMessage(result.race ? "Race accepted — opening replay!" : "Race accepted.");
      if (result.race) navigate(`/race/${result.race.id}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to accept.");
    }
  }
  async function handleDecline(challengeId: string) {
    sfxClick();
    try {
      await arena.respond(challengeId, false);
      setActionMessage("Challenge declined. Wager refunded.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to decline.");
    }
  }
  async function handleCancel(challengeId: string) {
    sfxClick();
    try {
      await arena.cancel(challengeId);
      setActionMessage("Challenge withdrawn. Wager refunded.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to cancel.");
    }
  }

  return (
    <div className="page race-arena-page">
      <header className="race-arena-header">
        <h1>🏁 Classic Race</h1>
        <div className="race-arena-self">
          {myChallengerCard ? (
            <span>Your Challenger: <strong>{myChallengerCard.name}</strong> (Power {statTotal(myChallengerCard.stats)})</span>
          ) : (
            <span>
              No Challenger set. Open <Link to="/collection?tab=decks">My Decks</Link>, mark a deck as Primary (🌟), and tap "🏁 Make Challenger" on a card. Or jump into Arcade Race!
            </span>
          )}
          <span className="race-arena-balance">💰 {myOzzies} Ozzies</span>
        </div>
      </header>

      <nav className="race-arena-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "hub"} className={`tab-btn${tab === "hub" ? " tab-btn--active" : ""}`} onClick={() => { sfxClick(); setTab("hub"); }}>
          My Race Hub
          {(incomingPending.length + outgoingPending.length) > 0 && (
            <span className="nav-badge">{incomingPending.length + outgoingPending.length}</span>
          )}
        </button>
        <button role="tab" aria-selected={tab === "arcade"} className={`tab-btn${tab === "arcade" ? " tab-btn--active" : ""}`} onClick={() => { sfxClick(); setTab("arcade"); }}>
          🏎️ Arcade Race
        </button>
      </nav>

      {actionMessage && (
        <div className="race-arena-message" role="status">
          {actionMessage}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setActionMessage(null)}>✕</button>
        </div>
      )}
      {arena.error && <div className="race-arena-message race-arena-message--error">{arena.error}</div>}

      {tab === "hub" && (
        <section className="race-hub">
          <div className="race-hub-block race-hub-block--grid">
            <h2>🏁 Starting Grid</h2>
            {arenaLoading && <p className="race-arena-loading">Loading starting grid…</p>}
            {arenaError && <p className="race-arena-error">{arenaError}</p>}
            {!arenaLoading && !arenaError && arenaEntries.length === 0 && (
              <p className="race-arena-empty">No other players have published a primary deck yet. Check back soon!</p>
            )}
            <div className="race-arena-opponents race-arena-opponents--grid">
              {arenaEntries.map((entry, index) => {
                const challengerCard = entry.cards.find((c) => c.id === entry.challengerCardId) ?? entry.cards[0];
                return (
                  <article
                    key={entry.uid}
                    className="race-arena-opponent race-arena-opponent--grid"
                    style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                  >
                    <span className="race-grid-pole" aria-hidden="true">P{index + 1}</span>
                    <header className="race-arena-opponent-header">
                      <span className="race-arena-opponent-name">{entry.displayName}</span>
                      <span className="race-arena-opponent-deck">{entry.deckName}</span>
                    </header>
                    <ArenaCardThumb snapshot={challengerCard} isChallenger />
                    <span className="race-grid-power" title="Total stat power">
                      Power {statTotal(challengerCard.stats)}
                    </span>
                    <button
                      className="btn-primary"
                      disabled={!myChallengerCard}
                      title={myChallengerCard ? undefined : "Set a Challenger card on your primary deck first."}
                      onClick={() => { sfxClick(); setModal({ opponent: entry, defenderCardId: challengerCard.id }); }}
                    >
                      Issue Challenge
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="race-hub-block">
            <h2>Incoming challenges ({incomingPending.length})</h2>
            {incomingPending.length === 0 && <p className="race-arena-empty">No incoming challenges.</p>}
            {incomingPending.map((c) => (
              <div key={c.id} className="race-hub-row">
                <div>
                  <strong>{c.challengerDisplayName}</strong> wants to race <strong>{c.challengerCardName}</strong> against your <strong>{c.defenderCardName}</strong>.
                  {c.ozzyWager > 0 && <span className="race-hub-wager"> · Wager: {c.ozzyWager} Ozzies</span>}
                  {c.district && <span className="race-hub-wager"> · District: {getRaceDistrictDisplayName(c.district) ?? c.district}</span>}
                  {c.message && <p className="race-hub-message">"{c.message}"</p>}
                </div>
                <div className="race-hub-actions">
                  <button className="btn-primary" onClick={() => handleAccept(c.id)} disabled={arena.busy}>
                    Accept{c.ozzyWager > 0 ? ` (${c.ozzyWager} Ozzies)` : ""}
                  </button>
                  <button className="btn-outline" onClick={() => handleDecline(c.id)} disabled={arena.busy}>Decline</button>
                </div>
              </div>
            ))}
          </div>

          <div className="race-hub-block">
            <h2>Pending outgoing ({outgoingPending.length})</h2>
            {outgoingPending.length === 0 && <p className="race-arena-empty">No pending outgoing challenges.</p>}
            {outgoingPending.map((c) => (
              <div key={c.id} className="race-hub-row">
                <div>
                  Awaiting reply from <strong>{c.defenderDisplayName}</strong> · {c.challengerCardName} vs {c.defenderCardName}
                  {c.ozzyWager > 0 && <span className="race-hub-wager"> · Wager: {c.ozzyWager} Ozzies</span>}
                  {c.district && <span className="race-hub-wager"> · District: {getRaceDistrictDisplayName(c.district) ?? c.district}</span>}
                </div>
                <div className="race-hub-actions">
                  <button className="btn-outline" onClick={() => handleCancel(c.id)} disabled={arena.busy}>Withdraw</button>
                </div>
              </div>
            ))}
          </div>

          <div className="race-hub-block">
            <h2>Recent races</h2>
            {finishedRaces.length === 0 && <p className="race-arena-empty">Your finished races will appear here.</p>}
            {finishedRaces.map((c) => (
              <div key={c.id} className="race-hub-row">
                <div>
                  <strong>{c.challengerCardName}</strong> vs <strong>{c.defenderCardName}</strong>
                  {c.ozzyWager > 0 && <span className="race-hub-wager"> · Wager: {c.ozzyWager} Ozzies</span>}
                  {c.district && <span className="race-hub-wager"> · District: {getRaceDistrictDisplayName(c.district) ?? c.district}</span>}
                </div>
                <div className="race-hub-actions">
                  {c.raceId && (
                    <Link to={`/race/${c.raceId}`} className="btn-primary">▶ Replay</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "arcade" && (
        <section className="race-solo-panel">
          <p className="race-solo-description">
            Top-down arcade racing! Steer your skater through the district, drift corners, draft behind rivals for slipstream speed, and grab nitro cells for extra boosts.
          </p>

          <div className="race-challenge-row">
            <label>Choose district track:</label>
            <RaceDistrictPicker district={soloDistrict} onSelect={setSoloDistrict} />
          </div>

          <div className="race-challenge-row">
            <label>Number of CPU opponents (1–5):</label>
            <div className="race-wager-presets">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn-outline btn-sm${arcadeOpponents === n ? " btn-outline--active" : ""}`}
                  onClick={() => setArcadeOpponents(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="race-challenge-row race-arcade-controls-hint">
            <span>🎮 Controls: WASD or Arrow Keys to steer • SHIFT / SPACE for Nitro • Stay in a rival&apos;s wake for slipstream</span>
          </div>

          <div className="modal-actions">
            <button
              className="btn-primary"
              onClick={() => {
                sfxBattleReady();
                const url = `/classic-race/?district=${encodeURIComponent(soloDistrict)}&opponents=${arcadeOpponents}&returnUrl=${encodeURIComponent("/arena/classic?tab=arcade")}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              🏁 Launch Race
            </button>
          </div>
        </section>
      )}

      {modal && (
        <ChallengeModal
          state={modal}
          myChallengerCard={myChallengerCard}
          busy={arena.busy}
          myOzzies={myOzzies}
          onClose={() => setModal(null)}
          onSubmit={handleIssue}
        />
      )}
    </div>
  );
}
