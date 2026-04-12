import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDecks } from "../hooks/useDecks";
import { CardThumbnail } from "../components/CardThumbnail";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { buildGlassCanopyMissionPreview, runGlassCanopyMission } from "../lib/glassCanopyMission";
import { SkateboardStatsPanel } from "../components/SkateboardStatsPanel";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import {
  DISTRICT_WEATHER_LOCATIONS,
  GLASS_CANOPY_DISTRICT,
  getDistrictAccessSummary,
  isDistrictAccessibleWithBoardType,
} from "../lib/districtWeather";

export function Mission() {
  const navigate = useNavigate();
  const { decks } = useDecks();
  const { weatherByDistrict, loading: weatherLoading, error: weatherError } = useDistrictWeather();
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [runnerCardId, setRunnerCardId] = useState<string | null>(null);
  const [missionResult, setMissionResult] = useState<ReturnType<typeof runGlassCanopyMission> | null>(null);

  useEffect(() => {
    if (!activeDeckId && decks.length > 0) {
      setActiveDeckId(decks[0].id);
    }
  }, [decks, activeDeckId]);

  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === activeDeckId) ?? null,
    [decks, activeDeckId],
  );

  useEffect(() => {
    const firstCardId = activeDeck?.cards[0]?.id ?? null;
    if (!activeDeck) {
      setRunnerCardId(null);
      setMissionResult(null);
      return;
    }

    if (!runnerCardId || !activeDeck.cards.some((card) => card.id === runnerCardId)) {
      setRunnerCardId(firstCardId);
      setMissionResult(null);
    }
  }, [activeDeck, runnerCardId]);

  const missionPreview = useMemo(
    () => buildGlassCanopyMissionPreview(activeDeck?.cards ?? [], runnerCardId ?? undefined),
    [activeDeck?.cards, runnerCardId],
  );
  const missionWeather = weatherByDistrict[GLASS_CANOPY_DISTRICT] ?? null;
  const missionLocation = DISTRICT_WEATHER_LOCATIONS[GLASS_CANOPY_DISTRICT];
  const runnerBoardType = missionPreview.runnerCard?.board?.boardType;
  const missionAccessBlocked = !isDistrictAccessibleWithBoardType(missionWeather, runnerBoardType);
  const missionWeatherSummary = missionWeather
    ? `${missionWeather.summary} over ${missionWeather.city}, ${missionWeather.state}.`
    : weatherLoading
      ? "District weather uplink is syncing."
      : weatherError
        ? "District weather uplink is offline, so Glass City is running on open access."
        : "No live weather seed is active for Glass City.";

  const handleRunMission = () => {
    if (missionAccessBlocked) return;
    setMissionResult(runGlassCanopyMission(missionPreview.playerDeck));
  };

  if (decks.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon">🎯</span>
          <p>No decks ready for field work yet.</p>
          <button className="btn-primary" onClick={() => navigate("/decks")}>
            Build a Deck First
          </button>
        </div>
      </div>
    );
  }

  if (!activeDeck || activeDeck.cards.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Mission</h1>
            <p className="page-sub">Operation: Glass Canopy is now live.</p>
          </div>
        </div>
        <div className="empty-state">
          <span className="empty-icon">🛹</span>
          <p>Select or fill a deck before launching the mission.</p>
          <button className="btn-primary" onClick={() => navigate("/decks")}>
            Open My Decks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mission</h1>
          <p className="page-sub">
            Run Operation: Glass Canopy with one deck leader and the rest of your crew as support.
          </p>
        </div>
      </div>

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
            <div className="mission-panel__header">
              <div>
                <h2>Operation: Glass Canopy</h2>
                <p className="page-sub">
                  Infiltrate the Glass City penthouse, grab the payload, and escape the Transitional Zone before the board dies.
                </p>
              </div>
              <button className="btn-primary" onClick={handleRunMission} disabled={!missionPreview.runnerCard || missionAccessBlocked}>
                ▶ Run Mission
              </button>
            </div>

            <div className="mission-checks">
              <span className="tag">P1 STEALTH 7 + Urethane wheels</span>
              <span className="tag">P3 ACC 8 (+ Heat)</span>
              <span className="tag">P4 SPD 8 (+ Heat)</span>
              <span className="tag">P4 RNG 15 (+ Heat)</span>
            </div>
            <div className={`mission-weather${missionAccessBlocked ? " mission-weather--blocked" : ""}`}>
              <div className="mission-weather__copy">
                <span className="mission-weather__eyebrow">District weather seed</span>
                <strong className="mission-weather__title">
                  {GLASS_CANOPY_DISTRICT} · {missionLocation.city}
                </strong>
                <p className="mission-weather__body">{missionWeatherSummary}</p>
              </div>
              <span className={`mission-weather__status${missionWeather?.accessRule ? " mission-weather__status--restricted" : ""}`}>
                {getDistrictAccessSummary(missionWeather)}
              </span>
            </div>
            {missionAccessBlocked && (
              <p className="mission-warning">
                {missionWeather?.accessRule?.reason} Selected runner board: {runnerBoardType ?? "none locked in"}.
              </p>
            )}
          </section>

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
                      <span className="mission-stat-label">District</span>
                      <span className="mission-stat-value">{GLASS_CANOPY_DISTRICT}</span>
                    </div>
                    <div className="mission-stat-row">
                      <span className="mission-stat-label">Weather Access</span>
                      <span className="mission-stat-value">{getDistrictAccessSummary(missionWeather)}</span>
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
    </div>
  );
}
