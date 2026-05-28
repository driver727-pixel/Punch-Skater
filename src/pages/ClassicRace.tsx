/**
 * Classic Race — stat-based race against computer or online opponents.
 *
 * Two tabs:
 *   - "My Race Hub"  — Challengers (public starting grid), incoming challenges
 *                      (accept/decline), outgoing pending challenges (cancel),
 *                      and recent finished races (replay link).
 *   - "Solo Sprint"  — race against a bot courier.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTier } from "../context/TierContext";
import { useDecks } from "../hooks/useDecks";
import { useRaceArena } from "../hooks/useRaceArena";
import { fetchRaceArena, startFreeSoloRace, startSoloRace, type ArenaListEntry } from "../services/race";
import type { RaceCardSnapshot } from "../lib/types";
import { sfxBattleReady, sfxClick } from "../lib/sfx";
import { DEFAULT_RACE_DISTRICT, RACE_DISTRICT_OPTIONS } from "../lib/raceDistricts";
import { announceActiveDistrict } from "../lib/districtTheme";

type TabKey = "hub" | "solo";

const WAGER_PRESETS = [0, 10, 50, 100];
const SOLO_WAGER_PRESETS = [0, 5, 10, 25];
const SOLO_WAGER_MAX = 25;

function statTotal(stats: RaceCardSnapshot["stats"]): number {
  return stats.speed + stats.range + stats.stealth + stats.grit;
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
      {RACE_DISTRICT_OPTIONS.map((option) => (
        <button
          key={option.slug}
          type="button"
          className={`race-district-btn${district === option.slug ? " active btn-outline--active" : ""}`}
          onClick={() => onSelect(option.slug)}
        >
          {option.emoji} {option.displayName}
        </button>
      ))}
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
  const [district, setDistrict] = useState(DEFAULT_RACE_DISTRICT);
  const defenderCard = state.opponent.cards.find((c) => c.id === defenderCardId);
  const cap = Math.max(0, Math.min(myOzzies, 10_000));

  useEffect(() => {
    announceActiveDistrict(district);
  }, [district]);

  if (!myChallengerCard) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>You need a Challenger first</h2>
          <p>Open <Link to="/collection?tab=decks">My Decks</Link>, mark a deck as Primary (🌟), and tap "🏁 Make Challenger" on the card you want to race with.</p>
          <button className="btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content race-challenge-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Issue Race Challenge</h2>
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
  const { tier } = useTier();
  const { decks } = useDecks();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") === "solo" ? "solo" : "hub") as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const arena = useRaceArena();

  const [arenaEntries, setArenaEntries] = useState<ArenaListEntry[]>([]);
  const [arenaLoading, setArenaLoading] = useState(false);
  const [arenaError, setArenaError] = useState<string | null>(null);
  const [modal, setModal] = useState<ChallengeModalState | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [soloCardId, setSoloCardId] = useState("");
  const [soloDistrict, setSoloDistrict] = useState<string>(DEFAULT_RACE_DISTRICT);
  const [soloWager, setSoloWager] = useState(0);
  const [soloLoading, setSoloLoading] = useState(false);

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

  const primaryDeckRaceCards = useMemo(() => (
    primaryDeck?.cards.map((card) => ({
      id: card.id,
      name: card.identity?.name ?? "Skater",
      archetype: card.prompts.archetype,
      rarity: card.class.rarity,
      stats: {
        speed: card.stats.speed,
        range: card.stats.range,
        rangeNm: card.stats.rangeNm,
        stealth: card.stats.stealth,
        grit: card.stats.grit,
      },
      imageUrl: card.characterImageUrl ?? card.backgroundImageUrl ?? card.frameImageUrl,
      backgroundImageUrl: card.backgroundImageUrl,
      characterImageUrl: card.characterImageUrl,
      frameImageUrl: card.frameImageUrl,
    })) ?? []
  ), [primaryDeck]);

  const myOzzies = Number(userProfile?.ozzies ?? 0);
  const soloWagerCap = Math.max(0, Math.min(myOzzies, SOLO_WAGER_MAX));
  const isSignedInFreeUser = tier === "free" && !!user;

  useEffect(() => {
    if (primaryDeckRaceCards.length === 0) {
      setSoloCardId("");
      return;
    }
    setSoloCardId((current) => {
      if (current && primaryDeckRaceCards.some((card) => card.id === current)) {
        return current;
      }
      // Prefer the designated Challenger card as the default selection.
      const challengerId = primaryDeck?.challengerCardId;
      const challenger = challengerId && primaryDeckRaceCards.find((c) => c.id === challengerId);
      return challenger ? challenger.id : primaryDeckRaceCards[0].id;
    });
  }, [primaryDeckRaceCards, primaryDeck]);

  useEffect(() => {
    if (soloWager > soloWagerCap) {
      setSoloWager(soloWagerCap);
    }
  }, [soloWager, soloWagerCap]);

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

  async function handleSoloStart() {
    if (!soloCardId) {
      setActionMessage("Pick one of your primary deck cards to start a solo race.");
      return;
    }
    setSoloLoading(true);
    setActionMessage(null);
    try {
      // Bot stats are generated server-side seeded by the player's card power level,
      // so the race stays competitive without any client-side simulation.
      const race = await startSoloRace({
        cardId: soloCardId,
        ozzyWager: Math.min(soloWager, soloWagerCap),
        district: soloDistrict,
      });
      navigate(`/race/${race.id}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to start solo race.");
    } finally {
      setSoloLoading(false);
    }
  }

  async function handleFreeSoloStart() {
    setSoloLoading(true);
    setActionMessage(null);
    try {
      const race = await startFreeSoloRace({
        district: soloDistrict,
      });
      navigate(`/race/${race.id}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to start the free solo trial.");
    } finally {
      setSoloLoading(false);
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
          ) : isSignedInFreeUser ? (
            <span>Free Rider trial unlocked. Jump into Solo Sprint with a random house Challenger from the admin vault.</span>
          ) : (
            <span>
              No Challenger set. Open <Link to="/collection?tab=decks">My Decks</Link>, mark a deck as Primary (🌟), and tap "🏁 Make Challenger" on a card.
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
        <button role="tab" aria-selected={tab === "solo"} className={`tab-btn${tab === "solo" ? " tab-btn--active" : ""}`} onClick={() => { sfxClick(); setTab("solo"); }}>
          ⚡ Solo Sprint
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
          <div className="race-hub-block">
            <h2>Challengers</h2>
            {arenaLoading && <p className="race-arena-loading">Loading starting grid…</p>}
            {arenaError && <p className="race-arena-error">{arenaError}</p>}
            {!arenaLoading && !arenaError && arenaEntries.length === 0 && (
              <p className="race-arena-empty">No other players have published a primary deck yet. Check back soon!</p>
            )}
            <div className="race-arena-opponents">
              {arenaEntries.map((entry) => {
                const challengerCard = entry.cards.find((c) => c.id === entry.challengerCardId) ?? entry.cards[0];
                return (
                  <article key={entry.uid} className="race-arena-opponent">
                    <header className="race-arena-opponent-header">
                      <span className="race-arena-opponent-name">{entry.displayName}</span>
                      <span className="race-arena-opponent-deck">{entry.deckName}</span>
                    </header>
                    <ArenaCardThumb snapshot={challengerCard} isChallenger />
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

      {tab === "solo" && (
        <section className="race-solo-panel">
          <p className="race-solo-description">
            Race against a bot courier. Low stakes — small risk, small reward.
          </p>

          {isSignedInFreeUser && (
            <div className="status-banner status-banner--ok" role="status">
              <strong>Free Rider trial:</strong> start a friendly solo sprint with a random admin-owned house card. No wager required.
            </div>
          )}

          {!isSignedInFreeUser && (
            <div className="race-challenge-row">
              <label>Pick your racer:</label>
              <div className="race-solo-card-grid">
                {primaryDeckRaceCards.map((card) => (
                  <ArenaCardThumb
                    key={card.id}
                    snapshot={card}
                    isChallenger={primaryDeck?.challengerCardId === card.id}
                    selected={soloCardId === card.id}
                    onClick={() => setSoloCardId(card.id)}
                    hideChallengeBorder
                  />
                ))}
              </div>
              {primaryDeckRaceCards.length === 0 && (
                <p className="race-arena-empty">Your primary deck has no cards available for a solo sprint yet.</p>
              )}
            </div>
          )}

          <div className="race-challenge-row">
            <label>Choose district:</label>
            <RaceDistrictPicker district={soloDistrict} onSelect={setSoloDistrict} />
          </div>

          {!isSignedInFreeUser && (
            <div className="race-challenge-row">
              <label>Wager (Ozzies) — your balance: {myOzzies}</label>
              <div className="race-wager-presets">
                {SOLO_WAGER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn-outline btn-sm${soloWager === preset ? " btn-outline--active" : ""}`}
                    disabled={preset > soloWagerCap}
                    onClick={() => setSoloWager(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={SOLO_WAGER_MAX}
                step={5}
                value={Math.min(soloWager, soloWagerCap)}
                onChange={(e) => setSoloWager(Number(e.target.value))}
                disabled={soloWagerCap === 0}
                aria-label="Solo race wager amount"
              />
              <span className="race-wager-value">Wager: <strong>{Math.min(soloWager, soloWagerCap)}</strong> Ozzies</span>
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn-primary"
              onClick={isSignedInFreeUser ? handleFreeSoloStart : handleSoloStart}
              disabled={soloLoading || (!isSignedInFreeUser && primaryDeckRaceCards.length === 0)}
            >
              {isSignedInFreeUser ? "🎁 Start Free Solo Trial" : "▶ Start Solo Race"}
            </button>
            {soloLoading && <span className="race-track-status">Starting race…</span>}
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
