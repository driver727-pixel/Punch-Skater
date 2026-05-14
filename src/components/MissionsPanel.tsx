import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MissionTransitScene } from "./MissionTransitScene";
import { GeoAtlas } from "./GeoAtlas";
import type { GeoAtlasMarker } from "./GeoAtlas";
import { useAuth } from "../context/AuthContext";
import { DECK_CARD_LIMIT, useDecks } from "../hooks/useDecks";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import type { DistrictWeatherSnapshot } from "../lib/districtWeather";
import { getDistrictAccessSummary } from "../lib/districtWeather";
import { isEnabled } from "../lib/featureFlags";
import { DISTRICT_LORE } from "../lib/lore";
import { formatDurationClock, getNextDailyReward, getRemainingDurationMs } from "../lib/dailyRewards";
import { DistrictBadge } from "./DistrictBadge";
import {
  HARD_CUTOUT_COUNTER_ID,
  evaluateMissionDeck,
  getMissionEncounter,
  getMissionEffectiveRequirements,
  getMissionEffectiveRewards,
  getMissionJoustTactics,
  getMissionWeatherSummary,
} from "../lib/missions";
import type {
  MissionBoardEntry,
  MissionBoardTheme,
  MissionBoardProgression,
  MissionEncounterOption,
  MissionJoustResult,
  MissionRequirement,
  MissionRequirementResult,
  MissionRunResponse,
  MissionStatusEffect,
} from "../lib/sharedTypes";
import type { District, JoustTactic, WorldLocation } from "../lib/types";
import { getMissionBoard, runMission } from "../services/missions";
import { CardThumbnail } from "./CardThumbnail";

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

/** Pixel offsets applied to mission map markers that share the same district, so pins don't overlap. */
const SAME_DISTRICT_OFFSETS: Array<{ x: number; y: number }> = [
  { x: -12, y: -8 },
  { x: 12, y: -8 },
  { x: -12, y: 12 },
  { x: 12, y: 12 },
];
const MISSION_DECK_PREVIEW_OFFSET_PER_CARD = 18;
const MISSION_DECK_PREVIEW_ROTATION_PER_CARD = 6;

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
    stakes: "Carry a rave broadcast through the Murk before the Dark Lanes seize the booth that turns unknown riders into targets.",
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
    stakes: "Follow vanished Cascade worker IDs before the archive burns the trail.",
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
const MAIN_ROUTE_LABEL = "Launch window";
const LIVE_COUNTER_LABEL = "Live counter pending";
const HARD_CUTOUT_LABEL = "Hard cutout";

