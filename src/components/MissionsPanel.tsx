import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { MissionTransitScene } from "./MissionTransitScene";
import { useAuth } from "../context/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import type { DistrictWeatherSnapshot } from "../lib/districtWeather";
import { isEnabled } from "../lib/featureFlags";
import { DISTRICT_LORE } from "../lib/lore";
import { formatDurationClock, getNextDailyReward, getRemainingDurationMs } from "../lib/dailyRewards";
import { DistrictBadge } from "./DistrictBadge";
import {
  evaluateMissionDeck,
  getMissionEffectiveRequirements,
  getMissionEffectiveRewards,
  getMissionForkOption,
  getMissionRequirementBadge,
  getMissionStateLabel,
  getMissionWeatherSummary,
} from "../lib/missions";
import type {
  MissionBoardEntry,
  MissionBoardTheme,
  MissionBoardProgression,
  MissionRequirement,
  MissionRequirementResult,
  MissionRunResponse,
} from "../lib/sharedTypes";
import type { District, WorldLocation } from "../lib/types";
import { getMissionBoard, runMission } from "../services/missions";

interface MissionsPanelProps {
  uid: string;
}

interface MissionPresentation {
  operation: string;
  patron: string;
  stakes: string;
  rewardFocus: string[];
  sceneTags: string[];
  successLabel: string;
  failureLabel: string;
  locale?: WorldLocation;
  localeSummary?: string;
}

const DISTRICT_THEMES: Record<District, { accent: string; accentSoft: string; glow: string; glyph: string }> = {
  Airaway: {
    accent: "#7de7ff",
    accentSoft: "rgba(125,231,255,0.2)",
    glow: "rgba(125,231,255,0.24)",
    glyph: "⬡",
  },
  Batteryville: {
    accent: "#ffc94d",
    accentSoft: "rgba(255,201,77,0.18)",
    glow: "rgba(255,201,77,0.24)",
    glyph: "⚙",
  },
  "The Grid": {
    accent: "#7dffb6",
    accentSoft: "rgba(125,255,182,0.18)",
    glow: "rgba(125,255,182,0.24)",
    glyph: "▦",
  },
  Nightshade: {
    accent: "#d490ff",
    accentSoft: "rgba(212,144,255,0.18)",
    glow: "rgba(212,144,255,0.24)",
    glyph: "✦",
  },
  "The Forest": {
    accent: "#8cff8a",
    accentSoft: "rgba(140,255,138,0.18)",
    glow: "rgba(140,255,138,0.24)",
    glyph: "❋",
  },
  "Glass City": {
    accent: "#ffd98f",
    accentSoft: "rgba(255,217,143,0.18)",
    glow: "rgba(255,217,143,0.24)",
    glyph: "◈",
  },
};

const DEFAULT_PRESENTATION: MissionPresentation = {
  operation: "Underground contract",
  patron: "Courier network relay",
  stakes: "Pick a route, balance risk against reward, and build a crew that can survive the district pressure.",
  rewardFocus: ["Cash routes for grinders", "XP routes for builders", "Split routes for balanced crews"],
  sceneTags: ["District intel", "Crew pressure", "Hard choices"],
  successLabel: "Route locked",
  failureLabel: "Route snapped",
  localeSummary: "A neighborhood-scale courier grid where the route can bend hard before the run goes live.",
};

