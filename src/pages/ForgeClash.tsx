import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { CardThumbnail } from "../components/CardThumbnail";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { buildArenaDeckSummary, computeCardWorth } from "../lib/battle";
import {
  JOUST_TACTICS,
  getAvailableJoustTactics,
} from "../lib/joust";
import { normalizeJoustProfile } from "../lib/jousting";
import type {
  CardPayload,
  JoustCardSnapshot,
  JoustTactic,
} from "../lib/types";
import {
  fetchForgeComputerRivals,
  playForgeClashTurn,
  startForgeClash,
  type ForgeClashMatch,
  type ForgeClashRound,
  type ForgeClashTelegraph,
  type ForgeLoanerCard,
} from "../services/forge";
import {
  sfxForgeClashCounter,
  sfxForgeClashCrit,
  sfxForgeClashDraw,
  sfxForgeClashLoss,
  sfxForgeClashSlip,
  sfxForgeClashStart,
  sfxForgeClashStrike,
  sfxForgeClashWin,
} from "../lib/sfx";

type TurnStage = "choose" | "locked" | "reveal" | "impact" | "result";

interface CrewCardEntry {
  key: string;
  card: CardPayload;
  ownerUid: string;
  loaner: boolean;
}

const CREW_SIZE = 6;
const MAX_DRAFT_CARDS = 18;
const BATTERYVILLE_BACKGROUND = "/assets/backgrounds/batteryville.jpg";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function buildCrewKey(cardId: string, ownerUid: string, callerUid: string): string {
  return ownerUid === callerUid ? `owned:${cardId}` : `loaner:${ownerUid}:${cardId}`;
}

