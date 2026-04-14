import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardThumbnail } from "../components/CardThumbnail";
import { GeoAtlas } from "../components/GeoAtlas";
import { SkateboardStatsPanel } from "../components/SkateboardStatsPanel";
import { useDecks } from "../hooks/useDecks";
import { useCollection } from "../hooks/useCollection";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import {
  applyMissionPartsReward,
  buildMissionPreview,
  DISTRICT_MISSIONS,
  previewMissionPartsReward,
  runDistrictMission,
} from "../lib/glassCanopyMission";
import type {
  ForkChoice,
  MissionForkPrompt,
  MissionPartsUpgradeReward,
  MissionResult,
} from "../lib/glassCanopyMission";
import {
  DISTRICT_WEATHER_LOCATIONS,
  getDistrictAccessBlockReason,
  getDistrictAccessSummary,
  isDistrictAccessibleWithBoardType,
  type DistrictWeatherSnapshot,
} from "../lib/districtWeather";
import {
  getCorridorAccessBlockReason,
  getCorridorAccessSummary,
  getCorridorCondition,
  isCorridorAccessible,
} from "../lib/roadCorridors";
import { MISSION_STAT_LABELS } from "../lib/statLabels";
import type { District, RoadCorridor } from "../lib/types";
import { spawnCelebrationBurst } from "../lib/celebration";
import { sfxError, sfxRewardShower, sfxSuccess, sfxSuccessPing, sfxClick, sfxNavigate } from "../lib/sfx";

const MISSION_MARKER_OFFSET_Y = -76;
const DISTRICT_MARKER_OFFSETS = [
  { offsetX: -42, offsetY: MISSION_MARKER_OFFSET_Y - 4 },
  { offsetX: 0, offsetY: MISSION_MARKER_OFFSET_Y - 30 },
  { offsetX: 42, offsetY: MISSION_MARKER_OFFSET_Y - 4 },
];
const CORRIDOR_MARKER_OFFSETS = [
  { offsetX: -40, offsetY: -22 },
  { offsetX: 0, offsetY: -48 },
  { offsetX: 40, offsetY: -22 },
];

function resolveMissionLocation(district: District) {
  return DISTRICT_WEATHER_LOCATIONS[district] ?? {
    city: district,
    state: "N/A",
    latitude: 0,
    longitude: 0,
  };
}

function resolveMissionAccessReason(params: {
  hasRunner: boolean;
  launchBlocked: boolean;
  destinationBlocked: boolean;
  corridorBlocked: boolean;
  originDistrict: District;
  destinationDistrict: District;
  originWeather: DistrictWeatherSnapshot | null;
  destinationWeather: DistrictWeatherSnapshot | null;
  runnerBoardType: string | undefined;
  runnerWheelType: string | undefined;
  corridor?: RoadCorridor;
}) {
  if (!params.hasRunner) return null;
  if (params.launchBlocked) {
    return getDistrictAccessBlockReason(
      params.originDistrict,
      params.originWeather,
      params.runnerBoardType,
      params.runnerWheelType,
    );
  }
  if (params.destinationBlocked) {
    return getDistrictAccessBlockReason(
      params.destinationDistrict,
      params.destinationWeather,
      params.runnerBoardType,
      params.runnerWheelType,
    );
  }
  if (params.corridorBlocked && params.corridor) {
    return getCorridorAccessBlockReason(params.corridor, params.runnerWheelType);
  }
  return null;
}