const MISSION_PRESENTATIONS: Record<string, MissionPresentation> = {
  "batteryville-breaker-yard": {
    operation: "Batteryville relay",
    patron: "HexChain recycler crews",
    stakes: "Keep freight moving through the breaker yards before the crusher lane turns the relay into scrap.",
    rewardFocus: ["Heavy Ozzy payout path", "Local-heavy XP path", "Best for grit stacks"],
    sceneTags: ["Scrapyard sirens", "Union pressure", "Axle-breaking lanes"],
    successLabel: "Relay held",
    failureLabel: "Freight dropped",
    localeSummary: "A made-up breaker-yard neighborhood map with crusher lanes, relay sidings, and a hot fork near the depot.",
  },
  "nightshade-tunnel-run": {
    operation: "Nightshade ghost line",
    patron: "Tunnel crews in the Murk",
    stakes: "Move a silent drop through contested tunnel chains without drawing the deeper Nightshade gangs.",
    rewardFocus: ["Stealth-first Ozzies", "Local support XP", "Best for shadow decks"],
    sceneTags: ["Neon fog", "Witnessless lanes", "Crew shadows"],
    successLabel: "Tunnel cleared",
    failureLabel: "Shadows closed",
    locale: "The Roads",
    localeSummary: "A tunnel-mouth slice of The Roads where service tubes split into quiet dark-lane branches.",
  },
  "airaway-sky-lane": {
    operation: "Airaway checkpoint breach",
    patron: "Contractors running the sky-lane",
    stakes: "Slip past glass checkpoints before the towers close the lane and strip your pass.",
    rewardFocus: ["Fast-cash sprint", "Scanner-spoof XP", "Best for clean wheel decks"],
    sceneTags: ["Checkpoint glass", "Corp scanners", "Rooftop heat"],
    successLabel: "Lane crossed",
    failureLabel: "Pass burned",
    localeSummary: "A tight Airaway service quarter where the local sky-lane peels into checkpoint and maintenance forks.",
  },
  "grid-trace": {
    operation: "Cascade trace break",
    patron: "Static Pack intermediaries",
    stakes: "Stay ahead of Cascade's cameras long enough to pull a trace and escape the logging net.",
    rewardFocus: ["Technarchy cash route", "Blackout XP route", "Best for speed stacks"],
    sceneTags: ["Sensor glare", "Trace logs", "Blackout windows"],
    successLabel: "Trace broken",
    failureLabel: "Trace caught",
    localeSummary: "A district-neighborhood circuit under The Grid where every branch glows like a monitored trace line.",
  },
  "forest-rootline": {
    operation: "Root bridge extraction",
    patron: "Wooder couriers",
    stakes: "Drag a live package out of wet timber lanes before the bridges give way under the crew.",
    rewardFocus: ["Guide-backed Ozzies", "Mudline XP", "Best for rough-route wheels"],
    sceneTags: ["Wet timber", "Guide ropes", "Mud pressure"],
    successLabel: "Package lifted",
    failureLabel: "Trail swallowed",
    locale: "The Roads",
    localeSummary: "A storm-bitten roadside pocket map where The Roads split into timber bridges and rescue cut-throughs.",
  },
  "glass-city-exchange": {
    operation: "Open territory exchange",
    patron: "Glass brokers and cutouts",
    stakes: "Finish the handoff before a rival broker turns the open route into a public ambush.",
    rewardFocus: ["Safer XP handshake", "Long-range cash cutout", "Best for balanced range crews"],
    sceneTags: ["Mirror alleys", "Broker tells", "Rival eyes"],
    successLabel: "Exchange landed",
    failureLabel: "Broker burned",
    localeSummary: "A broker-block neighborhood in Glass City with mirrored alleys and a public fork under surveillance.",
  },
  "batteryville-switchyard-uprising": {
    operation: "Strike-pay convoy",
    patron: "Batteryville recycler unions",
    stakes: "Smuggle strike pay and proof drives past HexChain eyes while the switchyard crews stage an uprising.",
    rewardFocus: ["Worker-backed XP", "Boss-bribe Ozzies", "Balanced proof-vault split"],
    sceneTags: ["Switch levers", "Strike drums", "Proof drives"],
    successLabel: "Strike fund delivered",
    failureLabel: "Yard locked down",
    localeSummary: "A switchyard pocket map where every branch line doubles as an uprising route or a boss choke point.",
  },
  "nightshade-moonrise-echo": {
    operation: "Moonriser signal run",
    patron: "Moonriser rave network",
    stakes: "Carry a rave broadcast through the Murk before the Dark Lanes seize the booth that made Skids famous.",
    rewardFocus: ["High-rep XP rush", "Stealth cash hush route", "Split route for hybrid decks"],
    sceneTags: ["Rave strobes", "Basement echo", "Crew handshakes"],
    successLabel: "Signal carried",
    failureLabel: "Broadcast cut",
    locale: "The Roads",
    localeSummary: "A rave corridor slice of The Roads where the signal can spill into loud, quiet, or hybrid side loops.",
  },
  "airaway-coldchain-pass": {
    operation: "Coldchain badge breach",
    patron: "Black-clinic contractors",
    stakes: "Lift a sealed med-crate through Airaway before the cloned contractor badge burns out in the cold air.",
    rewardFocus: ["Scanner-safe XP", "Executive-drop Ozzies", "Split route for utility decks"],
    sceneTags: ["Cold cargo", "Badge clones", "Maintenance chutes"],
    successLabel: "Crate floated through",
    failureLabel: "Badge expired",
    locale: "The Roads",
    localeSummary: "A refrigerated neighborhood map off The Roads where cloned-badge lanes branch into coldchain vault access.",
  },
  "grid-parent-trace": {
    operation: "Vanished worker trace",
    patron: "Batteryville families and Static Pack archivists",
    stakes: "Follow the same Cascade worker IDs that swallowed Skids' parents before the archive burns the trail.",
    rewardFocus: ["Lore-heavy XP", "Archive heist cash", "Cross-district split rewards"],
    sceneTags: ["Missing IDs", "Archive shards", "Cascade ghosts"],
    successLabel: "Trail reopened",
    failureLabel: "Trail purged",
    localeSummary: "An archive neighborhood in The Grid where the local trace rails break into ghost, vault, and cutout forks.",
  },
};

const DISTRICT_LORE_BY_NAME = new Map(
  DISTRICT_LORE.filter((entry) => entry.kind === "district").map((entry) => [entry.name, entry]),
);
const LOCATION_LORE_BY_NAME = new Map(DISTRICT_LORE.map((entry) => [entry.name, entry]));