function formatTimestamp(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

function getDefaultRequirementResults(mission: MissionBoardEntry, selectedCounterOptionId?: string | null): MissionRequirementResult[] {
  return getMissionEffectiveRequirements(mission, selectedCounterOptionId).map((requirement) => ({
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

function formatJoustTacticLabel(tactic: JoustTactic): string {
  return tactic
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

function getMissionPresentation(mission: MissionBoardEntry | null): MissionPresentation {
  if (!mission) return DEFAULT_PRESENTATION;
  return MISSION_PRESENTATIONS[mission.definitionId] ?? DEFAULT_PRESENTATION;
}

function isMissionResultRevealed(mission: MissionBoardEntry | null): boolean {
  if (mission?.activeRun?.phase === "event") return false;
  return Boolean(mission?.lastRunAt || mission?.status === "completed");
}

function isMissionAwaitingChoice(mission: MissionBoardEntry | null): boolean {
  return mission?.activeRun?.phase === "event";
}

function getSelectedRouteLabel(
  mission: MissionBoardEntry | null,
  selectedCounterOption: MissionEncounterOption | null,
  resultRevealed: boolean,
): string {
  if (mission?.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID) return HARD_CUTOUT_LABEL;
  if (isMissionAwaitingChoice(mission)) return LIVE_COUNTER_LABEL;
  if (!selectedCounterOption) return MAIN_ROUTE_LABEL;
  return resultRevealed ? selectedCounterOption.label : LIVE_COUNTER_LABEL;
}

function getEncounterRewardTypeLabel(option: MissionEncounterOption): string {
  if (option.encounterType === "joust") return "Joust bonus route";
  if (option.rewardOzziesDelta && option.rewardXpDelta) return "Split reward route";
  if (option.rewardOzziesDelta) return "Cash pressure route";
  return "XP pressure route";
}

function getEncounterOptionStatusLabel(option: MissionEncounterOption): string {
  if (!option.available) return "Requirements not met";
  return option.encounterType === "joust" ? "Ready" : "Available";
}

function getEncounterOptionMetaText(option: MissionEncounterOption, awaitingChoice: boolean): string {
  const rewardType = getEncounterRewardTypeLabel(option);
  return awaitingChoice ? `${rewardType} · ${getEncounterOptionStatusLabel(option)}` : rewardType;
}

function getMissionOutcomeLabel(
  mission: MissionBoardEntry | null,
  evaluationEligible: boolean | undefined,
  resultRevealed: boolean,
): string {
  if (mission?.activeRun?.phase === "event") return "Live Event";
  if (!resultRevealed) return "Intel Hidden";
  if (mission?.status === "completed") return "Route Cleared";
  if (evaluationEligible) return "Deck Ready";
  return "Needs work";
}

function getMissionOutcomeBadgeClass(
  mission: MissionBoardEntry | null,
  evaluationEligible: boolean | undefined,
  resultRevealed: boolean,
): string {
  if (mission?.activeRun?.phase === "event") return "mission-result__badge mission-result__badge--mystery";
  if (!resultRevealed) return "mission-result__badge mission-result__badge--mystery";
  if (mission?.status === "completed" || evaluationEligible) return "mission-result__badge mission-result__badge--success";
  return "mission-result__badge mission-result__badge--fail";
}

function getMissionThemeStyle(district: District): CSSProperties {
  const theme = DISTRICT_THEMES[district];
  return {
    "--mission-accent": theme.accent,
    "--mission-accent-soft": theme.accentSoft,
    "--mission-glow": theme.glow,
  } as CSSProperties;
}

interface MissionLogEntry {
  text: string;
  kind: "default" | "xp" | "ozzies";
}

function getMissionResultRewards(result: MissionRunResponse): { rewardXp: number; rewardOzzies: number } {
  const mission = result.mission;
  if (typeof mission.lastRunRewardXp === "number" && typeof mission.lastRunRewardOzzies === "number") {
    return { rewardXp: mission.lastRunRewardXp, rewardOzzies: mission.lastRunRewardOzzies };
  }
  if (mission.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID) {
    return {
      rewardXp: Math.max(0, mission.rewardXp - 20),
      rewardOzzies: Math.max(0, mission.rewardOzzies - 20),
    };
  }
  return getMissionEffectiveRewards(mission, mission.selectedCounterOptionId);
}

function getMissionResultLog(result: MissionRunResponse): MissionLogEntry[] {
  const mission = result.mission;
  const counterOption = getMissionEncounter(mission)?.options.find((option) => (
    option.id === (mission.selectedCounterOptionId ?? mission.activeRun?.selectedCounterOptionId)
  )) ?? null;
  const joustResult = mission.lastRunJoustResult ?? null;
  if (result.rewardGranted) {
    const rewards = getMissionResultRewards(result);
    return [
      { text: `${mission.selectedDeckName ?? result.evaluation.deckName} cleared ${mission.title}${counterOption ? ` via ${counterOption.label}` : mission.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID ? " via a hard cutout" : ""}.`, kind: "default" },
      { text: `Banked +${rewards.rewardXp} Mission XP.`, kind: "xp" },
      { text: `Pulled +${rewards.rewardOzzies} Ozzies out of ${mission.district}.`, kind: "ozzies" },
      ...(joustResult
        ? [
          { text: `${joustResult.playerName} called the district joust and ${joustResult.outcome === "win" ? "won" : joustResult.outcome === "draw" ? "drew" : "lost"} against ${joustResult.rivalName}.`, kind: "default" as const },
          { text: `${formatJoustTacticLabel(joustResult.playerTactic)} into ${formatJoustTacticLabel(joustResult.rivalTactic)} — ${joustResult.narration}`, kind: "default" as const },
        ]
        : []),
      ...(mission.lastRunCardOutcomes ?? []).map((outcome) => ({ text: outcome.summary, kind: "default" as const })),
      ...(mission.lastRunEffects ?? []).map((effect) => ({ text: `${effect.label}: ${effect.summary}`, kind: "default" as const })),
    ];
  }
  const failureLines = mission.lastRunFailureReasons?.length
    ? mission.lastRunFailureReasons
    : result.evaluation.results.filter((entry) => !entry.met).map((entry) => entry.detail);
  return failureLines.map((text) => ({ text, kind: "default" as const }));
}

function getCounterOptionRequirementText(option: MissionEncounterOption): string {
  if (option.encounterType === "joust") {
    return option.joustPrompt ?? option.description;
  }
  if (option.requiredTags?.length) {
    return `Needs ${option.requiredTags.join(" · ")}.`;
  }
  return option.description;
}

function getJoustOutcomeLabel(result: MissionJoustResult): string {
  if (result.outcome === "win") return "Joust won";
  if (result.outcome === "draw") return "Joust drawn";
  return "Joust lost";
}

function formatStatusEffect(effect: MissionStatusEffect): string {
  const power = effect.powerDelta ?? 0;
  const powerLabel = power === 0 ? "" : ` (${power > 0 ? "+" : ""}${power} power)`;
  return `${effect.label}${powerLabel} — ${effect.summary}`;
}

function getCheckBarPercent(current: number, needed: number, met: boolean): number {
  if (needed > 0) return Math.min(100, (current / needed) * 100);
  return met ? 100 : 0;
}

function getMissionDistrictAccessSummary(
  mission: MissionBoardEntry,
  weather: DistrictWeatherSnapshot | null,
): string {
  return getDistrictAccessSummary(mission.district, weather);
}

function getMissionPressureSummary(
  mission: MissionBoardEntry,
  weather: DistrictWeatherSnapshot | null,
  weatherByDistrict: Partial<Record<District, DistrictWeatherSnapshot | null>>,
): string {
  return `Access: ${getMissionDistrictAccessSummary(mission, weather)}. Weather: ${getMissionWeatherSummary(mission, weatherByDistrict)}`;
}

function isCounterRequirement(
  requirement: MissionRequirement,
  selectedCounterOptionId: string | null,
  mission: MissionBoardEntry,
): boolean {
  const selectedCounterOption = getMissionEncounter(mission)?.options.find((option) => option.id === selectedCounterOptionId) ?? null;
  return (selectedCounterOption?.requirements ?? []).some((entry) => (
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
      return `${currentAccessSummary} Only couriers whose wheels match that access rule count here.`;
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
  const [selectedCounterOptionId, setSelectedCounterOptionId] = useState<string | null>(null);
  const [pendingCounterOptionId, setPendingCounterOptionId] = useState<string | null>(null);
  const [selectedJoustTactic, setSelectedJoustTactic] = useState<JoustTactic | null>(null);
  const [missionResult, setMissionResult] = useState<MissionRunResponse | null>(null);
  const [streakExpanded, setStreakExpanded] = useState(false);
  const [resultPhase, setResultPhase] = useState<1 | 2 | 3>(1);
  const [logExpanded, setLogExpanded] = useState(false);

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

  const recommendedLaunchSelection = useMemo(() => {
    for (const mission of missions) {
      const eligibleDeck = decks.find((deck) => evaluateMissionDeck(deck, mission, weatherByDistrict, null).eligible);
      if (eligibleDeck) {
        return {
          missionId: mission.id,
          deckId: eligibleDeck.id,
        };
      }
    }
    return {
      missionId: missions[0]?.id ?? null,
      deckId: decks[0]?.id ?? null,
    };
  }, [decks, missions, weatherByDistrict]);

  useEffect(() => {
    const isSelectedMissionInvalid = !selectedMissionId || !missions.some((mission) => mission.id === selectedMissionId);
    if (isSelectedMissionInvalid && missions.length > 0) {
      setSelectedMissionId(recommendedLaunchSelection.missionId ?? missions[0].id);
    }
  }, [missions, recommendedLaunchSelection.missionId, selectedMissionId]);

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? missions[0] ?? null,
    [missions, selectedMissionId],
  );
  const preferredDeckIdForSelectedMission = useMemo(() => {
    if (!selectedMission) return recommendedLaunchSelection.deckId ?? null;
    return decks.find((deck) => evaluateMissionDeck(deck, selectedMission, weatherByDistrict, null).eligible)?.id
      ?? recommendedLaunchSelection.deckId
      ?? decks[0]?.id
      ?? null;
  }, [decks, recommendedLaunchSelection.deckId, selectedMission, weatherByDistrict]);

  useEffect(() => {
    if (selectedDeckId && decks.some((deck) => deck.id === selectedDeckId)) return;
    setSelectedDeckId(preferredDeckIdForSelectedMission);
  }, [decks, preferredDeckIdForSelectedMission, selectedDeckId]);

  useEffect(() => {
    const mission = missions.find((entry) => entry.id === selectedMissionId) ?? missions[0] ?? null;
    setSelectedCounterOptionId(mission?.selectedCounterOptionId ?? mission?.activeRun?.selectedCounterOptionId ?? null);
    setPendingCounterOptionId(null);
  }, [missions, selectedMissionId]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null,
    [decks, selectedDeckId],
  );
  const decksById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck])), [decks]);
  const deckEvaluations = useMemo(
    () => selectedMission
      ? decks.map((deck) => evaluateMissionDeck(deck, selectedMission, weatherByDistrict, isMissionResultRevealed(selectedMission) ? selectedCounterOptionId : null))
      : [],
    [decks, selectedCounterOptionId, selectedMission, weatherByDistrict],
  );
  const selectedEvaluation = useMemo(
    () => selectedMission && selectedDeck
      ? evaluateMissionDeck(selectedDeck, selectedMission, weatherByDistrict, isMissionResultRevealed(selectedMission) ? selectedCounterOptionId : null)
      : null,
    [selectedDeck, selectedCounterOptionId, selectedMission, weatherByDistrict],
  );
  const selectedEncounter = useMemo(
    () => (selectedMission ? getMissionEncounter(selectedMission) : null),
    [selectedMission],
  );
  const selectedCounterOption = useMemo(
    () => selectedEncounter?.options.find((option) => option.id === selectedCounterOptionId) ?? null,
    [selectedCounterOptionId, selectedEncounter],
  );
  const selectedDistrictWeather = useMemo(
    () => (selectedMission ? weatherByDistrict[selectedMission.district] ?? null : null),
    [selectedMission, weatherByDistrict],
  );
  const selectedResultRevealed = isMissionResultRevealed(selectedMission);
  const selectedAwaitingChoice = isMissionAwaitingChoice(selectedMission);
  const selectedRewards = useMemo(
    () => {
      if (!selectedMission) return { rewardXp: 0, rewardOzzies: 0 };
      if (
        selectedResultRevealed
        && typeof selectedMission.lastRunRewardXp === "number"
        && typeof selectedMission.lastRunRewardOzzies === "number"
      ) {
        return {
          rewardXp: selectedMission.lastRunRewardXp,
          rewardOzzies: selectedMission.lastRunRewardOzzies,
        };
      }
      if (selectedMission.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID) {
        return {
          rewardXp: Math.max(0, selectedMission.rewardXp - 20),
          rewardOzzies: Math.max(0, selectedMission.rewardOzzies - 20),
        };
      }
      return getMissionEffectiveRewards(selectedMission, selectedCounterOptionId, weatherByDistrict);
    },
    [selectedCounterOptionId, selectedMission, selectedResultRevealed, weatherByDistrict],
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
  const missionResultRewards = useMemo(
    () => (missionResult ? getMissionResultRewards(missionResult) : null),
    [missionResult],
  );
  const selectedDeckCardCount = selectedDeck?.cards.length ?? 0;
  const selectedDeckReadyCount = selectedEvaluation?.eligibleCardCount ?? 0;
  const selectedRouteLabel = getSelectedRouteLabel(selectedMission, selectedCounterOption, selectedResultRevealed);
  const selectedActiveCards = useMemo(() => {
    if (!selectedDeck || !selectedMission?.activeRun?.activeCardIds?.length) return [];
    const cardsById = new Map(selectedDeck.cards.map((card) => [card.id, card]));
    return selectedMission.activeRun.activeCardIds
      .map((cardId) => cardsById.get(cardId))
      .filter(Boolean) as typeof selectedDeck.cards;
  }, [selectedDeck, selectedMission]);
  const selectedJoustOption = useMemo(
    () => selectedEncounter?.options.find((option) => option.encounterType === "joust") ?? null,
    [selectedEncounter],
  );
  const availableJoustTactics = useMemo(
    () => (selectedDeck && selectedMission?.activeRun ? getMissionJoustTactics(selectedDeck, selectedMission.activeRun) : []),
    [selectedDeck, selectedMission],
  );
  useEffect(() => {
    if (availableJoustTactics.length === 0) {
      setSelectedJoustTactic(null);
      return;
    }
    setSelectedJoustTactic((current) => (
      current && availableJoustTactics.includes(current)
        ? current
        : availableJoustTactics[0]
    ));
  }, [availableJoustTactics]);
  const streakState = playerRewards?.dailyReward ?? null;
  const nextStreakReward = streakState
    ? { xp: streakState.nextRewardXp, ozzies: streakState.nextRewardOzzies }
    : getNextDailyReward(1, false);
  const missionResetCountdown = useMemo(
    () => formatDurationClock(getRemainingDurationMs(dailyResetAt, nowMs)),
    [dailyResetAt, nowMs],
  );
  const selectedOutcomeLabel = getMissionOutcomeLabel(selectedMission, selectedEvaluation?.eligible, selectedResultRevealed);
  const selectedOutcomeBadgeClass = getMissionOutcomeBadgeClass(
    selectedMission,
    selectedEvaluation?.eligible,
    selectedResultRevealed,
  );
  const isStep1Complete = Boolean(selectedDeck) || selectedResultRevealed || selectedAwaitingChoice;
  const isStep2Active = Boolean(selectedDeck) && !selectedAwaitingChoice && !selectedResultRevealed;
  const isStep2Complete = selectedResultRevealed || selectedAwaitingChoice;
  const activeMissionStep = selectedAwaitingChoice || selectedResultRevealed
    ? 3
    : selectedDeck
      ? 2
      : 1;
  const previousMissionStepRef = useRef(activeMissionStep);
  useEffect(() => {
    if (activeMissionStep === previousMissionStepRef.current) return;
    previousMissionStepRef.current = activeMissionStep;
  }, [activeMissionStep]);
  const selectedLaunchTips = useMemo(() => {
    if (!selectedMission) return [];
    const statusTips = (selectedEvaluation?.statusEffects ?? []).slice(0, 2).map((effect) => effect.summary);
    return [
      `${selectedMission.district} intel — ${getMissionPressureSummary(selectedMission, selectedDistrictWeather, weatherByDistrict)}`,
      selectedEvaluation?.eligible
        ? "This deck can launch clean, but the real tension now comes from the live counter window mid-run."
        : "Launch Run still works on a risky deck. Failure can sideline one courier for a short injury, breakdown, or arrest timeout.",
      ...(statusTips.length > 0 ? statusTips : ["Hardware effects and crew synergies can spike or blunt the live counter power."]),
    ];
  }, [selectedDistrictWeather, selectedEvaluation, selectedMission, weatherByDistrict]);

  const missionEligibilityByMissionId = useMemo((): Map<string, boolean> => {
    if (!selectedDeck) return new Map();
    return new Map(missions.map((mission) => [
      mission.id,
      evaluateMissionDeck(selectedDeck, mission, weatherByDistrict, null).eligible,
    ]));
  }, [missions, selectedDeck, weatherByDistrict]);

  const missionDistricts = useMemo(
    (): WorldLocation[] => missions.map((m) => m.district),
    [missions],
  );

  const missionMarkers = useMemo((): GeoAtlasMarker[] => {
    const seenDistricts = new Map<string, number>();
    return missions.map((mission) => {
      const seen = seenDistricts.get(mission.district) ?? 0;
      seenDistricts.set(mission.district, seen + 1);
      const offset = SAME_DISTRICT_OFFSETS[seen] ?? { x: 0, y: 0 };
      const presentation = getMissionPresentation(mission);
      const eligible = missionEligibilityByMissionId.get(mission.id);
      const tone: GeoAtlasMarker["tone"] = mission.status === "completed"
        ? "completed"
        : eligible === false
          ? "blocked"
          : undefined;
      return {
        id: mission.id,
        district: mission.district,
        label: presentation.operation,
        title: mission.title,
        active: mission.id === selectedMissionId,
        tone,
        offsetX: offset.x,
        offsetY: offset.y,
        onClick: () => setSelectedMissionId(mission.id),
      };
    });
  }, [missions, selectedMissionId, missionEligibilityByMissionId]);

  const handleRunMission = useCallback(async () => {
    if (!selectedMission || !selectedDeck) return;
    setRunningMissionId(selectedMission.id);
    setError(null);
    try {
      const result = await runMission(uid, selectedMission.id, selectedDeck.id, null, null, user?.email);
      setMissions((current) => current.map((mission) => (
        mission.id === result.mission.id ? result.mission : mission
      )));
      setProgression(result.progression);
      setSelectedDeckId(result.mission.selectedDeckId ?? selectedDeck.id);
      setSelectedCounterOptionId(result.mission.selectedCounterOptionId ?? null);
      if (result.awaitingChoice) {
        setMissionResult(null);
      } else {
        setResultPhase(1);
        setLogExpanded(false);
        setMissionResult(result);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to resolve mission.");
    } finally {
      setRunningMissionId(null);
    }
  }, [selectedDeck, selectedMission, uid, user]);

  const handleResolveEncounter = useCallback(async (counterOptionId: string, joustTactic?: JoustTactic | null) => {
    if (!selectedMission || !selectedDeck) return;
    setRunningMissionId(selectedMission.id);
    setPendingCounterOptionId(counterOptionId);
    setError(null);
    try {
      const result = await runMission(uid, selectedMission.id, selectedDeck.id, counterOptionId, joustTactic ?? null, user?.email);
      setMissions((current) => current.map((mission) => (
        mission.id === result.mission.id ? result.mission : mission
      )));
      setProgression(result.progression);
      setSelectedDeckId(result.mission.selectedDeckId ?? selectedDeck.id);
      setSelectedCounterOptionId(result.mission.selectedCounterOptionId ?? counterOptionId);
      if (!result.awaitingChoice) {
        setResultPhase(1);
        setLogExpanded(false);
        setMissionResult(result);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to resolve mission.");
    } finally {
      setRunningMissionId(null);
      setPendingCounterOptionId(null);
    }
  }, [selectedDeck, selectedMission, uid, user]);

  useEffect(() => {
    const IMPACT_FRAME_DURATION_MS = 2200;
    if (!missionResult || resultPhase !== 1) return;
    const timeout = window.setTimeout(() => setResultPhase(2), IMPACT_FRAME_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [missionResult, resultPhase]);

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

      {/* Mobile collapsible streak bar — desktop shows full grid */}
      <button
        type="button"
        className={`daily-ritual-bar${streakExpanded ? " daily-ritual-bar--expanded" : ""}`}
        onClick={() => setStreakExpanded((v) => !v)}
        aria-expanded={streakExpanded}
      >
        <span className="daily-ritual-bar__pill">🔥 {streakState?.currentStreak ?? 0}-day streak</span>
        <span className="daily-ritual-bar__pill">📋 {missions.length} contracts</span>
        <span className="daily-ritual-bar__pill">⏱ {missionResetCountdown}</span>
        {weeklyTheme && <span className="daily-ritual-bar__pill daily-ritual-bar__pill--theme">{weeklyTheme.label}</span>}
        <span className="daily-ritual-bar__toggle" aria-hidden="true">{streakExpanded ? "▲" : "▼"}</span>
      </button>

      <div className={`daily-ritual-strip daily-ritual-strip--collapsible${streakExpanded ? " daily-ritual-strip--open" : ""}`}>
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
          <div className="mission-atlas-layout">
            <div className="mission-atlas">
              <GeoAtlas
                section="australia"
                defaultAustraliaExpanded
                markers={missionMarkers}
                selectedDistrict={selectedMission?.district ?? null}
                focusDistricts={missionDistricts}
                showMarkerLabels="active"
              />
            </div>
            {/* Mobile horizontal chip row */}
            <div className="mission-chip-row" role="listbox" aria-label="Select a mission">
              {missions.map((mission) => {
                const eligible = missionEligibilityByMissionId.get(mission.id);
                const theme = DISTRICT_THEMES[mission.district];
                return (
                  <button
                    key={mission.id}
                    type="button"
                    role="option"
                    aria-selected={selectedMission?.id === mission.id}
                    className={[
                      "mission-chip",
                      selectedMission?.id === mission.id ? "mission-chip--active" : "",
                      mission.status === "completed" ? "mission-chip--completed" : "",
                      eligible === false && mission.status !== "completed" ? "mission-chip--blocked" : "",
                    ].filter(Boolean).join(" ")}
                    style={{ "--chip-accent": theme.accent, "--chip-glow": theme.glow } as CSSProperties}
                    onClick={() => setSelectedMissionId(mission.id)}
                  >
                    <DistrictBadge location={mission.district} size="sm" showLabel={false} decorative />
                    <span className="mission-chip__glyph">
                      {mission.status === "completed" ? "✓" : theme.glyph}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Desktop mission list */}
            <div className="mission-operation-grid">
              {missions.map((mission) => {
                const presentation = getMissionPresentation(mission);
                const eligible = missionEligibilityByMissionId.get(mission.id);
                const theme = DISTRICT_THEMES[mission.district];
                return (
                  <button
                    key={mission.id}
                    type="button"
                    className={[
                      "mission-operation-button",
                      selectedMission?.id === mission.id ? "mission-operation-button--active" : "",
                      mission.status === "completed" ? "mission-operation-button--completed" : "",
                      eligible === false && mission.status !== "completed" ? "mission-operation-button--blocked" : "",
                    ].filter(Boolean).join(" ")}
                    style={{ "--op-accent": theme.accent } as CSSProperties}
                    onClick={() => setSelectedMissionId(mission.id)}
                  >
                    <span className="mission-operation-button__label">
                      <DistrictBadge location={mission.district} size="sm" showLabel={false} decorative />
                      {presentation.operation}
                    </span>
                    <span className="mission-operation-button__status">
                      {mission.status === "completed" ? "✓" : theme.glyph}
                    </span>
                  </button>
                );
              })}
            </div>
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
                    <span className="mission-selector-card__stat mission-selector-card__stat--reward">
                      {selectedResultRevealed ? `+${selectedRewards.rewardOzzies} Oz` : "Mystery Oz"}
                    </span>
                    <span className="mission-selector-card__stat">
                      {selectedResultRevealed ? `+${selectedRewards.rewardXp} XP` : "Hidden XP"}
                    </span>
                    <span className={selectedOutcomeBadgeClass}>{selectedOutcomeLabel}</span>
                  </div>
                </div>
              </div>

              <MissionTransitScene
                missionId={selectedMission.id}
                locale={selectedLocale ?? selectedMission.district}
                localeSummary={
                  selectedPresentation.localeSummary
                  ?? `${selectedLocale ?? selectedMission.district} is running a local courier map with live counters and relay pressure.`
                }
                sceneEyebrow={selectedPresentation.operation}
                sceneTitle={selectedPresentation.patron}
                sceneBody={selectedPresentation.stakes}
                sceneTags={selectedPresentation.sceneTags}
                controlledBy={selectedLocaleLore?.controlledBy ?? selectedDistrictLore?.controlledBy ?? "Courier crews"}
                crewPressure={selectedLocaleLore?.crews.slice(0, 2).join(" · ") ?? selectedMission.district}
                crewCards={(selectedDeck?.cards ?? []).slice(0, 3)}
              />

              {/* Visual 3-node progress track */}
              <div className="mission-progress-track" aria-label="Mission steps">
                <div className={`mission-progress-node${activeMissionStep === 1 ? " mission-progress-node--active" : ""}${isStep1Complete ? " mission-progress-node--done" : ""}`}>
                  <div className="mission-progress-node__dot">
                    {isStep1Complete ? "✓" : "1"}
                  </div>
                  <span className="mission-progress-node__label">
                    {isStep1Complete ? (selectedDeck?.name ?? "Deck set") : "Pick deck"}
                  </span>
                </div>
                <div className={`mission-progress-track__line${isStep1Complete ? " mission-progress-track__line--done" : ""}`} aria-hidden="true" />
                <div className={`mission-progress-node${isStep2Active ? " mission-progress-node--active" : ""}${isStep2Complete ? " mission-progress-node--done" : ""}`}>
                  <div className="mission-progress-node__dot">
                    {isStep2Complete ? "✓" : "2"}
                  </div>
                  <span className="mission-progress-node__label">
                    {isStep2Complete ? "Launched" : "Launch run"}
                  </span>
                </div>
                <div className={`mission-progress-track__line${isStep2Complete ? " mission-progress-track__line--done" : ""}`} aria-hidden="true" />
                <div className={`mission-progress-node${activeMissionStep === 3 ? " mission-progress-node--active" : ""}${selectedResultRevealed ? " mission-progress-node--done" : ""}`}>
                  <div className="mission-progress-node__dot">
                    {selectedResultRevealed ? "✓" : "3"}
                  </div>
                  <span className="mission-progress-node__label">
                    {selectedResultRevealed ? "Resolved" : selectedAwaitingChoice ? "Choose now" : "Event"}
                  </span>
                </div>
              </div>

              {/* Inline "what's next" prompt */}
              <div className="mission-next-prompt">
                {selectedResultRevealed
                  ? <span className="mission-next-prompt__text mission-next-prompt__text--done">✓ Mission complete — rewards locked in</span>
                  : selectedAwaitingChoice
                    ? <span className="mission-next-prompt__text mission-next-prompt__text--event">⚡ Live event — pick a counter option below →</span>
                    : !selectedDeck
                      ? <span className="mission-next-prompt__text">Choose a deck below →</span>
                      : <span className="mission-next-prompt__text mission-next-prompt__text--ready">Deck selected — tap Launch Run to reveal the event →</span>
                }
              </div>

              <div className="mission-flow">
                {/* ── Accordion Step 1: Pick a deck ─────────────────── */}
                <section className={`mission-accordion-step${activeMissionStep === 1 || !selectedDeck ? " mission-accordion-step--active" : ""}${isStep1Complete ? " mission-accordion-step--done" : ""} mission-panel`}>
                  <div className="mission-accordion-step__header">
                    <div className="mission-accordion-step__title-block">
                      <span className="mission-stage__eyebrow">Step 1 — Pick a deck</span>
                      {isStep1Complete && (
                        <span className="mission-accordion-step__summary">✓ {selectedDeck?.name ?? "Deck set"}</span>
                      )}
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
                      const evaluatedDeck = decksById.get(evaluation.deckId);
                      return (
                        <button
                          key={evaluation.deckId}
                          type="button"
                          className={`mission-runner-card${selectedDeck?.id === evaluation.deckId ? " mission-runner-card--active" : ""}${evaluation.eligible ? " mission-runner-card--clean" : " mission-runner-card--risky"}`}
                          onClick={() => setSelectedDeckId(evaluation.deckId)}
                        >
                          <strong>{evaluation.deckName}</strong>
                          <div className="deck-item-preview mission-runner-card__preview" aria-hidden="true">
                            {(evaluatedDeck?.cards ?? []).slice(0, DECK_CARD_LIMIT).map((card, previewIdx, previewCards) => {
                              const relativePosition = previewIdx - (previewCards.length - 1) / 2;
                              const previewStyle = {
                                "--deck-preview-offset": `${relativePosition * MISSION_DECK_PREVIEW_OFFSET_PER_CARD}px`,
                                "--deck-preview-rotate": `${relativePosition * MISSION_DECK_PREVIEW_ROTATION_PER_CARD}deg`,
                                zIndex: previewIdx + 1,
                              } as CSSProperties;
                              return (
                                <div key={card.id} className="deck-preview-card" style={previewStyle}>
                                  <CardThumbnail card={card} width={80} height={112} />
                                </div>
                              );
                            })}
                          </div>
                          <span className="mission-selector-card__tagline">
                            {evaluatedDeck?.cards.length ?? 0} cards · {evaluation.eligibleCardCount} mission-ready
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

                {/* ── Accordion Step 2: Launch ───────────────────────── */}
                <section className={`mission-accordion-step${isStep2Active ? " mission-accordion-step--active" : ""}${isStep2Complete ? " mission-accordion-step--done" : ""} mission-panel`}>
                  <div className="mission-accordion-step__header">
                    <div className="mission-accordion-step__title-block">
                      <span className="mission-stage__eyebrow">Step 2 — Launch the run</span>
                      {isStep2Complete && (
                        <span className="mission-accordion-step__summary">✓ Run in motion</span>
                      )}
                    </div>
                    <div className="mission-stage__actions">
                      <button
                        className="btn-primary mission-launch-button"
                        onClick={handleRunMission}
                        disabled={
                          runningMissionId === selectedMission.id ||
                          selectedMission.status === "completed" ||
                          !selectedDeck ||
                          selectedAwaitingChoice
                        }
                      >
                        {selectedMission.status === "completed"
                          ? "Mission Cleared"
                          : runningMissionId === selectedMission.id
                            ? "Running…"
                            : selectedAwaitingChoice
                              ? "Awaiting Counter"
                              : "Launch Run"}
                      </button>
                    </div>
                  </div>

                  {selectedResultRevealed && (
                  <div className="mission-outcome-grid">
                    <article className="mission-outcome-card">
                      <div className="mission-result">
                        <div className="mission-result__hero">
                          <div className="mission-result__headline">{selectedMission.tagline}</div>
                          <span className={selectedOutcomeBadgeClass}>{selectedOutcomeLabel}</span>
                        </div>
                        <div className="mission-result__rewards">
                          <div className="mission-result__reward-card mission-result__reward-card--xp">
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
                          <span className="mission-weather__eyebrow">District pressure</span>
                          <strong className="mission-weather__title">{selectedMission.district}</strong>
                          <p className="mission-weather__body">
                            {getMissionPressureSummary(selectedMission, selectedDistrictWeather, weatherByDistrict)}
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
                        {(selectedCounterOption || selectedMission.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID) && (
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Counter used</span>
                            <span className="mission-stat-value">{selectedRouteLabel}</span>
                          </div>
                        )}
                        {selectedMission.lastRunJoustResult && (
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Joust</span>
                            <span className="mission-stat-value">{getJoustOutcomeLabel(selectedMission.lastRunJoustResult)}</span>
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
                        {(selectedEvaluation?.results ?? getDefaultRequirementResults(selectedMission, selectedCounterOptionId)).map((result) => (
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
                            <div className="mission-check-card__bar" aria-hidden="true">
                              <div
                                className={`mission-check-card__bar-fill${result.met ? "" : " mission-check-card__bar-fill--blocked"}`}
                                style={{ width: `${getCheckBarPercent(result.current, result.needed, result.met)}%` }}
                              />
                            </div>
                            <span className="mission-check-card__meta">
                              {isCounterRequirement(result.requirement, selectedCounterOptionId, selectedMission) ? "Live counter check" : "Base contract check"}
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
                  )}

                  {selectedResultRevealed && selectedEvaluation && !selectedEvaluation.eligible && (
                    <p className="mission-warning">{selectedEvaluation.summary}</p>
                  )}
                  {selectedMission.lastRunSummary && (
                    <p className="mission-warning">{selectedMission.lastRunSummary}</p>
                  )}
                </section>

                {/* ── Accordion Step 3: Live event ───────────────────── */}
                {selectedEncounter && (selectedAwaitingChoice || selectedResultRevealed) && (
                  <section className={`mission-accordion-step${activeMissionStep === 3 ? " mission-accordion-step--active" : ""}${selectedResultRevealed ? " mission-accordion-step--done" : ""} mission-panel mission-fork`}>
                    <div className="mission-accordion-step__header">
                      <div className="mission-accordion-step__title-block">
                        <span className="mission-stage__eyebrow">Step 3 — Live event</span>
                        {selectedResultRevealed && (
                          <span className="mission-accordion-step__summary">✓ Resolved via {selectedRouteLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className="mission-fork__header">
                      <span className="mission-fork__badge">{selectedEncounter.badge}</span>
                      <p className="mission-fork__prompt">
                        {selectedAwaitingChoice
                          ? selectedMission.activeRun?.summary ?? selectedEncounter.threat
                          : selectedEncounter.prompt}
                      </p>
                    </div>
                    {selectedAwaitingChoice && (
                      <>
                        <div className="mission-intel-tags">
                          {selectedActiveCards.map((card) => (
                            <span key={`${selectedMission.id}-${card.id}`} className="mission-intel-tag">
                              {card.identity.name}
                            </span>
                          ))}
                          {selectedActiveCards.length === 0 && (
                            <span className="mission-intel-tag">No active hand revealed</span>
                          )}
                        </div>
                        {(selectedMission.activeRun?.statusEffects?.length ?? 0) > 0 && (
                          <ul className="mission-intel-list">
                            {(selectedMission.activeRun?.statusEffects ?? []).map((effect) => (
                              <li key={`${selectedMission.id}-${effect.id}`}>{formatStatusEffect(effect)}</li>
                            ))}
                          </ul>
                        )}
                        {selectedJoustOption && availableJoustTactics.length > 0 && (
                          <div className="mission-joust-picker">
                            <div>
                              <span className="mission-stage__eyebrow">Pick joust tactic</span>
                              <p className="mission-fork__prompt">
                                {getCounterOptionRequirementText(selectedJoustOption)}
                              </p>
                            </div>
                            <div className="mission-intel-tags" role="group" aria-label="Joust tactic selection">
                              {availableJoustTactics.map((tactic) => (
                                <button
                                  key={`${selectedMission.id}-joust-${tactic}`}
                                  type="button"
                                  className={`mission-intel-tag mission-intel-tag--button${selectedJoustTactic === tactic ? " mission-intel-tag--active" : ""}`}
                                  onClick={() => setSelectedJoustTactic(tactic)}
                                  aria-pressed={selectedJoustTactic === tactic}
                                >
                                  {formatJoustTacticLabel(tactic)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="mission-fork__options">
                      {selectedEncounter.options.map((option) => {
                        const isActive = selectedCounterOption?.id === option.id || pendingCounterOptionId === option.id;
                        const isPending = pendingCounterOptionId === option.id;
                        const rewardType = option.rewardXpDelta ? "xp" : option.rewardOzziesDelta ? "ozzies" : null;
                        const toneClass = !option.available
                          ? "mission-fork__option--tone-blocked"
                          : rewardType === "xp"
                            ? "mission-fork__option--tone-xp"
                            : rewardType === "ozzies"
                              ? "mission-fork__option--tone-ozzies"
                              : "mission-fork__option--tone-neutral";
                        return (
                          <button
                            key={`${selectedMission.id}-${option.id}`}
                            type="button"
                            className={[
                              "mission-fork__option",
                              toneClass,
                              isActive ? "mission-fork__option--active" : "",
                              isPending ? "mission-fork__option--pending" : "",
                            ].filter(Boolean).join(" ")}
                            onClick={() => handleResolveEncounter(
                              option.id,
                              option.encounterType === "joust" ? selectedJoustTactic : null,
                            )}
                            aria-pressed={selectedCounterOption?.id === option.id}
                            disabled={
                              selectedAwaitingChoice
                                ? !option.available || runningMissionId === selectedMission.id
                                : true
                            }
                          >
                            <span className="mission-fork__option-label">
                              {option.encounterType === "joust" ? "⚔️ " : rewardType === "ozzies" ? "💰 " : rewardType === "xp" ? "⚡ " : ""}
                              {option.label}
                            </span>
                            <span className="mission-fork__option-meta">{getEncounterOptionMetaText(option, selectedAwaitingChoice)}</span>
                            <span className="mission-fork__option-desc">{option.description}</span>
                            {(selectedAwaitingChoice || selectedResultRevealed) && (
                              <span className="mission-fork__option-desc">
                                {getCounterOptionRequirementText(option)}
                              </span>
                            )}
                            {(selectedAwaitingChoice || selectedResultRevealed) && (option.rewardXpDelta || option.rewardOzziesDelta) && (
                              <span className="mission-fork__option-desc">
                                {option.rewardXpDelta ? `${formatForkRewardDelta(option.rewardXpDelta)} XP` : null}
                                {option.rewardXpDelta && option.rewardOzziesDelta ? " · " : null}
                                {option.rewardOzziesDelta ? `${formatForkRewardDelta(option.rewardOzziesDelta)} Oz` : null}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {selectedAwaitingChoice && (
                        <button
                          type="button"
                          className={`mission-fork__option mission-fork__option--tone-exit${pendingCounterOptionId === HARD_CUTOUT_COUNTER_ID ? " mission-fork__option--active mission-fork__option--pending" : ""}`}
                          onClick={() => handleResolveEncounter(HARD_CUTOUT_COUNTER_ID)}
                          disabled={runningMissionId === selectedMission.id}
                        >
                          <span className="mission-fork__option-label">🚪 Emergency exit</span>
                          <span className="mission-fork__option-meta">Always available</span>
                          <span className="mission-fork__option-desc">Finish safely with smaller rewards.</span>
                        </button>
                      )}
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
                  <span className="mission-intel-card__label">{selectedResultRevealed ? "Reward profile" : "Black-box payout"}</span>
                  <ul className="mission-intel-list">
                    {selectedResultRevealed
                      ? selectedPresentation.rewardFocus.map((item) => (
                        <li key={`${selectedMission.id}-${item}`}>{item}</li>
                      ))
                      : [
                        "Payout odds stay hidden until the run resolves",
                        "Live counters can add extra XP, Ozzies, or force a clipped cutout",
                        "The result modal reveals what the deck actually earned",
                      ].map((item) => (
                        <li key={`${selectedMission.id}-${item}`}>{item}</li>
                      ))}
                  </ul>
                  <p className="mission-intel-card__quote">
                    Atmosphere: {selectedDistrictLore?.atmosphere ?? selectedMission.tagline}
                  </p>
                </article>
                <article className="mission-intel-card">
                  <span className="mission-intel-card__label">{selectedResultRevealed ? "Run breakdown" : "Pre-run rumors"}</span>
                    <ul className="mission-intel-list">
                      {selectedLaunchTips.slice(0, 3).map((tip, index) => (
                        <li key={`${selectedMission.id}-tip-${index}`}>{tip}</li>
                      ))}
                    </ul>
                  <p className="mission-intel-card__quote">
                    {selectedResultRevealed
                      ? "The curtain is open now. Use the breakdown to tune the next deck."
                      : "Launch Run stays live after deck pick. The exact win/loss math reveals only after play."}
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

            {/* ── Phase 1: Impact Frame ─────────────────────────────── */}
            {resultPhase === 1 && (
              <div
                className="mission-result-impact"
                onClick={() => setResultPhase(2)}
                role="button"
                tabIndex={0}
                aria-label="Tap to skip to rewards"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setResultPhase(2); }}
              >
                <div className="mission-result-impact__glyph" aria-hidden="true">
                  {DISTRICT_THEMES[missionResult.mission.district].glyph}
                </div>
                <h3 id="mission-result-title" className="mission-result-impact__headline">
                  {missionResult.rewardGranted
                    ? getMissionPresentation(missionResult.mission).successLabel
                    : getMissionPresentation(missionResult.mission).failureLabel}
                </h3>
                <div className="mission-result-impact__rewards">
                  {missionResult.rewardGranted && missionResultRewards && (
                    <>
                      <span className="mission-result-impact__reward mission-result-impact__reward--xp">
                        +{missionResultRewards.rewardXp} XP
                      </span>
                      <span className="mission-result-impact__reward mission-result-impact__reward--oz">
                        +{missionResultRewards.rewardOzzies} Oz
                      </span>
                    </>
                  )}
                </div>
                <span className="mission-result-impact__skip">Tap anywhere to continue →</span>
              </div>
            )}

            {/* ── Phase 2: Reward cards + summary ──────────────────── */}
            {resultPhase >= 2 && (
              <>
                <div className="mission-result-popup__summary">
                  <span className="mission-selector-card__district">
                    <DistrictBadge location={missionResult.mission.district} size="sm" />
                  </span>
                  <h3 id="mission-result-title" className="mission-selector-card__name">
                    {missionResult.rewardGranted
                      ? getMissionPresentation(missionResult.mission).successLabel
                      : getMissionPresentation(missionResult.mission).failureLabel}
                  </h3>
                </div>
                <div className="mission-result__rewards">
                  {missionResult.rewardGranted && missionResultRewards ? (
                    <>
                      <div className="mission-result__reward-card mission-result__reward-card--xp">
                        <span className="mission-result__reward-label">Mission XP</span>
                        <strong className="mission-result__reward-value">
                          +{missionResultRewards.rewardXp}
                        </strong>
                      </div>
                      <div className="mission-result__reward-card mission-result__reward-card--ozzies">
                        <span className="mission-result__reward-label">Ozzies</span>
                        <strong className="mission-result__reward-value">
                          +{missionResultRewards.rewardOzzies}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mission-result__reward-card">
                        <span className="mission-result__reward-label">Chosen deck</span>
                        <strong className="mission-result__reward-value">
                          {missionResult.mission.selectedDeckName ?? missionResult.evaluation.deckName}
                        </strong>
                      </div>
                      <div className="mission-result__reward-card mission-result__reward-card--ozzies">
                        <span className="mission-result__reward-label">Route</span>
                        <strong className="mission-result__reward-value">
                          {missionResult.mission.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID
                            ? HARD_CUTOUT_LABEL
                            : getMissionEncounter(missionResult.mission)?.options.find((option) => option.id === missionResult.mission.selectedCounterOptionId)?.label
                              ?? MAIN_ROUTE_LABEL}
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                {/* Route + joust compact summary line */}
                <div className="mission-result-popup__meta-line">
                  <span>via {missionResult.mission.selectedCounterOptionId === HARD_CUTOUT_COUNTER_ID
                    ? HARD_CUTOUT_LABEL
                    : getMissionEncounter(missionResult.mission)?.options.find((o) => o.id === missionResult.mission.selectedCounterOptionId)?.label
                      ?? MAIN_ROUTE_LABEL}</span>
                  {missionResult.mission.lastRunJoustResult && (
                    <span> · Joust: {getJoustOutcomeLabel(missionResult.mission.lastRunJoustResult)} vs {missionResult.mission.lastRunJoustResult.rivalName}</span>
                  )}
                </div>

                {/* ── Phase 3: Expandable log drawer ─────────────────── */}
                <button
                  type="button"
                  className={`mission-result-log-toggle${logExpanded ? " mission-result-log-toggle--open" : ""}`}
                  onClick={() => setLogExpanded((v) => !v)}
                  aria-expanded={logExpanded}
                >
                  {logExpanded ? "Hide run log ▲" : "See full run log ▾"}
                </button>
                {logExpanded && (
                  <div className="mission-result-log-drawer">
                    <ul className="mission-log">
                      {missionResultLog.map((entry) => (
                        <li
                          key={`${missionResult.mission.id}-${entry.text}`}
                          className={entry.kind !== "default" ? `mission-log__entry mission-log__entry--${entry.kind}` : undefined}
                        >
                          {entry.text}
                        </li>
                      ))}
                    </ul>
                    {missionResult.mission.lastRunJoustResult && (
                      <div className="mission-result-popup__panel">
                        <span className="mission-result-popup__eyebrow">District joust</span>
                        <div className="mission-stats">
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Outcome</span>
                            <span className="mission-stat-value">{getJoustOutcomeLabel(missionResult.mission.lastRunJoustResult)}</span>
                          </div>
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Matchup</span>
                            <span className="mission-stat-value">
                              {missionResult.mission.lastRunJoustResult.playerName} vs {missionResult.mission.lastRunJoustResult.rivalName}
                            </span>
                          </div>
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Tactics</span>
                            <span className="mission-stat-value">
                              {formatJoustTacticLabel(missionResult.mission.lastRunJoustResult.playerTactic)} / {formatJoustTacticLabel(missionResult.mission.lastRunJoustResult.rivalTactic)}
                            </span>
                          </div>
                          <div className="mission-stat-row">
                            <span className="mission-stat-label">Bonus</span>
                            <span className="mission-stat-value">
                              +{missionResult.mission.lastRunJoustResult.rewardXpBonus} XP · +{missionResult.mission.lastRunJoustResult.rewardOzziesBonus} Oz
                            </span>
                          </div>
                        </div>
                        <p className="mission-intel-card__quote">{missionResult.mission.lastRunJoustResult.narration}</p>
                      </div>
                    )}
                    {(missionResult.mission.lastRunCardOutcomes?.length ?? 0) > 0 && (
                      <div className="mission-result-popup__panel">
                        <span className="mission-result-popup__eyebrow">Maintenance fallout</span>
                        <ul className="mission-intel-list">
                          {(missionResult.mission.lastRunCardOutcomes ?? []).map((outcome) => (
                            <li key={`${missionResult.mission.id}-${outcome.cardId}-${outcome.label}`}>{outcome.detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