function buildClassName(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function formatTactic(tactic?: JoustTactic | null): string {
  if (!tactic) return "Choose tactic";
  return tactic === "trickStrike"
    ? "Trick Strike"
    : `${tactic.charAt(0).toUpperCase()}${tactic.slice(1)}`;
}

function getTelegraphIcon(telegraph?: ForgeClashTelegraph | null): string {
  if (telegraph?.intent === "rush") return "💥";
  if (telegraph?.intent === "brace") return "🛡️";
  return "👁️";
}

function getRecommendedTactic(telegraph?: ForgeClashTelegraph | null): JoustTactic {
  if (telegraph?.intent === "rush") return "counter";
  if (telegraph?.intent === "brace") return "feint";
  return "charge";
}

function getResultLabel(result: ForgeClashMatch["result"]): string {
  if (result === "win") return "Victory";
  if (result === "draw") return "Draw";
  return "Defeat";
}

function getRoundSwing(round?: ForgeClashRound | null): "player" | "rival" | "neutral" {
  if (round?.outcome === "win") return "player";
  if (round?.outcome === "loss") return "rival";
  return "neutral";
}

function getRoundHeadline(round: ForgeClashRound): string {
  if (round.finisher) return round.outcome === "win" ? "OVERDRIVE LANDS!" : "OVERDRIVE DENIED!";
  if (round.correctRead && round.outcome === "win") return "CLEAN READ!";
  if (round.outcome === "win") return "LINE WON!";
  if (round.outcome === "loss") return "JAX READS IT!";
  return "DEAD EVEN!";
}

function getGuidedOpening(turn: number, maxHeat: number): { step: string; title: string; body: string } | null {
  if (turn === 1) {
    return {
      step: "1/3",
      title: "Read the signal",
      body: "Jax shows a broad intent, not the exact tactic. Rush lines are vulnerable to Counter.",
    };
  }
  if (turn === 2) {
    return {
      step: "2/3",
      title: "Match the rider",
      body: "Pick a different Crew card whose Lance, Shield, traits, and available tactics answer the read.",
    };
  }
  if (turn === 3) {
    return {
      step: "3/3",
      title: "Cash in Heat",
      body: `Correct reads build Heat. At ${maxHeat}, arm Overdrive for a risky +4 Strike finisher.`,
    };
  }
  return null;
}

function getRoundBreakdown(round: ForgeClashRound): string {
  const advantage = round.breakdown.advantage > 0
    ? `Read +${round.breakdown.advantage}`
    : round.breakdown.advantage < 0
      ? `Read ${round.breakdown.advantage}`
      : "Neutral read";
  const laneRoll = round.breakdown.randomRoll >= 0
    ? `+${round.breakdown.randomRoll}`
    : String(round.breakdown.randomRoll);
  const finisher = round.finisher ? ` · Overdrive +${round.finisherBonus}` : "";
  return `${advantage} · Lance ${round.breakdown.attack} vs Shield ${round.breakdown.defense} · Lane roll ${laneRoll}${finisher} · Strike ${round.effectiveStrike}`;
}

function RivalCard({
  rival,
  telegraph,
}: {
  rival: ForgeClashMatch["rival"] | null;
  telegraph: ForgeClashTelegraph | null;
}) {
  const intent = telegraph?.intent ?? "rush";
  return (
    <div className={`forge-clash-rival-card forge-clash-rival-card--${intent} forge-clash-rival-card--standard`}>
      <div className="forge-clash-rival-card__art" aria-hidden="true">
        <span>{getTelegraphIcon(telegraph)}</span>
      </div>
      <div className="forge-clash-rival-card__body">
        <strong>{rival?.name ?? "Jax Voltage"}</strong>
        <small>{rival?.signatureTrait ?? "Boost Charge"} · Batteryville</small>
        <dl>
          <div><dt>LNC</dt><dd>{rival?.joust.lance ?? 8}</dd></div>
          <div><dt>SHD</dt><dd>{rival?.joust.shield ?? 5}</dd></div>
          <div><dt>SPD</dt><dd>{rival?.stats.speed ?? 9}</dd></div>
          <div><dt>HYPE</dt><dd>{rival?.joust.hype ?? 8}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function CardIdentityStrip({ card, snapshot }: { card: CardPayload; snapshot?: JoustCardSnapshot }) {
  const profile = snapshot?.joust ?? normalizeJoustProfile(card);
  return (
    <div className="forge-clash-card-identity">
      <span>Lance <strong>{profile.lance}</strong></span>
      <span>Shield <strong>{profile.shield}</strong></span>
      <span>Hype <strong>{profile.hype}</strong></span>
      <span>{profile.gear.lanceType} / {profile.gear.shieldType}</span>
      {profile.traits.slice(0, 2).map((trait) => <em key={trait}>{trait}</em>)}
    </div>
  );
}

export function ForgeClash() {
  const { cards } = useCollection();
  const { user } = useAuth();
  const { refreshWallet } = useWallet();
  const [loanerCards, setLoanerCards] = useState<ForgeLoanerCard[]>([]);
  const [loanersLoading, setLoanersLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [draftTouched, setDraftTouched] = useState(false);
  const [match, setMatch] = useState<ForgeClashMatch | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<JoustTactic | null>(null);
  const [finisherArmed, setFinisherArmed] = useState(false);
  const [turnStage, setTurnStage] = useState<TurnStage>("choose");
  const [latestRound, setLatestRound] = useState<ForgeClashRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setLoanerCards([]);
      setLoanersLoading(false);
      return;
    }
    setLoanersLoading(true);
    fetchForgeComputerRivals(user, CREW_SIZE)
      .then((fetched) => {
        if (active) setLoanerCards(fetched);
      })
      .catch(() => {
        if (active) setLoanerCards([]);
      })
      .finally(() => {
        if (active) setLoanersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const sortedOwnedCards = useMemo(
    () => [...cards].sort((left, right) => computeCardWorth(right) - computeCardWorth(left)),
    [cards],
  );
  const crewPool = useMemo<CrewCardEntry[]>(() => {
    const callerUid = user?.uid ?? "";
    const owned = sortedOwnedCards.map((card) => ({
      key: buildCrewKey(card.id, callerUid, callerUid),
      card,
      ownerUid: callerUid,
      loaner: false,
    }));
    const loanersNeeded = Math.max(0, CREW_SIZE - owned.length);
    const loaners = loanerCards.slice(0, loanersNeeded).map((card) => ({
      key: buildCrewKey(card.id, card.ownerUid, callerUid),
      card,
      ownerUid: card.ownerUid,
      loaner: true,
    }));
    return [...owned, ...loaners];
  }, [loanerCards, sortedOwnedCards, user?.uid]);
  const crewEntryByKey = useMemo(
    () => new Map(crewPool.map((entry) => [entry.key, entry])),
    [crewPool],
  );
  const selectedCrew = useMemo(
    () => selectedKeys
      .map((key) => crewEntryByKey.get(key))
      .filter((entry): entry is CrewCardEntry => Boolean(entry)),
    [crewEntryByKey, selectedKeys],
  );

  useEffect(() => {
    if (match || draftTouched || crewPool.length === 0) return;
    setSelectedKeys(crewPool.slice(0, CREW_SIZE).map((entry) => entry.key));
  }, [crewPool, draftTouched, match]);

  const deckSummary = useMemo(
    () => buildArenaDeckSummary(selectedCrew.map((entry) => entry.card)),
    [selectedCrew],
  );
  const selectedSlot = useMemo(
    () => match?.roster.find((slot) => slot.slotId === selectedSlotId) ?? null,
    [match?.roster, selectedSlotId],
  );
  const activeEntry = useMemo(() => {
    const slotId = latestRound?.slotId ?? selectedSlotId;
    return slotId ? crewEntryByKey.get(slotId) ?? null : null;
  }, [crewEntryByKey, latestRound?.slotId, selectedSlotId]);
  const availableTactics = useMemo(
    () => selectedSlot ? getAvailableJoustTactics(selectedSlot.snapshot) : [],
    [selectedSlot],
  );
  const guidedOpening = match?.status === "playing"
    ? getGuidedOpening(match.turn, match.maxHeat)
    : null;
  const canStart = Boolean(
    user
    && selectedCrew.length === CREW_SIZE
    && selectedKeys.length === CREW_SIZE
    && !busy,
  );
  const canUseFinisher = Boolean(match && match.heat >= match.maxHeat);
  const roundSwing = getRoundSwing(latestRound);
  const stageClassName = buildClassName(
    "forge-clash-stage",
    `forge-clash-stage--intent-${match?.telegraph?.intent ?? "rush"}`,
    turnStage === "reveal" && "is-revealing",
    turnStage === "impact" && "is-impacting",
    latestRound && (turnStage === "impact" || turnStage === "result") && `forge-clash-stage--${roundSwing}`,
    latestRound && (turnStage === "impact" || turnStage === "result") && `forge-clash-stage--player-${latestRound.playerTactic === "counter" ? "counter" : "strike"}`,
    latestRound && (turnStage === "impact" || turnStage === "result") && `forge-clash-stage--rival-${latestRound.rivalTactic === "guard" || latestRound.rivalTactic === "counter" ? "block" : "strike"}`,
    match?.status === "completed" && match.result ? `forge-clash-stage--${match.result}` : undefined,
  );

  const refillCrew = useCallback(() => {
    setDraftTouched(false);
    setSelectedKeys(crewPool.slice(0, CREW_SIZE).map((entry) => entry.key));
  }, [crewPool]);

  const toggleCard = (key: string) => {
    if (match) return;
    setDraftTouched(true);
    setSelectedKeys((current) => {
      if (current.includes(key)) return current.filter((entry) => entry !== key);
      if (current.length >= CREW_SIZE) return current;
      return [...current, key];
    });
  };

  const beginMatch = useCallback(async (rematchOf?: string | null) => {
    if (!user || selectedCrew.length !== CREW_SIZE || busy) return;
    setBusy(true);
    setError(null);
    setLatestRound(null);
    setSelectedSlotId(null);
    setSelectedTactic(null);
    setFinisherArmed(false);
    setTurnStage("locked");
    try {
      const started = await startForgeClash(user, {
        roster: selectedCrew.map((entry) => ({
          cardId: entry.card.id,
          ownerUid: entry.ownerUid,
        })),
        rematchOf,
      });
      if (!mountedRef.current) return;
      setMatch(started);
      setSelectedKeys(started.roster.map((slot) => slot.slotId));
      setTurnStage("choose");
      sfxForgeClashStart();
    } catch (startError) {
      if (!mountedRef.current) return;
      setError(startError instanceof Error ? startError.message : "Couldn't start Forge Clash.");
      setTurnStage("choose");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, selectedCrew, user]);

  const playRoundSound = (round: ForgeClashRound) => {
    if (round.finisher) sfxForgeClashCrit();
    if (round.outcome === "loss") {
      sfxForgeClashSlip();
    } else if (round.playerTactic === "counter") {
      sfxForgeClashCounter();
    } else {
      sfxForgeClashStrike();
    }
  };

  const lockInTurn = async () => {
    if (
      !user
      || !match
      || match.status !== "playing"
      || !selectedSlotId
      || !selectedTactic
      || busy
    ) return;
    setBusy(true);
    setError(null);
    setTurnStage("locked");
    try {
      const nextMatch = await playForgeClashTurn(user, {
        matchId: match.id,
        slotId: selectedSlotId,
        tactic: selectedTactic,
        turn: match.turn,
        finisher: finisherArmed,
      });
      const round = nextMatch.latestRound ?? nextMatch.rounds.at(-1) ?? null;
      if (!mountedRef.current || !round) return;
      setLatestRound(round);
      setTurnStage("reveal");
      await wait(430);
      if (!mountedRef.current) return;
      setTurnStage("impact");
      playRoundSound(round);
      await wait(480);
      if (!mountedRef.current) return;
      setMatch(nextMatch);
      setTurnStage("result");
      if (nextMatch.status === "completed") {
        if (nextMatch.result === "win") sfxForgeClashWin();
        else if (nextMatch.result === "loss") sfxForgeClashLoss();
        else sfxForgeClashDraw();
        void refreshWallet();
      }
    } catch (playError) {
      if (!mountedRef.current) return;
      setError(playError instanceof Error ? playError.message : "That clash turn failed.");
      setTurnStage("choose");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const advanceToNextRead = () => {
    setLatestRound(null);
    setSelectedSlotId(null);
    setSelectedTactic(null);
    setFinisherArmed(false);
    setTurnStage("choose");
  };

  const rebuildCrew = () => {
    setMatch(null);
    setLatestRound(null);
    setSelectedSlotId(null);
    setSelectedTactic(null);
    setFinisherArmed(false);
    setTurnStage("choose");
    setError(null);
    setDraftTouched(false);
  };

  const turnPrompt = !match
    ? selectedCrew.length === CREW_SIZE
      ? "Crew locked — start the clash."
      : `Draft six cards — ${CREW_SIZE - selectedCrew.length} slot${CREW_SIZE - selectedCrew.length === 1 ? "" : "s"} open.`
    : match.status === "completed"
      ? "Clash complete — collect the payout or run it back."
      : turnStage === "choose"
        ? selectedSlotId
          ? selectedTactic
            ? "Tactic ready — lock it in."
            : "Card ready — choose a tactic."
          : "Read Jax, then choose a ready Crew card."
        : turnStage === "locked"
          ? "Choices locked…"
          : turnStage === "reveal"
            ? "Tactics revealed…"
            : turnStage === "impact"
              ? "Impact!"
              : "Read the result.";

  return (
    <div className="page forge-clash-page">
      <header className="forge-clash-hero">
        <p className="app-status-eyebrow">Core Game · Tactical Crew Duel</p>
        <h1>Forge Clash</h1>
        <p>
          Read Jax Voltage, choose a rider and tactic, then turn clean reads into Combo and Heat.
          Six rounds. One Overdrive. Every forged card brings its own lance, shield, gear, and traits.
        </p>
        <div className="forge-clash-hero__actions">
          <Link to="/forge" className="btn-primary">Forge a Card</Link>
          <Link to="/collection" className="btn-outline">Manage Collection</Link>
        </div>
      </header>

      {crewPool.length < CREW_SIZE && !loanersLoading ? (
        <section className="forge-clash-empty">
          <h2>Crew uplink incomplete</h2>
          <p>
            Forge a card or ask an admin to ready official loaners. Forge Clash needs six unique riders.
          </p>
          <Link to="/forge" className="btn-primary">Open Card Forge</Link>
        </section>
      ) : (
        <div className="forge-clash-layout">
          <section className="forge-clash-board" aria-live="polite">
            <div className="forge-clash-scorebar">
              <div className="forge-clash-health">
                <span>Your Crew</span>
                <strong>{match?.playerHp ?? 60}/{match?.maxHp ?? 60}</strong>
                <div
                  className="forge-clash-meter"
                  role="progressbar"
                  aria-label="Your crew health"
                  aria-valuemin={0}
                  aria-valuemax={match?.maxHp ?? 60}
                  aria-valuenow={match?.playerHp ?? 60}
                >
                  <span style={{ width: `${((match?.playerHp ?? 60) / (match?.maxHp ?? 60)) * 100}%` }} />
                </div>
              </div>
              <div className="forge-clash-turn">
                <span>Round {match?.turn ?? 1}/{match?.maxRounds ?? 6}</span>
                <strong>{match?.status === "completed" ? getResultLabel(match.result) : match?.telegraph?.label ?? "Draft"}</strong>
              </div>
              <div className="forge-clash-health forge-clash-health--rival">
                <span>Jax Voltage</span>
                <strong>{match?.rivalHp ?? 60}/{match?.maxHp ?? 60}</strong>
                <div
                  className="forge-clash-meter"
                  role="progressbar"
                  aria-label="Rival health"
                  aria-valuemin={0}
                  aria-valuemax={match?.maxHp ?? 60}
                  aria-valuenow={match?.rivalHp ?? 60}
                >
                  <span style={{ width: `${((match?.rivalHp ?? 60) / (match?.maxHp ?? 60)) * 100}%` }} />
                </div>
              </div>
            </div>

            {guidedOpening && turnStage === "choose" && (
              <div className="forge-clash-coach">
                <span>Guided opening {guidedOpening.step}</span>
                <strong>{guidedOpening.title}</strong>
                <p>{guidedOpening.body}</p>
              </div>
            )}

            {latestRound && (
              <div className={`forge-clash-last-result forge-clash-last-result--${roundSwing}`} role="status">
                <span>Round {latestRound.turn} · {formatTactic(latestRound.playerTactic)} vs {formatTactic(latestRound.rivalTactic)}</span>
                <strong>{getRoundHeadline(latestRound)} {latestRound.cardName} vs Jax Voltage</strong>
                <p>{latestRound.narration}</p>
                <small>{getRoundBreakdown(latestRound)}</small>
              </div>
            )}

            <div
              className={stageClassName}
              style={{ "--forge-clash-arena-bg": `url("${BATTERYVILLE_BACKGROUND}")` } as React.CSSProperties}
              key={`${match?.id ?? "draft"}:${latestRound?.turn ?? 0}:${turnStage}`}
            >
              <div className="forge-clash-stage__grid" aria-hidden="true" />
              <div className="forge-clash-stage__sparks" aria-hidden="true"><i /><i /><i /></div>
              <div className="forge-clash-stage__smoke" aria-hidden="true"><i /><i /><i /></div>
              <div className="forge-clash-stage__lightning" aria-hidden="true"><i /><i /></div>
              <div className="forge-clash-stage__fire" aria-hidden="true"><i /><i /><i /></div>
              <div className="forge-clash-card-trail" aria-hidden="true"><i /><i /><i /></div>
              {match?.status === "completed" && (
                <div className="forge-clash-stage__finish-burst" aria-hidden="true"><i /><i /><i /><i /></div>
              )}
              <div className="forge-clash-action-banner forge-clash-action-banner--player" aria-hidden="true">
                {formatTactic(latestRound?.playerTactic)}
              </div>
              <div className="forge-clash-action-banner forge-clash-action-banner--rival" aria-hidden="true">
                {formatTactic(latestRound?.rivalTactic)}
              </div>
              <div className="forge-clash-stage__status" aria-hidden="true">
                {match?.status === "completed"
                  ? getResultLabel(match.result)
                  : turnStage === "choose"
                    ? "READ THE LINE"
                    : turnStage.toUpperCase()}
              </div>

              <div className={buildClassName(
                "forge-clash-combatant",
                "forge-clash-combatant--player",
                turnStage === "impact" && latestRound?.outcome !== "loss" && "is-striking",
                match?.status === "completed" && match.result === "win" && "is-winning",
                match?.status === "completed" && match.result === "loss" && "is-losing",
              )}>
                <div className="forge-clash-card-showcase" aria-hidden="true">
                  {(activeEntry ? [activeEntry] : selectedCrew.slice(0, 3)).map((entry, index) => (
                    <div key={entry.key} className={`forge-clash-3d-card forge-clash-3d-card--${index + 1}`}>
                      <CardThumbnail card={entry.card} width={150} height={210} />
                    </div>
                  ))}
                </div>
                <strong>{activeEntry?.card.identity.name ?? "Your Crew"}</strong>
                <small>{selectedTactic ? formatTactic(selectedTactic) : "Choose the line"}</small>
              </div>

              <div className="forge-clash-impact">
                <span className="forge-clash-impact__ring" aria-hidden="true" />
                <span className="forge-clash-impact__shield" aria-hidden="true" />
                {activeEntry && latestRound && (
                  <div className="forge-clash-impact-card" aria-hidden="true">
                    <CardThumbnail card={activeEntry.card} width={112} height={158} />
                  </div>
                )}
                {turnStage === "impact" && latestRound && (
                  <>
                    {latestRound.rivalDamage > 0 && <b className="forge-clash-damage forge-clash-damage--rival">-{latestRound.rivalDamage}</b>}
                    {latestRound.playerDamage > 0 && <b className="forge-clash-damage forge-clash-damage--player">-{latestRound.playerDamage}</b>}
                  </>
                )}
                <span>COMBO x{match?.combo ?? 0}</span>
                <strong>HEAT {match?.heat ?? 0}/{match?.maxHeat ?? 100}</strong>
                <em>{latestRound ? getRoundHeadline(latestRound) : "Build the read"}</em>
              </div>

              <div className={buildClassName(
                "forge-clash-combatant",
                "forge-clash-combatant--rival",
                turnStage === "impact" && latestRound?.outcome === "win" && "is-recoiling",
                turnStage === "impact" && latestRound?.outcome === "loss" && "is-striking",
                match?.status === "completed" && match.result === "loss" && "is-winning",
                match?.status === "completed" && match.result === "win" && "is-losing",
              )}>
                <div className="forge-clash-rival-showcase" aria-hidden="true">
                  <RivalCard rival={match?.rival ?? null} telegraph={match?.telegraph ?? null} />
                </div>
                <strong>{match?.rival.name ?? "Jax Voltage"}</strong>
                <small>{match?.telegraph?.hint ?? "Boost Charge specialist"}</small>
              </div>
            </div>

            {match && (
              <div className="forge-clash-opponent-row" aria-label="Rival tactic queue">
                <span>Jax pattern · only the next read is visible</span>
                <div className="forge-clash-rival-queue">
                  {Array.from({ length: match.maxRounds }, (_, index) => {
                    const resolved = index < match.rounds.length;
                    const current = match.status === "playing" && index === match.turn - 1;
                    return (
                      <div
                        key={`${match.id}:queue:${index}`}
                        className={buildClassName(
                          "forge-clash-rival-queue__card",
                          resolved && "is-resolved",
                          current && "is-current",
                        )}
                      >
                        <span>{resolved ? "✓" : current ? getTelegraphIcon(match.telegraph) : "?"}</span>
                        <small>{resolved ? formatTactic(match.rounds[index].rivalTactic) : current ? match.telegraph?.label : "Hidden"}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="forge-clash-turn-prompt" role="status">{turnPrompt}</p>

            <div className={buildClassName(
              "forge-clash-hand",
              match?.status === "playing" && turnStage === "choose" && "is-actionable",
            )} aria-label="Your selected card hand">
              {selectedCrew.map((entry) => {
                const slot = match?.roster.find((candidate) => candidate.slotId === entry.key);
                const readyTurn = match?.cooldowns[entry.key] ?? 0;
                const coolingDown = Boolean(match && readyTurn > match.turn);
                const profile = slot?.snapshot.joust ?? normalizeJoustProfile(entry.card);
                return (
                  <button
                    key={entry.key}
                    type="button"
                    className={buildClassName(
                      "forge-clash-card",
                      selectedSlotId === entry.key && "is-active",
                      coolingDown && "is-cooling-down",
                      entry.loaner && "is-loaner",
                    )}
                    onClick={() => {
                      if (!match || match.status !== "playing" || turnStage !== "choose" || coolingDown) return;
                      setSelectedSlotId(entry.key);
                      setSelectedTactic(null);
                      setFinisherArmed(false);
                    }}
                    disabled={!match || match.status !== "playing" || turnStage !== "choose" || coolingDown}
                  >
                    {entry.loaner && <b className="forge-clash-loaner-badge">Loaner</b>}
                    <CardThumbnail card={entry.card} width={138} height={194} />
                    <span>{entry.card.identity.name}</span>
                    <small>
                      {coolingDown ? "Cooling down" : `L${profile.lance} · S${profile.shield} · H${profile.hype}`}
                    </small>
                  </button>
                );
              })}
            </div>

            {match?.status === "playing" && turnStage === "choose" && (
              <section className="forge-clash-command">
                <div className="forge-clash-command__header">
                  <div>
                    <span className="app-status-eyebrow">Tactic lock-in</span>
                    <h2>{selectedSlot?.name ?? "Choose a Crew card"}</h2>
                    <p>
                      Jax telegraphs <strong>{match.telegraph?.label}</strong>. Scout call:
                      try <strong>{formatTactic(getRecommendedTactic(match.telegraph))}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={buildClassName("forge-clash-overdrive", finisherArmed && "is-armed")}
                    disabled={!canUseFinisher || !selectedSlot}
                    aria-pressed={finisherArmed}
                    onClick={() => setFinisherArmed((armed) => !armed)}
                  >
                    <span>OVERDRIVE</span>
                    <strong>{canUseFinisher ? "+4 Strike" : `${match.heat}/${match.maxHeat} Heat`}</strong>
                  </button>
                </div>
                <div className="forge-clash-tactics" role="group" aria-label="Choose a Forge Clash tactic">
                  {JOUST_TACTICS.map((tactic) => {
                    const available = availableTactics.includes(tactic.id);
                    return (
                      <button
                        key={tactic.id}
                        type="button"
                        className={buildClassName(
                          "forge-clash-tactic",
                          selectedTactic === tactic.id && "is-selected",
                          getRecommendedTactic(match.telegraph) === tactic.id && "is-scouted",
                        )}
                        disabled={!selectedSlot || !available}
                        aria-pressed={selectedTactic === tactic.id}
                        onClick={() => setSelectedTactic(tactic.id)}
                      >
                        <strong>{tactic.label}</strong>
                        <span>{tactic.flavor}</span>
                        <small>{available ? `Beats ${tactic.beats.map(formatTactic).join(" / ") || "raw stats"}` : "Stat locked"}</small>
                      </button>
                    );
                  })}
                </div>
                {selectedSlot && activeEntry && (
                  <CardIdentityStrip card={activeEntry.card} snapshot={selectedSlot.snapshot} />
                )}
                <button
                  type="button"
                  className="btn-primary forge-clash-lock-button"
                  disabled={!selectedSlotId || !selectedTactic || busy}
                  onClick={() => void lockInTurn()}
                >
                  {busy ? "Resolving…" : `Lock In ${formatTactic(selectedTactic)}${finisherArmed ? " + Overdrive" : ""}`}
                </button>
              </section>
            )}

            {turnStage === "result" && match?.status === "playing" && (
              <div className="forge-clash-controls is-actionable">
                <button type="button" className="btn-primary" onClick={advanceToNextRead}>
                  Next Read · Round {match.turn}
                </button>
              </div>
            )}

            {match?.status === "completed" && (
              <section className={`forge-clash-rewards forge-clash-rewards--${match.result}`}>
                <span className="app-status-eyebrow">Clash payout secured</span>
                <h2>{getResultLabel(match.result)} against Jax Voltage</h2>
                <p>
                  {match.result === "win"
                    ? match.rival.dialogue.win
                    : match.result === "loss"
                      ? match.rival.dialogue.loss
                      : match.rival.dialogue.draw}
                </p>
                {match.rewards && (
                  <div className="forge-clash-reward-grid">
                    <span><strong>+{match.rewards.xp}</strong> XP</span>
                    <span><strong>+{match.rewards.ozzies}</strong> Ozzies</span>
                    <span><strong>+{match.rewards.districtReputation}</strong> District Rep</span>
                    <span><strong>{match.rewards.mvpCardName ?? "Crew"}</strong> MVP</span>
                    {match.rewards.frameId && <span><strong>Breaker Crown</strong> Frame unlocked</span>}
                    {match.rewards.newCodexIds.length > 0 && <span><strong>Jax dossier</strong> Codex unlocked</span>}
                  </div>
                )}
                <div className="forge-clash-controls is-actionable">
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => void beginMatch(match.id)}>
                    {busy ? "Reconnecting…" : "Rematch Jax"}
                  </button>
                  <button type="button" className="btn-outline" onClick={rebuildCrew}>Rebuild Crew</button>
                </div>
              </section>
            )}

            {!match && (
              <div className={buildClassName("forge-clash-controls", canStart && "is-actionable")}>
                <button type="button" className="btn-primary" onClick={() => void beginMatch()} disabled={!canStart}>
                  {busy ? "Opening Batteryville…" : "Start Clash"}
                </button>
                <button type="button" className="btn-outline" onClick={refillCrew} disabled={busy}>
                  Auto-fill Best Crew
                </button>
                <div className="forge-clash-summary">
                  <span>Power {deckSummary.deckPower}</span>
                  <span>{deckSummary.archetypeHint}</span>
                  <span>Best {deckSummary.strongestStat}: {deckSummary.strongestStatTotal}</span>
                </div>
              </div>
            )}

            {error && <p className="forge-clash-error" role="alert">{error}</p>}
          </section>

          <aside className="forge-clash-side">
            {!match && (
              <section className={buildClassName("forge-clash-panel", selectedCrew.length < CREW_SIZE && "is-actionable")}>
                <div className="forge-clash-panel__heading">
                  <div>
                    <h2>Build the Crew</h2>
                    <p>{selectedCrew.length}/{CREW_SIZE} selected.</p>
                  </div>
                  {selectedCrew.some((entry) => entry.loaner) && <span className="forge-clash-loaner-note">Official loaners filled the gaps</span>}
                </div>
                <div className="forge-clash-draft-grid">
                  {crewPool.slice(0, MAX_DRAFT_CARDS).map((entry) => {
                    const selected = selectedKeys.includes(entry.key);
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        className={buildClassName(
                          "forge-clash-draft-card",
                          selected && "is-selected",
                          entry.loaner && "is-loaner",
                        )}
                        onClick={() => toggleCard(entry.key)}
                        disabled={!selected && selectedKeys.length >= CREW_SIZE}
                        aria-pressed={selected}
                      >
                        {entry.loaner && <b className="forge-clash-loaner-badge">Loaner</b>}
                        <CardThumbnail card={entry.card} width={110} height={154} />
                        <span>{entry.card.identity.name}</span>
                        <CardIdentityStrip card={entry.card} />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="forge-clash-panel forge-clash-rival-dossier">
              <span className="app-status-eyebrow">Batteryville rival</span>
              <h2>Jax Voltage</h2>
              <p>{match?.rival.tagline ?? "Reckless boost-charge rider out of the breaker yards."}</p>
              <blockquote>
                {match?.rival.dialogue.intro ?? "“Send it, mate. Last one breathing wins.”"}
              </blockquote>
              <ul>
                <li><strong>Signature:</strong> Boost Charge</li>
                <li><strong>Boss rule:</strong> Boosting into Jax loses 2 attack</li>
                <li><strong>Pattern:</strong> Opens Boost, then scrambles the remaining lines</li>
              </ul>
            </section>

            <section className="forge-clash-panel">
              <h2>Clash feed</h2>
              {!match || match.rounds.length === 0 ? (
                <p>Lock a rider and tactic to start the live feed.</p>
              ) : (
                <ol className="forge-clash-log">
                  {[...match.rounds].reverse().map((round) => (
                    <li
                      key={`${match.id}:${round.turn}`}
                      className={`forge-clash-log__item forge-clash-log__item--${getRoundSwing(round)}`}
                    >
                      <strong>R{round.turn}: {formatTactic(round.playerTactic)} / {formatTactic(round.rivalTactic)}</strong>
                      <span>{round.narration}</span>
                      <small>{getRoundBreakdown(round)}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