function formatTimestamp(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

function getDefaultRequirementResults(mission: MissionBoardEntry, selectedForkOptionId?: string | null): MissionRequirementResult[] {
  return getMissionEffectiveRequirements(mission, selectedForkOptionId).map((requirement) => ({
    requirement,
    met: false,
    current: 0,
    needed: requirement.count ?? 0,
    detail: requirement.label,
  }));
}

function formatForkRewardDelta(delta?: number): string | null {
  if (!delta) return null;
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function getMissionPresentation(mission: MissionBoardEntry | null): MissionPresentation {
  if (!mission) return DEFAULT_PRESENTATION;
  return MISSION_PRESENTATIONS[mission.definitionId] ?? DEFAULT_PRESENTATION;
}

function getMissionThemeStyle(district: District): CSSProperties {
  const theme = DISTRICT_THEMES[district];
  return {
    "--mission-accent": theme.accent,
    "--mission-accent-soft": theme.accentSoft,
    "--mission-glow": theme.glow,
  } as CSSProperties;
}

function getMissionResultLog(result: MissionRunResponse): string[] {
  const mission = result.mission;
  const forkOption = getMissionForkOption(mission, mission.selectedForkOptionId);
  if (result.rewardGranted) {
    const rewards = getMissionEffectiveRewards(mission, mission.selectedForkOptionId);
    return [
      `${mission.selectedDeckName ?? result.evaluation.deckName} cleared ${mission.title}${forkOption ? ` via ${forkOption.label}` : ""}.`,
      `Banked +${rewards.rewardXp} Mission XP.`,
      `Pulled +${rewards.rewardOzzies} Ozzies out of ${mission.district}.`,
    ];
  }
  return mission.lastRunFailureReasons?.length
    ? mission.lastRunFailureReasons
    : result.evaluation.results.filter((entry) => !entry.met).map((entry) => entry.detail);
}

function getMissionDistrictAccessSummary(
  mission: MissionBoardEntry,
  weather: DistrictWeatherSnapshot | null,
): string {
  return getMissionWeatherSummary(mission, { [mission.district]: weather });
}

function isForkRequirement(
  requirement: MissionRequirement,
  selectedForkOptionId: string | null,
  mission: MissionBoardEntry,
): boolean {
  const selectedForkOption = getMissionForkOption(mission, selectedForkOptionId);
  return (selectedForkOption?.requirements ?? []).some((entry) => (
    entry.type === requirement.type
      && entry.label === requirement.label
      && entry.count === requirement.count
      && entry.district === requirement.district
      && entry.archetype === requirement.archetype
      && entry.faction === requirement.faction
      && entry.stat === requirement.stat
  ));
}

function getRequirementTip(
  result: MissionRequirementResult,
  mission: MissionBoardEntry,
  weather: DistrictWeatherSnapshot | null,
): string {
  const currentAccessSummary = `${mission.district} currently allows ${getMissionDistrictAccessSummary(mission, weather)}.`;
  const requiredWheelTypes = result.requirement.wheelTypes?.length
    ? result.requirement.wheelTypes.join(" / ")
    : "the required wheel setup";
  switch (result.requirement.type) {
    case "min_cards":
      return "Mission decks need at least five mission-ready cards to clear the contract clean.";
    case "district_access":
      return weather?.accessRule
        ? `${currentAccessSummary} Weather is adding a board-type lock on top of the normal wheel rules.`
        : `${currentAccessSummary} Only couriers whose board setup matches that access rule count here.`;
    case "wheel_type":
      return `This checks each courier's equipped wheels. Only ${requiredWheelTypes} count.`;
    case "stat_total":
      return `This is the combined ${result.requirement.stat} from the whole deck, not a single courier.`;
    case "district_card":
      return `Locals are couriers whose home district is ${result.requirement.district ?? mission.district}.`;
    case "archetype":
      return `Any courier with the ${result.requirement.archetype} archetype counts toward this route.`;
    case "faction":
      return `Any courier from the ${result.requirement.faction} crew counts toward this route.`;
    default:
      return "This check must pass if you want the launch to clear instead of fail.";
  }
}

export function MissionsPanel({ uid }: MissionsPanelProps) {
  const { user, playerRewards } = useAuth();
  const { decks } = useDecks();
  const { weatherByDistrict } = useDistrictWeather();
  const [missions, setMissions] = useState<MissionBoardEntry[]>([]);
  const [progression, setProgression] = useState<MissionBoardProgression>({
    missionXp: 0,
    missionOzzies: 0,
  });
  const [boardDateKey, setBoardDateKey] = useState<string>("");
  const [dailyResetAt, setDailyResetAt] = useState<string>("");
  const [weeklyTheme, setWeeklyTheme] = useState<MissionBoardTheme | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastResetRefreshAt, setLastResetRefreshAt] = useState<string>("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningMissionId, setRunningMissionId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedForkOptionId, setSelectedForkOptionId] = useState<string | null>(null);
  const [missionResult, setMissionResult] = useState<MissionRunResponse | null>(null);

  useEffect(() => {
    if (!isEnabled("MISSIONS", user)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMissionBoard(uid, user?.email)
      .then((payload) => {
        if (cancelled) return;
        setMissions(payload.missions);
        setProgression(payload.progression);
        setBoardDateKey(payload.boardDateKey ?? "");
        setDailyResetAt(payload.dailyResetAt ?? "");
        setWeeklyTheme(payload.weeklyTheme ?? null);
        setSelectedMissionId((current) => current ?? payload.missions[0]?.id ?? null);
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load mission board.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, uid, user]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!dailyResetAt) return;
    const resetMs = new Date(dailyResetAt).getTime();
    if (!Number.isFinite(resetMs) || nowMs < resetMs || lastResetRefreshAt === dailyResetAt) return;
    setLastResetRefreshAt(dailyResetAt);
    setRefreshNonce((current) => current + 1);
  }, [dailyResetAt, lastResetRefreshAt, nowMs]);

  useEffect(() => {
    const isSelectedMissionInvalid = !selectedMissionId || !missions.some((mission) => mission.id === selectedMissionId);
    if (isSelectedMissionInvalid && missions.length > 0) {
      setSelectedMissionId(missions[0].id);
    }
  }, [missions, selectedMissionId]);

  useEffect(() => {
    if (selectedDeckId && decks.some((deck) => deck.id === selectedDeckId)) return;
    setSelectedDeckId(decks[0]?.id ?? null);
  }, [decks, selectedDeckId]);

  useEffect(() => {
    const mission = missions.find((entry) => entry.id === selectedMissionId) ?? missions[0] ?? null;
    setSelectedForkOptionId(mission?.selectedForkOptionId ?? null);
  }, [missions, selectedMissionId]);

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? missions[0] ?? null,
    [missions, selectedMissionId],
  );
  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null,
    [decks, selectedDeckId],
  );
  const deckEvaluations = useMemo(
    () => selectedMission
      ? decks.map((deck) => evaluateMissionDeck(deck, selectedMission, weatherByDistrict, selectedForkOptionId))
      : [],
    [decks, selectedForkOptionId, selectedMission, weatherByDistrict],
  );
  const selectedEvaluation = useMemo(
    () => selectedMission && selectedDeck
      ? evaluateMissionDeck(selectedDeck, selectedMission, weatherByDistrict, selectedForkOptionId)
      : null,
    [selectedDeck, selectedForkOptionId, selectedMission, weatherByDistrict],
  );
  const selectedForkOption = useMemo(
    () => (selectedMission ? getMissionForkOption(selectedMission, selectedForkOptionId) : null),
    [selectedForkOptionId, selectedMission],
  );
  const selectedDistrictWeather = useMemo(
    () => (selectedMission ? weatherByDistrict[selectedMission.district] ?? null : null),
    [selectedMission, weatherByDistrict],
  );
  const selectedRewards = useMemo(
    () => (selectedMission ? getMissionEffectiveRewards(selectedMission, selectedForkOptionId) : { rewardXp: 0, rewardOzzies: 0 }),
    [selectedForkOptionId, selectedMission],
  );
  const selectedPresentation = useMemo(() => getMissionPresentation(selectedMission), [selectedMission]);
  const selectedDistrictLore = useMemo(
    () => (selectedMission ? DISTRICT_LORE_BY_NAME.get(selectedMission.district) ?? null : null),
    [selectedMission],
  );
  const selectedLocale = selectedPresentation.locale ?? selectedMission?.district ?? null;
  const selectedLocaleLore = useMemo(
    () => (selectedLocale ? LOCATION_LORE_BY_NAME.get(selectedLocale) ?? null : null),
    [selectedLocale],
  );
  const missionResultLog = useMemo(
    () => (missionResult ? getMissionResultLog(missionResult) : []),
    [missionResult],
  );
  const selectedDeckCardCount = selectedDeck?.cards.length ?? 0;
  const selectedDeckReadyCount = selectedEvaluation?.eligibleCardCount ?? 0;
  const selectedRouteLabel = selectedForkOption?.label ?? "Main line";
  const streakState = playerRewards?.dailyReward ?? null;
  const nextStreakReward = streakState
    ? { xp: streakState.nextRewardXp, ozzies: streakState.nextRewardOzzies }
    : getNextDailyReward(1, false);
  const missionResetCountdown = useMemo(
    () => formatDurationClock(getRemainingDurationMs(dailyResetAt, nowMs)),
    [dailyResetAt, nowMs],
  );
  const selectedOutcomeLabel = selectedMission?.status === "completed"
    ? "Route Cleared"
    : selectedEvaluation?.eligible
      ? "Deck Ready"
      : "Needs work";
  const selectedOutcomeBadgeClass = selectedMission?.status === "completed" || selectedEvaluation?.eligible
    ? "mission-result__badge mission-result__badge--success"
    : "mission-result__badge mission-result__badge--fail";
  const selectedLaunchTips = useMemo(() => {
    if (!selectedMission) return [];
    return [
      `${selectedMission.district} access right now: ${getMissionDistrictAccessSummary(selectedMission, selectedDistrictWeather)}.`,
      selectedEvaluation?.eligible
        ? "This deck clears the active checks, so a clean clear is on the table."
        : "Launch Run still works even if this deck misses checks, but a failed push can sideline one courier for a short injury, breakdown, or arrest timeout.",
      selectedForkOption
        ? `Optional route locked: ${selectedForkOption.label}.`
        : "Route forks stay optional and sit after the launch stage.",
    ];
  }, [selectedDistrictWeather, selectedEvaluation, selectedForkOption, selectedMission]);

  const handleRunMission = useCallback(async () => {
    if (!selectedMission || !selectedDeck) return;
    setRunningMissionId(selectedMission.id);
    setError(null);
    try {
      const result = await runMission(uid, selectedMission.id, selectedDeck.id, selectedForkOptionId, user?.email);
      setMissions((current) => current.map((mission) => (
        mission.id === result.mission.id ? result.mission : mission
      )));
      setProgression(result.progression);
      setSelectedDeckId(result.mission.selectedDeckId ?? selectedDeck.id);
      setSelectedForkOptionId(result.mission.selectedForkOptionId ?? selectedForkOptionId);
      setMissionResult(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to resolve mission.");
    } finally {
      setRunningMissionId(null);
    }
  }, [selectedDeck, selectedForkOptionId, selectedMission, uid, user]);

  if (!isEnabled("MISSIONS", user)) return null;

  return (
    <section className="mission-panel mission-selector-panel" aria-label="Mission board">
      <div className="mission-selector-panel__header">
        <div>
          <div className="mission-selector-panel__title">Missions</div>
          <p className="mission-selector-panel__summary">
            Collect your streak, check today&apos;s contracts, and launch the right crew before the board resets.
          </p>
        </div>
        <div className="mission-selector-card__badges">
          <span className="mission-selector-card__badge">⚡ {progression.missionXp} Mission XP</span>
          <span className="mission-selector-card__badge tag--ozzies">💰 {progression.missionOzzies} Ozzies</span>
        </div>
      </div>

      <div className="daily-ritual-strip">
        <article className="daily-ritual-card">
          <span className="daily-ritual-card__label">Login streak</span>
          <strong className="daily-ritual-card__value">{streakState?.currentStreak ?? 0} days</strong>
          <p className="daily-ritual-card__body">
            {streakState?.claimed
              ? `Claimed today for +${streakState.rewardXp} XP and +${streakState.rewardOzzies} Ozzies.`
              : streakState?.claimedToday
                ? "Already claimed today. Come back after reset for the next hit."
                : "Sign in to start stacking your daily streak."}
          </p>
        </article>
        <article className="daily-ritual-card">
          <span className="daily-ritual-card__label">Next reward</span>
          <strong className="daily-ritual-card__value">+{nextStreakReward.xp} XP · +{nextStreakReward.ozzies} Oz</strong>
          <p className="daily-ritual-card__body">
            {streakState?.claimedToday ? "Locked for the next reset." : "Ready on your next sync."}
          </p>
        </article>
        <article className="daily-ritual-card">
          <span className="daily-ritual-card__label">Today&apos;s board</span>
          <strong className="daily-ritual-card__value">{missions.length} contracts live</strong>
          <p className="daily-ritual-card__body">
            {boardDateKey ? `Board key ${boardDateKey}.` : "Daily board loading."} Resets in {missionResetCountdown}.
          </p>
        </article>
        {weeklyTheme && (
          <article className="daily-ritual-card daily-ritual-card--theme">
            <span className="daily-ritual-card__label">Weekly theme</span>
            <strong className="daily-ritual-card__value">{weeklyTheme.label}</strong>
            <p className="daily-ritual-card__body">{weeklyTheme.summary}</p>
          </article>
        )}
      </div>

      {loading && (
        <div className="mission-selector-empty">Loading mission board…</div>
      )}

      {!loading && error && (
        <div className="mission-selector-empty" role="alert">{error}</div>
      )}

      {!loading && !error && missions.length === 0 && (
        <div className="mission-selector-empty">
          No contracts are active yet. Check your connection and try again.
        </div>
      )}

      {!loading && !error && missions.length > 0 && (
        <div className="mission-grid">
          <div className="mission-selector-grid">
            {missions.map((mission) => {
              const presentation = getMissionPresentation(mission);
              const primaryRequirement = mission.requirements[0];
              const secondaryRequirement = mission.requirements[1];
              return (
                <button
                  key={mission.id}
                  type="button"
                  className={[
                    "mission-selector-card",
                    selectedMission?.id === mission.id ? "mission-selector-card--active" : "",
                    mission.status === "completed" ? "mission-selector-card--completed" : "",
                  ].filter(Boolean).join(" ")}
                  style={getMissionThemeStyle(mission.district)}
                  onClick={() => setSelectedMissionId(mission.id)}
                >
                  {mission.status === "completed" && (
                    <span className="mission-selector-card__check" aria-hidden="true">✓</span>
                  )}
                  <div className="mission-selector-card__scene" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="mission-selector-card__topline">
                    <span className="mission-selector-card__district">
                      <DistrictBadge location={mission.district} size="sm" />
                    </span>
                    <span
                      className={`mission-selector-card__state${mission.status === "completed" ? "" : " mission-selector-card__state--available"}`}
                    >
                      {getMissionStateLabel(mission)}
                    </span>
                  </div>
                  <span className="mission-selector-card__operation">{presentation.operation}</span>
                  <strong className="mission-selector-card__name">{mission.title}</strong>
                  <p className="mission-selector-card__tagline">{mission.tagline}</p>
                  <div className="mission-selector-card__stats" aria-label="Mission rewards and requirements">
                    <span className="mission-selector-card__stat mission-selector-card__stat--reward">+{mission.rewardOzzies} Oz</span>
                    <span className="mission-selector-card__stat">+{mission.rewardXp} XP</span>
                    <span className="mission-selector-card__stat">{mission.requirements.length} checks</span>
                  </div>
                  {(primaryRequirement || secondaryRequirement) && (
                    <p className="mission-selector-card__hint">
                      {primaryRequirement ? getMissionRequirementBadge(primaryRequirement) : null}
                      {primaryRequirement && secondaryRequirement ? " · " : null}
                      {secondaryRequirement ? getMissionRequirementBadge(secondaryRequirement) : null}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {selectedMission && (
            <div className="mission-panel mission-panel--detail" style={getMissionThemeStyle(selectedMission.district)}>
              <div className="mission-panel__header">
                <div>
                  <div className="mission-selector-card__district">
                    <DistrictBadge location={selectedMission.district} size="sm" />
                  </div>
                  <h3 className="mission-selector-card__name">{selectedMission.title}</h3>
                  <p className="mission-selector-card__tagline mission-selector-card__tagline--detail">
                    {selectedMission.tagline}
                  </p>
                  <div className="mission-selector-card__stats mission-selector-card__stats--detail">
                    <span className="mission-selector-card__stat mission-selector-card__stat--reward">+{selectedRewards.rewardOzzies} Oz</span>
                    <span className="mission-selector-card__stat">+{selectedRewards.rewardXp} XP</span>
                    <span className={selectedOutcomeBadgeClass}>{selectedOutcomeLabel}</span>
                  </div>
                </div>
              </div>

              <MissionTransitScene
                missionId={selectedMission.id}
                locale={selectedLocale ?? selectedMission.district}
                localeSummary={
                  selectedPresentation.localeSummary
                  ?? `${selectedLocale ?? selectedMission.district} is running a local courier map with live forks and relay pressure.`
                }
                sceneEyebrow={selectedPresentation.operation}
                sceneTitle={selectedPresentation.patron}
                sceneBody={selectedPresentation.stakes}
                sceneTags={selectedPresentation.sceneTags}
                selectedDeckName={selectedDeck?.name ?? selectedMission.selectedDeckName}
                routeLabel={selectedRouteLabel}
                fork={selectedMission.fork}
                selectedForkOption={selectedForkOption}
                controlledBy={selectedLocaleLore?.controlledBy ?? selectedDistrictLore?.controlledBy ?? "Courier crews"}
                crewPressure={selectedLocaleLore?.crews.slice(0, 2).join(" · ") ?? selectedMission.district}
                glyph={DISTRICT_THEMES[selectedMission.district].glyph}
              />

              <div className="mission-flow">
                <section className="mission-stage mission-panel">
                  <div className="mission-stage__header">
                    <div>
                      <span className="mission-stage__eyebrow">Deck selection</span>
                      <h4 className="mission-stage__title">Pick the crew taking the run</h4>
                      <p className="mission-stage__summary">
                        Lock in a deck first. The launch stage comes next, and the route fork stays optional after that.
                      </p>
                    </div>
                    <div className="mission-deck-focus">
                      <span className="mission-deck-focus__label">Current pick</span>
                      <strong className="mission-deck-focus__name">{selectedDeck?.name ?? "No deck selected"}</strong>
                      <span className="mission-deck-focus__meta">
                        {selectedDeckCardCount} cards · {selectedDeckReadyCount} mission-ready · {selectedRouteLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mission-runner-grid">
                    {deckEvaluations.map((evaluation) => {
                      const deck = decks.find((entry) => entry.id === evaluation.deckId);
                      return (
                        <button
                          key={evaluation.deckId}
                          type="button"
                          className={`mission-runner-card${selectedDeck?.id === evaluation.deckId ? " mission-runner-card--active" : ""}`}
                          onClick={() => setSelectedDeckId(evaluation.deckId)}
                        >
                          <strong>{evaluation.deckName}</strong>
                          <span className="mission-selector-card__tagline">
                            {deck?.cards.length ?? 0} cards · {evaluation.eligibleCardCount} mission-ready
                          </span>
                          <span
                            className={`mission-result__badge ${evaluation.eligible ? "mission-result__badge--success" : "mission-result__badge--fail"}`}
                          >
                            {evaluation.eligible ? "Clean" : "At risk"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="mission-stage mission-panel">
                  <div className="mission-stage__header">
                    <div>
                      <span className="mission-stage__eyebrow">Launch stage</span>
                      <h4 className="mission-stage__title">Launch the run when you are ready</h4>
                      <p className="mission-stage__summary">
                        Launch is always available once you pick a deck. Clearing every active check is how you win and avoid a short downtime hit.
                      </p>
                    </div>
                    <div className="mission-stage__actions">
                      <button
                        className="btn-primary"
                        onClick={handleRunMission}
                        disabled={
                          runningMissionId === selectedMission.id ||
                          selectedMission.status === "completed" ||
                          !selectedDeck
                        }
                      >
                        {selectedMission.status === "completed"
                          ? "Mission Cleared"
                          : runningMissionId === selectedMission.id
                            ? "Running…"
                            : "Launch Run"}
                      </button>
                    </div>
                  </div>

                  <div className="mission-outcome-grid">
                    <article className="mission-outcome-card">
                      <div className="mission-result">
                        <div className="mission-result__hero">
                          <div className="mission-result__headline">{selectedMission.tagline}</div>
                          <span className={selectedOutcomeBadgeClass}>{selectedOutcomeLabel}</span>
                        </div>
                        <div className="mission-result__rewards">
                          <div className="mission-result__reward-card">
                            <span className="mission-result__reward-label">Mission XP</span>
                            <strong className="mission-result__reward-value">+{selectedRewards.rewardXp}</strong>
                          </div>
                          <div className="mission-result__reward-card mission-result__reward-card--ozzies">
                            <span className="mission-result__reward-label">Ozzies</span>
                            <strong className="mission-result__reward-value">+{selectedRewards.rewardOzzies}</strong>
                          </div>
                        </div>
                      </div>

                      <div className={`mission-weather${selectedEvaluation && !selectedEvaluation.eligible ? " mission-weather--blocked" : ""}`}>
                        <div className="mission-weather__copy">
                          <span className="mission-weather__eyebrow">District access</span>
                          <strong className="mission-weather__title">{selectedMission.district}</strong>
                          <p className="mission-weather__body">
                            Access now: {getMissionWeatherSummary(selectedMission, weatherByDistrict)}.
                          </p>
                        </div>
                        <span
                          className={`mission-weather__status${selectedEvaluation && !selectedEvaluation.eligible ? " mission-weather__status--restricted" : ""}`}
                        >
                          {selectedEvaluation?.eligible ? "Deck ready" : "Needs work"}
                        </span>
                      </div>
                    </article>

                    <article className="mission-outcome-card">
                      <div className="mission-stats">
                        <div className="mission-stat-row">
                          <span className="mission-stat-label">Selected deck</span>
                          <span className="mission-stat-value">{selectedDeck?.name ?? "No deck selected"}</span>
                        </div>
                        {selectedForkOption && (
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Chosen route</span>
                            <span className="mission-stat-value">{selectedRouteLabel}</span>
                          </div>
                        )}
                        <div className="mission-stat-row">
                          <span className="mission-stat-label">Last run</span>
                          <span className="mission-stat-value">{formatTimestamp(selectedMission.lastRunAt) ?? "Never launched"}</span>
                        </div>
                        {selectedMission.status === "completed" && (
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Cleared with</span>
                            <span className="mission-stat-value">{selectedMission.selectedDeckName ?? "Unknown deck"}</span>
                          </div>
                        )}
                      </div>

                      <div className="mission-checks">
                        {(selectedEvaluation?.results ?? getDefaultRequirementResults(selectedMission, selectedForkOptionId)).map((result) => (
                          <article
                            key={`${selectedMission.id}-${result.requirement.label}`}
                            className={`mission-check-card${result.met ? " mission-check-card--met" : " mission-check-card--blocked"}`}
                          >
                            <div className="mission-check-card__header">
                              <strong className="mission-check-card__title">
                                {result.met ? "✅" : "⛔"} {result.requirement.label}
                              </strong>
                              <span className="mission-check-card__progress">
                                {result.current}/{result.needed}
                              </span>
                            </div>
                            <span className="mission-check-card__meta">
                              {isForkRequirement(result.requirement, selectedForkOptionId, selectedMission) ? "Selected route check" : "Base contract check"}
                            </span>
                            <p className="mission-check-card__detail">{result.detail}</p>
                            <p className="mission-check-card__tip">
                              Tip: {getRequirementTip(result, selectedMission, selectedDistrictWeather)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </article>
                  </div>

                  {selectedEvaluation && !selectedEvaluation.eligible && (
                    <p className="mission-warning">{selectedEvaluation.summary}</p>
                  )}
                  {selectedMission.lastRunSummary && (
                    <p className="mission-warning">{selectedMission.lastRunSummary}</p>
                  )}
                </section>

                {selectedMission.fork && (
                  <section className="mission-stage mission-panel mission-fork">
                    <div className="mission-stage__header">
                      <div>
                        <span className="mission-stage__eyebrow">Optional route fork</span>
                        <h4 className="mission-stage__title">Push the main line or add more pressure</h4>
                        <p className="mission-stage__summary">
                          These route choices stay optional and only change the run if you decide to lock one in.
                        </p>
                      </div>
                    </div>
                    <div className="mission-fork__header">
                      <span className="mission-fork__badge">{selectedMission.fork.badge}</span>
                      <p className="mission-fork__prompt">{selectedMission.fork.prompt}</p>
                    </div>
                    <div className="mission-fork__options">
                      {selectedMission.fork.options.map((option) => (
                        <button
                          key={`${selectedMission.id}-${option.id}`}
                          type="button"
                          className={`mission-fork__option${selectedForkOption?.id === option.id ? " mission-fork__option--active" : ""}`}
                          onClick={() => setSelectedForkOptionId(option.id)}
                          aria-pressed={selectedForkOption?.id === option.id}
                        >
                          <span className="mission-fork__option-label">{option.label}</span>
                          <span className="mission-fork__option-meta">
                            {option.rewardOzziesDelta && option.rewardXpDelta
                              ? "Split reward route"
                              : option.rewardOzziesDelta
                                ? "Cash pressure route"
                                : "XP pressure route"}
                          </span>
                          <span className="mission-fork__option-desc">{option.description}</span>
                          {(option.rewardXpDelta || option.rewardOzziesDelta) && (
                            <span className="mission-fork__option-desc">
                              {option.rewardXpDelta ? `${formatForkRewardDelta(option.rewardXpDelta)} XP` : null}
                              {option.rewardXpDelta && option.rewardOzziesDelta ? " · " : null}
                              {option.rewardOzziesDelta ? `${formatForkRewardDelta(option.rewardOzziesDelta)} Oz` : null}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="mission-intel-grid">
                <article className="mission-intel-card">
                  <span className="mission-intel-card__label">District dossier</span>
                  <p>{selectedDistrictLore?.description ?? selectedMission.description}</p>
                  <p className="mission-intel-card__quote">
                    {selectedDistrictLore?.flavorTexts[0] ?? "Every route in this city wants a different kind of nerve."}
                  </p>
                </article>
                <article className="mission-intel-card">
                  <span className="mission-intel-card__label">Reward profile</span>
                  <ul className="mission-intel-list">
                    {selectedPresentation.rewardFocus.map((item) => (
                      <li key={`${selectedMission.id}-${item}`}>{item}</li>
                    ))}
                  </ul>
                  <p className="mission-intel-card__quote">
                    Atmosphere: {selectedDistrictLore?.atmosphere ?? selectedMission.tagline}
                  </p>
                </article>
                <article className="mission-intel-card">
                  <span className="mission-intel-card__label">How to unlock this run</span>
                    <ul className="mission-intel-list">
                      {selectedLaunchTips.slice(0, 3).map((tip, index) => (
                        <li key={`${selectedMission.id}-tip-${index}`}>{tip}</li>
                      ))}
                    </ul>
                  <p className="mission-intel-card__quote">
                    Launch Run stays live after deck pick. Passing every active check is still how you clear the contract and avoid downtime.
                  </p>
                </article>
              </div>
            </div>
          )}
        </div>
      )}

      {missionResult && (
        <div className="mission-result-overlay" role="dialog" aria-modal="true" aria-labelledby="mission-result-title">
          <div
            className={[
              "mission-panel",
              "mission-result-popup",
              "mission-result-panel",
              missionResult.rewardGranted ? "mission-result-panel--success" : "mission-result-panel--fail",
            ].join(" ")}
            style={getMissionThemeStyle(missionResult.mission.district)}
          >
            {missionResult.rewardGranted && (
              <div className="mission-result-panel__beams" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
            <button
              type="button"
              className="mission-result-popup__close"
              onClick={() => setMissionResult(null)}
              aria-label="Close mission result"
            >
              ×
            </button>
            <div className="mission-result-popup__summary">
              <span className="mission-selector-card__district">
                <DistrictBadge location={missionResult.mission.district} size="sm" />
              </span>
              <h3 id="mission-result-title" className="mission-selector-card__name">
                {missionResult.rewardGranted
                  ? getMissionPresentation(missionResult.mission).successLabel
                  : getMissionPresentation(missionResult.mission).failureLabel}
              </h3>
                <p className="mission-selector-card__tagline">
                  {missionResult.mission.lastRunSummary ?? missionResult.evaluation.summary}
                </p>
              </div>
            <div className="mission-result__rewards">
              <div className="mission-result__reward-card">
                <span className="mission-result__reward-label">Chosen deck</span>
                <strong className="mission-result__reward-value">
                  {missionResult.mission.selectedDeckName ?? missionResult.evaluation.deckName}
                </strong>
              </div>
              <div className="mission-result__reward-card mission-result__reward-card--ozzies">
                <span className="mission-result__reward-label">Route</span>
                <strong className="mission-result__reward-value">
                  {getMissionForkOption(missionResult.mission, missionResult.mission.selectedForkOptionId)?.label ?? "Main line"}
                </strong>
              </div>
            </div>
            <div className="mission-result-popup__grid">
              <div className="mission-result-popup__panel">
                <span className="mission-result-popup__eyebrow">Run log</span>
                <ul className="mission-log">
                  {missionResultLog.map((entry) => (
                    <li key={`${missionResult.mission.id}-${entry}`}>{entry}</li>
                  ))}
                </ul>
              </div>
              <div className="mission-result-popup__panel">
                <span className="mission-result-popup__eyebrow">Why players chase it</span>
                <ul className="mission-intel-list">
                  {getMissionPresentation(missionResult.mission).rewardFocus.map((entry) => (
                    <li key={`${missionResult.mission.id}-focus-${entry}`}>{entry}</li>
                  ))}
                </ul>
                <p className="mission-intel-card__quote">
                  {DISTRICT_LORE_BY_NAME.get(missionResult.mission.district)?.flavorTexts[1]
                    ?? "The district remembers who cleared the route and who folded."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