export function Mission() {
  const navigate = useNavigate();
  const { cards, updateCard } = useCollection();
  const { decks, updateCardInDecks } = useDecks();
  const { weatherByDistrict, loading: weatherLoading, error: weatherError } = useDistrictWeather();
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<string>(DISTRICT_MISSIONS[0].id);
  const [runnerCardId, setRunnerCardId] = useState<string | null>(null);
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);
  const [pendingFork, setPendingFork] = useState<MissionForkPrompt | null>(null);
  const [forkChoices, setForkChoices] = useState<Record<string, ForkChoice>>({});
  const [claimedPartsRewardId, setClaimedPartsRewardId] = useState<string | null>(null);
  const missionResultRef = useRef<HTMLElement | null>(null);
  const missionHasRewardsToDisplay = Boolean(
    missionResult?.success && (missionResult.ozziesReward > 0 || missionResult.partsReward),
  );

  useEffect(() => {
    if (!activeDeckId && decks.length > 0) {
      setActiveDeckId(decks[0].id);
    }
  }, [decks, activeDeckId]);

  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === activeDeckId) ?? null,
    [decks, activeDeckId],
  );
  const activeMission = useMemo(
    () => DISTRICT_MISSIONS.find((mission) => mission.id === activeMissionId) ?? DISTRICT_MISSIONS[0],
    [activeMissionId],
  );

  const resetMissionSession = useCallback(() => {
    setMissionResult(null);
    setPendingFork(null);
    setForkChoices({});
    setClaimedPartsRewardId(null);
  }, []);

  useEffect(() => {
    const firstCardId = activeDeck?.cards[0]?.id ?? null;
    if (!activeDeck) {
      setRunnerCardId(null);
      resetMissionSession();
      return;
    }

    if (!runnerCardId || !activeDeck.cards.some((card) => card.id === runnerCardId)) {
      setRunnerCardId(firstCardId);
      resetMissionSession();
    }
  }, [activeDeck, runnerCardId, resetMissionSession]);

  const missionPreview = useMemo(
    () => buildMissionPreview(activeDeck?.cards ?? [], runnerCardId ?? undefined),
    [activeDeck?.cards, runnerCardId],
  );
  const originWeather = weatherByDistrict[activeMission.originDistrict] ?? null;
  const destinationWeather = weatherByDistrict[activeMission.destinationDistrict] ?? null;
  const originLocation = resolveMissionLocation(activeMission.originDistrict);
  const destinationLocation = resolveMissionLocation(activeMission.destinationDistrict);
  const corridorCondition = activeMission.corridor
    ? getCorridorCondition(activeMission.corridor, weatherByDistrict)
    : null;
  const runnerBoardType = missionPreview.runnerCard?.board?.boardType;
  const runnerWheelType = missionPreview.runnerCard?.board?.wheels;
  const hasRunner = Boolean(missionPreview.runnerCard);
  const partsRewardPreview = useMemo(
    () => previewMissionPartsReward(activeMission.id, missionPreview.playerDeck),
    [activeMission.id, missionPreview.playerDeck],
  );

  const launchAccessBlocked =
    hasRunner &&
    !isDistrictAccessibleWithBoardType(activeMission.originDistrict, originWeather, runnerBoardType, runnerWheelType);
  const destinationAccessBlocked =
    hasRunner &&
    !isDistrictAccessibleWithBoardType(activeMission.destinationDistrict, destinationWeather, runnerBoardType, runnerWheelType);
  const corridorAccessBlocked =
    hasRunner &&
    Boolean(activeMission.corridor) &&
    !isCorridorAccessible(activeMission.corridor, runnerWheelType);
  const missionAccessBlocked = launchAccessBlocked || destinationAccessBlocked || corridorAccessBlocked;

  const missionAccessReason = resolveMissionAccessReason({
    hasRunner,
    launchBlocked: launchAccessBlocked,
    destinationBlocked: destinationAccessBlocked,
    corridorBlocked: corridorAccessBlocked,
    originDistrict: activeMission.originDistrict,
    destinationDistrict: activeMission.destinationDistrict,
    originWeather,
    destinationWeather,
    runnerBoardType,
    runnerWheelType,
    corridor: activeMission.corridor,
  });

  const originAccessSummary = getDistrictAccessSummary(activeMission.originDistrict, originWeather);
  const destinationAccessSummary = getDistrictAccessSummary(activeMission.destinationDistrict, destinationWeather);
  const originWeatherSummary = originWeather
    ? `${originWeather.summary} over ${originWeather.city}, ${originWeather.state}.`
    : weatherLoading
      ? "District weather uplink is syncing."
      : weatherError
        ? "District weather uplink is offline, so this district is running on open access."
        : `No live weather seed is active for ${activeMission.originDistrict}.`;

  const missionMarkers = useMemo(
    () => {
      const districtMarkerIndex = new Map<string, number>();
      return DISTRICT_MISSIONS.filter((mission) => !mission.corridor).map((mission) => {
        const markerIndex = districtMarkerIndex.get(mission.originDistrict) ?? 0;
        districtMarkerIndex.set(mission.originDistrict, markerIndex + 1);
        const markerOffset = DISTRICT_MARKER_OFFSETS[markerIndex] ?? {
          offsetX: markerIndex * 18,
          offsetY: MISSION_MARKER_OFFSET_Y,
        };

        return {
          id: mission.id,
          district: mission.originDistrict,
          label: mission.pinLabel,
          title: `${mission.name} · ${mission.originDistrict}`,
          active: mission.id === activeMission.id,
          offsetX: markerOffset.offsetX,
          offsetY: markerOffset.offsetY,
          onClick: () => {
            setActiveMissionId(mission.id);
            resetMissionSession();
          },
        };
      });
    },
    [activeMission.id, resetMissionSession],
  );

  const missionCorridors = useMemo(
    () => {
      const corridorMarkerIndex = new Map<string, number>();
      return DISTRICT_MISSIONS.filter((mission) => mission.corridor).map((mission) => {
        const corridor = mission.corridor!;
        const markerIndex = corridorMarkerIndex.get(corridor) ?? 0;
        corridorMarkerIndex.set(corridor, markerIndex + 1);
        const markerOffset = CORRIDOR_MARKER_OFFSETS[markerIndex] ?? {
          offsetX: markerIndex * 18,
          offsetY: -22,
        };

        return {
          id: mission.id,
          corridor,
          label: mission.pinLabel,
          title: `${mission.name} · ${corridor}`,
          active: mission.id === activeMission.id,
          offsetX: markerOffset.offsetX,
          offsetY: markerOffset.offsetY,
          onClick: () => {
            setActiveMissionId(mission.id);
            resetMissionSession();
          },
        };
      });
    },
    [activeMission.id, resetMissionSession],
  );

  const handleRunMission = () => {
    if (!activeDeck || missionAccessBlocked || !missionPreview.runnerCard) return;
    setClaimedPartsRewardId(null);
    setForkChoices({});
    setPendingFork(null);
    const outcome = runDistrictMission(activeMission.id, missionPreview.playerDeck, {});
    if (outcome.kind === "fork") {
      setPendingFork(outcome);
      setMissionResult(null);
    } else {
      setMissionResult(outcome.result);
      setPendingFork(null);
    }
  };

  const handleForkChoice = (choice: ForkChoice) => {
    if (!activeDeck || !pendingFork) return;
    const nextChoices = { ...forkChoices, [pendingFork.forkStepId]: choice };
    setForkChoices(nextChoices);
    setPendingFork(null);
    const outcome = runDistrictMission(activeMission.id, missionPreview.playerDeck, nextChoices);
    if (outcome.kind === "fork") {
      setPendingFork(outcome);
      setMissionResult(null);
    } else {
      setMissionResult(outcome.result);
      setPendingFork(null);
    }
  };

  const handleApplyPartsReward = (reward: MissionPartsUpgradeReward) => {
    const sourceCard = cards.find((card) => card.id === missionPreview.runnerCard?.id);
    if (!sourceCard) return;
    const upgradedCard = applyMissionPartsReward(sourceCard, reward);
    updateCard(upgradedCard);
    updateCardInDecks(upgradedCard);
    setClaimedPartsRewardId(reward.id);
  };

  useEffect(() => {
    if (!missionResult) return;

    const burstTimers: number[] = [];

    if (!missionResult.success) {
      sfxError();
      return;
    }

    sfxSuccess();
    const pingTimer = window.setTimeout(() => {
      sfxSuccessPing();
      if (missionHasRewardsToDisplay) {
        sfxRewardShower();
      }
    }, 120);

    if (missionResultRef.current) {
      spawnCelebrationBurst(missionResultRef.current, { particles: 82, spreadX: 420, spreadY: 320 });
      burstTimers.push(
        window.setTimeout(() => {
          if (missionResultRef.current) {
            spawnCelebrationBurst(missionResultRef.current, { particles: 50, spreadX: 280, spreadY: 220 });
          }
        }, 240),
        window.setTimeout(() => {
        if (missionResultRef.current) {
            spawnCelebrationBurst(missionResultRef.current, { particles: 40, spreadX: 240, spreadY: 180 });
          }
        }, 520),
      );
    }

    return () => {
      window.clearTimeout(pingTimer);
      burstTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [missionHasRewardsToDisplay, missionResult]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Missions</h1>
          <p className="page-sub">
            Pick a district hub or corridor line, choose your runner, and send one deck into the field.
          </p>
        </div>
      </div>

      <section className="mission-panel mission-panel--atlas">
        <div className="mission-panel__header">
          <div>
            <h2>District &amp; Corridor Operations Map</h2>
            <p className="page-sub">
              Missions now stage from district hubs and travel lines instead of treating The Roads like a district.
            </p>
          </div>
        </div>
        <GeoAtlas compact className="mission-atlas" markers={missionMarkers} corridors={missionCorridors} />
        <div className="mission-selector-grid">
          {DISTRICT_MISSIONS.map((mission) => (
            <button
              key={mission.id}
              type="button"
              className={`mission-selector-card${mission.id === activeMission.id ? " mission-selector-card--active" : ""}`}
              onClick={() => {
                sfxClick();
                setActiveMissionId(mission.id);
                resetMissionSession();
              }}
            >
              <span className="mission-selector-card__district">
                {mission.originDistrict}
                {mission.destinationDistrict !== mission.originDistrict ? ` → ${mission.destinationDistrict}` : ""}
              </span>
              <strong className="mission-selector-card__name">{mission.name}</strong>
              <span className="mission-selector-card__tagline">{mission.tagline}</span>
              {mission.corridor && (
                <span className="mission-selector-card__reward">🛣️ {mission.corridor}</span>
              )}
              {mission.ozziesReward != null && mission.ozziesReward > 0 && (
                <span className="mission-selector-card__reward">💰 {mission.ozziesReward} Ozzies</span>
              )}
              {mission.partsReward && (
                <span className="mission-selector-card__reward">🧩 {mission.partsReward.label}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="mission-panel">
        <div className="mission-panel__header">
          <div>
            <h2>{activeMission.name}</h2>
            <p className="page-sub">{activeMission.briefing}</p>
          </div>
          <button
            className="btn-primary"
            onClick={() => { sfxClick(); handleRunMission(); }}
            disabled={!activeDeck || !hasRunner || missionAccessBlocked}
          >
            ▶ Run Mission
          </button>
        </div>

        <div className="mission-checks">
          {activeMission.checkTags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        {activeMission.partsReward && (
          <div className="mission-weather">
            <div className="mission-weather__copy">
              <span className="mission-weather__eyebrow">Parts payout</span>
              <strong className="mission-weather__title">{activeMission.partsReward.label}</strong>
              <p className="mission-weather__body">
                {partsRewardPreview
                  ? `${partsRewardPreview.componentLabel}: ${partsRewardPreview.rewardLabel}. ${partsRewardPreview.reason}`
                  : "This mission adapts its skateboard component payout to the selected runner's saved board."}
              </p>
            </div>
            <span className="mission-weather__status">
              {partsRewardPreview ? `${partsRewardPreview.currentLabel} → ${partsRewardPreview.rewardLabel}` : "Adaptive reward"}
            </span>
          </div>
        )}
        <div className={`mission-weather${missionAccessBlocked ? " mission-weather--blocked" : ""}`}>
          <div className="mission-weather__copy">
            <span className="mission-weather__eyebrow">Launch district seed</span>
            <strong className="mission-weather__title">
              {activeMission.originDistrict} · {originLocation.city}
            </strong>
            <p className="mission-weather__body">{originWeatherSummary}</p>
          </div>
          <span className={`mission-weather__status${launchAccessBlocked ? " mission-weather__status--restricted" : ""}`}>
            {originAccessSummary}
          </span>
        </div>
        {corridorCondition && (
          <div className={`mission-weather${corridorAccessBlocked ? " mission-weather--blocked" : ""}`}>
            <div className="mission-weather__copy">
              <span className="mission-weather__eyebrow">Corridor profile</span>
              <strong className="mission-weather__title">
                {corridorCondition.label} · {corridorCondition.from} ↔ {corridorCondition.to}
              </strong>
              <p className="mission-weather__body">{corridorCondition.status}</p>
            </div>
            <span className={`mission-weather__status${corridorAccessBlocked ? " mission-weather__status--restricted" : ""}`}>
              {corridorCondition.accessSummary}
            </span>
          </div>
        )}
        {!activeDeck && (
          <p className="mission-warning">Build a deck first to send a runner into this district.</p>
        )}
        {activeDeck && missionAccessBlocked && (
          <p className="mission-warning">
            {missionAccessReason} Selected runner setup: {runnerBoardType ?? "no board"} / {runnerWheelType ?? "no wheels"}.
          </p>
        )}
      </section>

      {decks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🎯</span>
          <p>No decks ready for field work yet.</p>
          <button className="btn-primary" onClick={() => { sfxNavigate(); navigate("/decks"); }}>
            Build a Deck First
          </button>
        </div>
      ) : !activeDeck || activeDeck.cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛹</span>
          <p>Select or fill a deck before launching the mission.</p>
          <button className="btn-primary" onClick={() => { sfxNavigate(); navigate("/decks"); }}>
            Open My Decks
          </button>
        </div>
      ) : (
        <div className="deck-layout">
          <div className="deck-sidebar">
            <div className="deck-list">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className={`deck-item ${activeDeckId === deck.id ? "deck-item--active" : ""}`}
                  onClick={() => {
                    sfxClick();
                    setActiveDeckId(deck.id);
                    resetMissionSession();
                  }}
                >
                  <span className="deck-name">{deck.name}</span>
                  <span className="deck-count">{deck.cards.length}/6</span>
                </div>
              ))}
            </div>
          </div>

          <div className="deck-main">
            <section className="mission-panel">
              <h3>Choose Your Runner</h3>
              <div className="mission-runner-grid">
                {activeDeck.cards.map((card) => (
                  <button
                    key={card.id}
                    className={`mission-runner-card${runnerCardId === card.id ? " mission-runner-card--active" : ""}`}
                    onClick={() => {
                      sfxClick();
                      setRunnerCardId(card.id);
                      resetMissionSession();
                    }}
                  >
                    <CardThumbnail card={card} width={120} height={84} />
                    <span className="card-name">{card.identity.name}</span>
                    <span className="card-sub">{getDisplayedArchetype(card)}</span>
                  </button>
                ))}
              </div>
            </section>

            {missionPreview.runnerCard && (
              <section className="mission-grid">
                <div className="mission-panel">
                  <h3>Mission Build</h3>
                  <div className="mission-stats">
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Lead Runner</span>
                      <span className="mission-stat-value">{missionPreview.runnerCard.identity.name}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Deck Support</span>
                      <span className="mission-stat-value">{activeDeck.cards.length} couriers</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Operation</span>
                      <span className="mission-stat-value">{activeMission.name}</span>
                    </div>
                    {partsRewardPreview && (
                      <div className="mission-stat-row">
                        <span className="mission-stat-label">Reward Preview</span>
                        <span className="mission-stat-value">{partsRewardPreview.rewardLabel}</span>
                      </div>
                    )}
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Origin</span>
                      <span className="mission-stat-value">{activeMission.originDistrict}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Destination</span>
                      <span className="mission-stat-value">
                        {activeMission.destinationDistrict} · {destinationLocation.city}
                      </span>
                    </div>
                    {activeMission.corridor && (
                      <div className="mission-stat-row">
                        <span className="mission-stat-label">Corridor</span>
                        <span className="mission-stat-value">{activeMission.corridor}</span>
                      </div>
                    )}
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Launch Access</span>
                      <span className="mission-stat-value">{originAccessSummary}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Destination Access</span>
                      <span className="mission-stat-value">{destinationAccessSummary}</span>
                    </div>
                    {activeMission.corridor && (
                      <div className="mission-stat-row">
                        <span className="mission-stat-label">Corridor Access</span>
                        <span className="mission-stat-value">{getCorridorAccessSummary(activeMission.corridor)}</span>
                      </div>
                    )}
                    <div className="mission-stat-row">
                      <span className="mission-stat-label" title={MISSION_STAT_LABELS.speed.tooltip}>{MISSION_STAT_LABELS.speed.label}</span>
                      <span className="mission-stat-value">{missionPreview.stats.speed}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label" title={MISSION_STAT_LABELS.acceleration.tooltip}>{MISSION_STAT_LABELS.acceleration.label}</span>
                      <span className="mission-stat-value">{missionPreview.stats.acceleration}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label" title={MISSION_STAT_LABELS.stealth.tooltip}>{MISSION_STAT_LABELS.stealth.label}</span>
                      <span className="mission-stat-value">{missionPreview.stats.stealth}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label" title={MISSION_STAT_LABELS.batteryRemaining.tooltip}>{MISSION_STAT_LABELS.batteryRemaining.label}</span>
                      <span className="mission-stat-value">{missionPreview.stats.batteryRemaining}</span>
                    </div>
                  </div>
                </div>

                <div className="mission-panel">
                  <h3>Runner Board</h3>
                  {missionPreview.runnerLoadout ? (
                    <SkateboardStatsPanel loadout={missionPreview.runnerLoadout} />
                  ) : (
                    <p className="page-sub">This runner has no saved board loadout, so the mission is using deck support only.</p>
                  )}
                </div>
              </section>
            )}

            {pendingFork && (
              <section className="mission-panel mission-fork">
                <div className="mission-fork__header">
                  <span className="mission-fork__badge">FORK IN THE ROAD</span>
                  <p className="mission-fork__prompt">{pendingFork.prompt}</p>
                </div>
                {pendingFork.logSoFar.length > 0 && (
                  <ol className="mission-log mission-log--partial">
                    {pendingFork.logSoFar.map((entry, index) => (
                      <li key={`${index}-${entry}`}>{entry}</li>
                    ))}
                  </ol>
                )}
                <div className="mission-fork__choices">
                  <button className="btn-secondary" onClick={() => { sfxClick(); handleForkChoice("A"); }}>
                    {pendingFork.optionA.label}
                  </button>
                  <button className="btn-secondary" onClick={() => { sfxClick(); handleForkChoice("B"); }}>
                    {pendingFork.optionB.label}
                  </button>
                </div>
                <div className="mission-fork__summaries">
                  <p>{pendingFork.optionA.description}</p>
                  <p>{pendingFork.optionB.description}</p>
                </div>
              </section>
            )}

            {missionResult && (
              <section
                ref={missionResultRef}
                className={`mission-panel mission-result-panel${missionResult.success ? " mission-result-panel--success" : " mission-result-panel--fail"}`}
              >
                {missionResult.success && (
                  <div className="mission-result-panel__beams" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <div className="mission-result">
                  <span className={`mission-result__badge ${missionResult.success ? "mission-result__badge--success" : "mission-result__badge--fail"}`}>
                    {missionResult.success ? "MISSION CLEARED" : "MISSION FAILED"}
                  </span>
                  <div className="mission-result__hero">
                    <div>
                      <h3>{missionResult.success ? "Mission Complete" : "Mission Failed"}</h3>
                      <p className="page-sub">
                        {missionResult.success
                          ? missionHasRewardsToDisplay
                            ? "Runner touched down with fresh loot and a whole lot of swagger."
                            : "Runner made it back clean."
                          : "The route fought back harder than your crew could handle."}
                      </p>
                    </div>
                    {missionResult.success && missionHasRewardsToDisplay && (
                      <span className="mission-result__headline">JACKPOT</span>
                    )}
                  </div>
                  {missionResult.success && missionHasRewardsToDisplay && (
                    <div className="mission-result__rewards">
                      {missionResult.ozziesReward > 0 && (
                        <div className="mission-result__reward-card mission-result__reward-card--ozzies">
                          <span className="mission-result__reward-label">Ozzies haul</span>
                          <strong className="mission-result__reward-value">💰 {missionResult.ozziesReward}</strong>
                        </div>
                      )}
                      {missionResult.partsReward && (
                        <div className="mission-result__reward-card mission-result__reward-card--parts">
                          <span className="mission-result__reward-label">Parts upgrade</span>
                          <strong className="mission-result__reward-value">🧩 {missionResult.partsReward.rewardLabel}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mission-stats">
                  <div className="mission-stat-row">
                    <span className="mission-stat-label">Outcome</span>
                    <span className="mission-stat-value">{missionResult.success ? "Success" : "Failure"}</span>
                  </div>
                  <div className="mission-stat-row">
                    <span className="mission-stat-label">Health</span>
                    <span className="mission-stat-value">{missionResult.playerStats.health}</span>
                  </div>
                  <div className="mission-stat-row">
                    <span className="mission-stat-label">Heat</span>
                    <span className="mission-stat-value">{missionResult.playerStats.heatLevel}</span>
                  </div>
                  <div className="mission-stat-row">
                    <span className="mission-stat-label">Battery Left</span>
                    <span className="mission-stat-value">{missionResult.playerStats.batteryRemaining}</span>
                  </div>
                  {missionResult.partsReward && (
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Parts Upgrade</span>
                      <span className="mission-stat-value">🧩 {missionResult.partsReward.rewardLabel}</span>
                    </div>
                  )}
                  {missionResult.ozziesReward > 0 && (
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Ozzies Earned</span>
                      <span className="mission-stat-value">💰 {missionResult.ozziesReward}</span>
                    </div>
                  )}
                </div>
                {missionResult.partsReward && (
                  <div className="mission-panel" style={{ marginTop: "1rem" }}>
                    <h4>{missionResult.partsReward.label}</h4>
                    <p className="page-sub">
                      {missionResult.partsReward.componentLabel}: {missionResult.partsReward.currentLabel} → {missionResult.partsReward.rewardLabel}
                    </p>
                    <p className="page-sub">{missionResult.partsReward.reason}</p>
                    <button
                      className="btn-secondary"
                      onClick={() => { sfxClick(); handleApplyPartsReward(missionResult.partsReward); }}
                      disabled={!missionResult.success || claimedPartsRewardId === missionResult.partsReward.id}
                    >
                      {claimedPartsRewardId === missionResult.partsReward.id ? "Installed on Runner" : "Apply Upgrade to Runner"}
                    </button>
                  </div>
                )}
                {missionResult.inventory.length > 0 && (
                  <div className="mission-reward-list">
                    {missionResult.inventory.map((item) => (
                      <span key={item.id} className="tag">
                        {item.name}
                      </span>
                    ))}
                  </div>
                )}
                <ol className="mission-log">
                  {missionResult.missionLog.map((entry, index) => (
                    <li key={`${index}-${entry}`}>{entry}</li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
