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
  hasDistrictAccessRestriction,
  isDistrictAccessibleWithBoardType,
} from "../lib/districtWeather";

const MISSION_MARKER_OFFSET_Y = -76;
const DISTRICT_MARKER_OFFSETS = [
  { offsetX: -42, offsetY: MISSION_MARKER_OFFSET_Y - 4 },
  { offsetX: 0, offsetY: MISSION_MARKER_OFFSET_Y - 30 },
  { offsetX: 42, offsetY: MISSION_MARKER_OFFSET_Y - 4 },
];

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
  const missionWeather = weatherByDistrict[activeMission.district] ?? null;
  const missionLocation = DISTRICT_WEATHER_LOCATIONS[activeMission.district];
  const runnerBoardType = missionPreview.runnerCard?.board?.boardType;
  const runnerWheelType = missionPreview.runnerCard?.board?.wheels;
  const hasRunner = Boolean(missionPreview.runnerCard);
  const missionAccessBlocked =
    hasRunner &&
    !isDistrictAccessibleWithBoardType(activeMission.district, missionWeather, runnerBoardType, runnerWheelType);
  const missionAccessSummary = getDistrictAccessSummary(activeMission.district, missionWeather);
  const missionAccessReason = hasRunner
    ? getDistrictAccessBlockReason(activeMission.district, missionWeather, runnerBoardType, runnerWheelType)
    : null;
  const missionAccessRestricted = hasDistrictAccessRestriction(activeMission.district, missionWeather);
  const missionWeatherSummary = missionWeather
    ? `${missionWeather.summary} over ${missionWeather.city}, ${missionWeather.state}.`
    : weatherLoading
      ? "District weather uplink is syncing."
      : weatherError
        ? "District weather uplink is offline, so this district is running on open access."
        : `No live weather seed is active for ${activeMission.district}.`;
  const missionMarkers = useMemo(
    () => {
      const districtMarkerIndex = new Map<string, number>();
      return DISTRICT_MISSIONS.map((mission) => {
        const markerIndex = districtMarkerIndex.get(mission.district) ?? 0;
        districtMarkerIndex.set(mission.district, markerIndex + 1);
        const markerOffset = DISTRICT_MARKER_OFFSETS[markerIndex] ?? {
          offsetX: markerIndex * 18,
          offsetY: MISSION_MARKER_OFFSET_Y,
        };

        return {
          id: mission.id,
          district: mission.district,
          label: mission.pinLabel,
          title: `${mission.name} · ${mission.district}`,
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
            Pick a district pushpin, choose your runner, and send one deck into the field.
          </p>
        </div>
      </div>

      <section className="mission-panel mission-panel--atlas">
        <div className="mission-panel__header">
          <div>
            <h2>District Operations Map</h2>
            <p className="page-sub">
              Three missions are now staged in every district. Tap a pushpin to swap operations.
            </p>
          </div>
        </div>
        <GeoAtlas compact className="mission-atlas" markers={missionMarkers} />
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
              <span className="mission-selector-card__district">{mission.district}</span>
              <strong className="mission-selector-card__name">{mission.name}</strong>
              <span className="mission-selector-card__tagline">{mission.tagline}</span>
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
            <span className="mission-weather__eyebrow">District weather seed</span>
            <strong className="mission-weather__title">
              {activeMission.district} · {missionLocation.city}
            </strong>
            <p className="mission-weather__body">{missionWeatherSummary}</p>
          </div>
          <span className={`mission-weather__status${missionAccessRestricted ? " mission-weather__status--restricted" : ""}`}>
            {missionAccessSummary}
          </span>
        </div>
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
                      <span className="mission-stat-label">District</span>
                      <span className="mission-stat-value">{activeMission.district}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">District Access</span>
                      <span className="mission-stat-value">{missionAccessSummary}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">SPD</span>
                      <span className="mission-stat-value">{missionPreview.stats.speed}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">ACC</span>
                      <span className="mission-stat-value">{missionPreview.stats.acceleration}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">STLTH</span>
                      <span className="mission-stat-value">{missionPreview.stats.stealth}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">RNG</span>
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
                <div className="mission-fork__options">
                  <button
                    type="button"
                    className="mission-fork__option"
                    onClick={() => handleForkChoice("A")}
                  >
                    <strong className="mission-fork__option-label">A — {pendingFork.optionA.label}</strong>
                    <span className="mission-fork__option-desc">{pendingFork.optionA.description}</span>
                  </button>
                  <button
                    type="button"
                    className="mission-fork__option"
                    onClick={() => handleForkChoice("B")}
                  >
                    <strong className="mission-fork__option-label">B — {pendingFork.optionB.label}</strong>
                    <span className="mission-fork__option-desc">{pendingFork.optionB.description}</span>
                  </button>
                </div>
              </section>
            )}

            {missionResult && (
              <section className="mission-panel">
                <div className="mission-result">
                  <span className={`mission-result__badge ${missionResult.success ? "mission-result__badge--success" : "mission-result__badge--fail"}`}>
                    {missionResult.success ? "MISSION COMPLETE" : "MISSION FAILED"}
                  </span>
                  <div className="mission-checks">
                    <span className="tag">HP {missionResult.playerStats.health}</span>
                    <span className="tag">Heat {missionResult.playerStats.heatLevel}</span>
                    <span className="tag">RNG {missionResult.playerStats.batteryRemaining}</span>
                    <span className="tag">Inventory {missionResult.inventory.length}</span>
                  </div>
                </div>
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
