/**
 * Race Arena (formerly Battle Arena).
 *
 * Two tabs:
 *   - "Challengers"  — public starting grid of other players' primary-deck
 *                      Challenger cards. Click → "Issue challenge" modal.
 *   - "My Race Hub"  — incoming challenges (accept/decline), outgoing pending
 *                      challenges (cancel), and recent finished races (replay link).
 *
 * Replaces the deck-vs-deck battle UI; the underlying race resolution lives
 * server-side in `/api/race/*` and is animated on the dedicated race page.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { useRaceArena } from "../hooks/useRaceArena";
import { fetchRaceArena, type ArenaListEntry } from "../services/race";
import type { RaceCardSnapshot } from "../lib/types";
import { sfxBattleReady, sfxClick } from "../lib/sfx";

type TabKey = "challengers" | "hub";

const WAGER_PRESETS = [0, 10, 50, 100];

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
}: {
  snapshot: RaceCardSnapshot;
  isChallenger?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`race-arena-card${selected ? " race-arena-card--selected" : ""}${isChallenger ? " race-arena-card--challenger" : ""}`}
      onClick={onClick}
    >
      {snapshot.imageUrl && (
        <img src={snapshot.imageUrl} alt="" className="race-arena-card-art" loading="lazy" />
      )}
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
  onSubmit: (defenderCardId: string, wager: number) => Promise<void>;
  myChallengerCard: { id: string; name: string; stats: RaceCardSnapshot["stats"] } | null;
  busy: boolean;
  myOzzies: number;
}) {
  const [defenderCardId, setDefenderCardId] = useState(state.defenderCardId);
  const [wager, setWager] = useState(0);
  const defenderCard = state.opponent.cards.find((c) => c.id === defenderCardId);
  const cap = Math.max(0, Math.min(myOzzies, 10_000));

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

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { sfxBattleReady(); onSubmit(defenderCardId, wager); }}
            disabled={busy || wager > cap}
          >
            {busy ? "Sending…" : "Send Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BattleArena() {
  const { user, userProfile } = useAuth();
  const { decks } = useDecks();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") === "hub" ? "hub" : "challengers") as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const arena = useRaceArena();

  const [arenaEntries, setArenaEntries] = useState<ArenaListEntry[]>([]);
  const [arenaLoading, setArenaLoading] = useState(false);
  const [arenaError, setArenaError] = useState<string | null>(null);
  const [modal, setModal] = useState<ChallengeModalState | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  // Sync tab → URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === "hub") next.set("tab", "hub"); else next.delete("tab");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [tab, searchParams, setSearchParams]);

  // Load the public arena grid when entering Challengers tab.
  useEffect(() => {
    if (tab !== "challengers" || !user) return;
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

  async function handleIssue(defenderCardId: string, wager: number) {
    if (!modal || !myChallengerCard) return;
    try {
      await arena.issue({
        challengerCardId: myChallengerCard.id,
        defenderUid: modal.opponent.uid,
        defenderCardId,
        ozzyWager: wager,
      });
      setModal(null);
      setActionMessage("Challenge sent!");
      setTab("hub");
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
        <h1>🏁 Race Arena</h1>
        <p className="race-arena-subtitle">
          Pick an opponent's card, set a wager, and watch your Challenger race them on the courier circuit.
        </p>
        <div className="race-arena-self">
          {myChallengerCard ? (
            <span>Your Challenger: <strong>{myChallengerCard.name}</strong> (Power {statTotal(myChallengerCard.stats)})</span>
          ) : (
            <span>
              No Challenger set. Open <Link to="/collection?tab=decks">My Decks</Link>, mark a deck as Primary (🌟), and tap "🏁 Make Challenger" on a card.
            </span>
          )}
          <span className="race-arena-balance">💰 {myOzzies} Ozzies</span>
        </div>
      </header>

      <nav className="race-arena-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "challengers"} className={`tab-btn${tab === "challengers" ? " tab-btn--active" : ""}`} onClick={() => { sfxClick(); setTab("challengers"); }}>
          Challengers
        </button>
        <button role="tab" aria-selected={tab === "hub"} className={`tab-btn${tab === "hub" ? " tab-btn--active" : ""}`} onClick={() => { sfxClick(); setTab("hub"); }}>
          My Race Hub
          {(incomingPending.length + outgoingPending.length) > 0 && (
            <span className="nav-badge">{incomingPending.length + outgoingPending.length}</span>
          )}
        </button>
      </nav>

      {actionMessage && (
        <div className="race-arena-message" role="status">
          {actionMessage}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setActionMessage(null)}>✕</button>
        </div>
      )}
      {arena.error && <div className="race-arena-message race-arena-message--error">{arena.error}</div>}

      {tab === "challengers" && (
        <section>
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
        </section>
      )}

      {tab === "hub" && (
        <section className="race-hub">
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
