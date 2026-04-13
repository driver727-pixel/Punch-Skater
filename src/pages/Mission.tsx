import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardThumbnail } from "../components/CardThumbnail";
import { GeoAtlas } from "../components/GeoAtlas";
import { SkateboardStatsPanel } from "../components/SkateboardStatsPanel";
import { useDecks } from "../hooks/useDecks";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import {
  buildMissionPreview,
  DISTRICT_MISSIONS,
  runDistrictMission,
} from "../lib/glassCanopyMission";
import type {
  ForkChoice,
  MissionForkPrompt,
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
  const { decks } = useDecks();
  const { weatherByDistrict, loading: weatherLoading, error: weatherError } = useDistrictWeather();
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<string>(DISTRICT_MISSIONS[0].id);
  const [runnerCardId, setRunnerCardId] = useState<string | null>(null);
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);
  const [pendingFork, setPendingFork] = useState<MissionForkPrompt | null>(null);
  const [forkChoices, setForkChoices] = useState<Record<string, ForkChoice>>({});

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

  useEffect(() => {
    const firstCardId = activeDeck?.cards[0]?.id ?? null;
    if (!activeDeck) {
      setRunnerCardId(null);
      setMissionResult(null);
      setPendingFork(null);
      setForkChoices({});
      return;
    }

    if (!runnerCardId || !activeDeck.cards.some((card) => card.id === runnerCardId)) {
      setRunnerCardId(firstCardId);
      setMissionResult(null);
      setPendingFork(null);
      setForkChoices({});
    }
  }, [activeDeck, runnerCardId]);

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
            setMissionResult(null);
            setPendingFork(null);
            setForkChoices({});
          },
        };
      });
    },
    [activeMission.id],
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
            setMissionResult(null);
            setPendingFork(null);
            setForkChoices({});
          },
        };
      });
    },
    [activeMission.id],
  );

  const handleRunMission = () => {
    if (!activeDeck || missionAccessBlocked || !missionPreview.runnerCard) return;
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
                setActiveMissionId(mission.id);
                setMissionResult(null);
                setPendingFork(null);
                setForkChoices({});
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
            onClick={handleRunMission}
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
          <button className="btn-primary" onClick={() => navigate("/decks")}>
            Build a Deck First
          </button>
        </div>
      ) : !activeDeck || activeDeck.cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛹</span>
          <p>Select or fill a deck before launching the mission.</p>
          <button className="btn-primary" onClick={() => navigate("/decks")}>
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
                    setActiveDeckId(deck.id);
                    setMissionResult(null);
                    setPendingFork(null);
                    setForkChoices({});
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
                      setRunnerCardId(card.id);
                      setMissionResult(null);
                      setPendingFork(null);
                      setForkChoices({});
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
                  <button className="btn-secondary" onClick={() => handleForkChoice("A")}>
                    {pendingFork.optionA.label}
                  </button>
                  <button className="btn-secondary" onClick={() => handleForkChoice("B")}>
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
              <section className="mission-panel">
                <h3>{missionResult.success ? "Mission Complete" : "Mission Failed"}</h3>
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
                  {missionResult.ozziesReward > 0 && (
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Ozzies Earned</span>
                      <span className="mission-stat-value">💰 {missionResult.ozziesReward}</span>
                    </div>
                  )}
                </div>
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
