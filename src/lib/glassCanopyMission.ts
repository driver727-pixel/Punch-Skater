import { calculateBoardStats, getBoardStatBonuses } from "./boardBuilder";
import type { CardPayload } from "./types";
import type { BoardConfig, BoardLoadout, WheelType } from "./boardBuilder";

type MissionCheckStat = "speed" | "acceleration" | "stealth" | "batteryRemaining";
type MissionEffectStat = MissionCheckStat | "health" | "heatLevel";

export interface MissionPlayerStats {
  speed: number;
  acceleration: number;
  stealth: number;
  range: number;
  batteryRemaining: number;
  health: number;
  heatLevel: number;
}

export interface MissionPlayerDeck {
  /**
   * Optional pre-aggregated mission stats from the equipped 6-card deck.
   * When omitted, the runner derives what it can from the board config/loadout.
   */
  stats?: Partial<Pick<MissionPlayerStats, "speed" | "acceleration" | "stealth" | "range" | "batteryRemaining" | "health">>;
  /** Existing board builder config, used for wheel checks and derived stats. */
  board?: BoardConfig;
  /** Existing board builder loadout. When absent, it will be derived from `board`. */
  boardLoadout?: Partial<BoardLoadout>;
  /** Escape hatch for callers that only need to provide the active wheel type. */
  wheelType?: WheelType;
}

export interface MissionItemModifier {
  stat: Extract<MissionEffectStat, "speed" | "stealth">;
  amount: number;
  duration: "mission";
}

export interface MissionItem {
  id: string;
  name: string;
  phase: number;
  description: string;
  modifiers?: MissionItemModifier[];
}

interface MissionRequirementAll {
  kind: "all";
  requirements: MissionRequirement[];
}

interface MissionRequirementStat {
  kind: "stat";
  stat: MissionCheckStat;
  minimum: number;
  affectedByHeat?: boolean;
}

interface MissionRequirementWheel {
  kind: "wheel";
  wheelType: WheelType;
}

type MissionRequirement = MissionRequirementAll | MissionRequirementStat | MissionRequirementWheel;

interface MissionAdjustEffect {
  type: "adjust";
  stat: MissionEffectStat;
  amount: number;
}

interface MissionAdjustPercentEffect {
  type: "adjustPercent";
  stat: Extract<MissionEffectStat, "batteryRemaining" | "health">;
  percent: number;
}

interface MissionAddItemEffect {
  type: "addItem";
  item: MissionItem;
}

type MissionEffect = MissionAdjustEffect | MissionAdjustPercentEffect | MissionAddItemEffect;

interface MissionNarrativeContext {
  playerStats: MissionPlayerStats;
  wheelType?: WheelType;
  inventory: MissionItem[];
}

interface MissionStepBase {
  id: string;
  name: string;
  phase: number;
}

interface MissionHazardStep extends MissionStepBase {
  kind: "hazard";
  hazardType: "Passive Security" | "Environmental Hazard" | "Active Enemy" | "Endurance Check";
  requirement: MissionRequirement;
  successText: string | ((context: MissionNarrativeContext) => string);
  failureText: string | ((context: MissionNarrativeContext) => string);
  onSuccess?: MissionEffect[];
  onFailure?: MissionEffect[];
  endsMissionOnFailure?: boolean;
}

interface MissionItemStep extends MissionStepBase {
  kind: "item";
  item: MissionItem;
  narrativeText: string;
  onResolve?: MissionEffect[];
}

type MissionStep = MissionHazardStep | MissionItemStep;

interface MissionDefinition {
  id: string;
  name: string;
  steps: MissionStep[];
}

export interface MissionResult {
  success: boolean;
  playerStats: MissionPlayerStats;
  inventory: MissionItem[];
  missionLog: string[];
}

export interface GlassCanopyMissionPreview {
  playerDeck: MissionPlayerDeck;
  runnerCard: CardPayload | null;
  runnerLoadout: BoardLoadout | null;
  stats: MissionPlayerStats;
}

interface MissionState {
  playerStats: MissionPlayerStats;
  wheelType?: WheelType;
  inventory: MissionItem[];
  missionLog: string[];
  success: boolean;
}

function roundMissionStat(value: number): number {
  return Number(value.toFixed(1));
}

function clampMissionStat(value: number): number {
  return roundMissionStat(Math.max(value, 0));
}

function syncDerivedResources(stats: MissionPlayerStats): void {
  stats.health = clampMissionStat(stats.health);
  stats.batteryRemaining = clampMissionStat(stats.batteryRemaining);
  stats.range = roundMissionStat(stats.batteryRemaining);
}

function resolveBoardLoadout(playerDeck: MissionPlayerDeck): Partial<BoardLoadout> {
  if (playerDeck.boardLoadout) {
    return playerDeck.boardLoadout;
  }

  if (playerDeck.board) {
    return calculateBoardStats(playerDeck.board);
  }

  return {};
}

function calculateStartingStats(playerDeck: MissionPlayerDeck): MissionPlayerStats {
  const loadout = resolveBoardLoadout(playerDeck);
  const boardBonuses = playerDeck.board ? getBoardStatBonuses(playerDeck.board) : {};
  const suppliedStats = playerDeck.stats ?? {};
  const batteryRemaining = suppliedStats.batteryRemaining ?? suppliedStats.range ?? loadout.range ?? 0;

  const stats: MissionPlayerStats = {
    speed: suppliedStats.speed ?? loadout.speed ?? 0,
    acceleration: suppliedStats.acceleration ?? loadout.acceleration ?? 0,
    stealth: suppliedStats.stealth ?? boardBonuses.stealth ?? 0,
    range: batteryRemaining,
    batteryRemaining,
    health: suppliedStats.health ?? 100,
    heatLevel: 0,
  };

  syncDerivedResources(stats);

  return stats;
}

function buildNarrativeContext(state: MissionState): MissionNarrativeContext {
  return {
    playerStats: { ...state.playerStats },
    wheelType: state.wheelType,
    inventory: [...state.inventory],
  };
}

function getEffectiveMinimum(requirement: MissionRequirementStat, state: MissionState): number {
  return requirement.minimum + (requirement.affectedByHeat ? state.playerStats.heatLevel : 0);
}

function evaluateRequirement(requirement: MissionRequirement, state: MissionState): boolean {
  switch (requirement.kind) {
    case "all":
      return requirement.requirements.every((nextRequirement) => evaluateRequirement(nextRequirement, state));
    case "stat":
      return state.playerStats[requirement.stat] >= getEffectiveMinimum(requirement, state);
    case "wheel":
      return state.wheelType === requirement.wheelType;
    default:
      return false;
  }
}

function applyEffect(effect: MissionEffect, state: MissionState): void {
  switch (effect.type) {
    case "adjust":
      state.playerStats[effect.stat] = roundMissionStat(state.playerStats[effect.stat] + effect.amount);
      syncDerivedResources(state.playerStats);
      return;
    case "adjustPercent": {
      const currentValue = state.playerStats[effect.stat];
      const nextValue = currentValue + (currentValue * effect.percent) / 100;
      state.playerStats[effect.stat] = roundMissionStat(nextValue);
      syncDerivedResources(state.playerStats);
      return;
    }
    case "addItem":
      state.inventory.push(effect.item);
      for (const modifier of effect.item.modifiers ?? []) {
        state.playerStats[modifier.stat] = roundMissionStat(state.playerStats[modifier.stat] + modifier.amount);
      }
      syncDerivedResources(state.playerStats);
      return;
    default:
      return;
  }
}

function applyEffects(effects: MissionEffect[] | undefined, state: MissionState): void {
  for (const effect of effects ?? []) {
    applyEffect(effect, state);
  }
}

function formatNarrativeText(
  value: string | ((context: MissionNarrativeContext) => string),
  state: MissionState,
): string {
  return typeof value === "function" ? value(buildNarrativeContext(state)) : value;
}

function runMission(mission: MissionDefinition, playerDeck: MissionPlayerDeck): MissionResult {
  const state: MissionState = {
    playerStats: calculateStartingStats(playerDeck),
    wheelType: playerDeck.wheelType ?? playerDeck.board?.wheels,
    inventory: [],
    missionLog: [`Mission start: ${mission.name}.`],
    success: true,
  };

  for (const step of mission.steps) {
    if (step.kind === "item") {
      applyEffects(step.onResolve, state);
      state.missionLog.push(`Phase ${step.phase}: ${step.narrativeText}`);
      continue;
    }

    const passed = evaluateRequirement(step.requirement, state);

    if (passed) {
      applyEffects(step.onSuccess, state);
      state.missionLog.push(`Phase ${step.phase}: ${formatNarrativeText(step.successText, state)}`);
      continue;
    }

    applyEffects(step.onFailure, state);
    state.missionLog.push(`Phase ${step.phase}: ${formatNarrativeText(step.failureText, state)}`);

    if (step.endsMissionOnFailure) {
      state.success = false;
      break;
    }
  }

  return {
    success: state.success,
    playerStats: { ...state.playerStats },
    inventory: [...state.inventory],
    missionLog: [...state.missionLog],
  };
}

export const LobbyDrone: MissionHazardStep = {
  id: "lobby-drone",
  kind: "hazard",
  name: "Lobby Patrol Drone",
  phase: 1,
  hazardType: "Passive Security",
  requirement: {
    kind: "all",
    requirements: [
      { kind: "stat", stat: "stealth", minimum: 7 },
      { kind: "wheel", wheelType: "Urethane" },
    ],
  },
  successText:
    "You slipped past the Lobby Patrol Drone on a whisper-quiet line, leaving the penthouse lobby cold and blind.",
  failureText: ({ playerStats, wheelType }) =>
    `The Lobby Patrol Drone tagged your approach${wheelType ? ` with ${wheelType} wheels under you` : ""}. Heat spikes by +2 to ${playerStats.heatLevel}, making Phase 3 and 4 checks ${playerStats.heatLevel} points harder.`,
  onFailure: [{ type: "adjust", stat: "heatLevel", amount: 2 }],
};

export const ThePayload: MissionItem = {
  id: "the-payload",
  name: "The Payload",
  phase: 2,
  description: "The stolen data chip is bulky, hot, and impossible to hide cleanly.",
  modifiers: [{ stat: "stealth", amount: -2, duration: "mission" }],
};

export const BlastDoors: MissionHazardStep = {
  id: "blast-doors",
  kind: "hazard",
  name: "Security Blast Doors",
  phase: 3,
  hazardType: "Environmental Hazard",
  requirement: {
    kind: "stat",
    stat: "acceleration",
    minimum: 8,
    affectedByHeat: true,
  },
  successText:
    "You hit the throttle, threaded the narrowing gap, and cleared the Security Blast Doors before the locks engaged.",
  failureText: ({ playerStats }) =>
    `The doors clipped your rear truck. Board integrity drops to ${playerStats.health}% and your bent setup leaves you at ${playerStats.speed} SPD for the rest of the run.`,
  onFailure: [
    { type: "adjustPercent", stat: "health", percent: -15 },
    { type: "adjust", stat: "speed", amount: -1 },
  ],
};

export const AeroFuzzDrone: MissionHazardStep = {
  id: "aero-fuzz-drone",
  kind: "hazard",
  name: "Aero-Fuzz Pursuit Drone",
  phase: 4,
  hazardType: "Active Enemy",
  requirement: {
    kind: "stat",
    stat: "speed",
    minimum: 8,
    affectedByHeat: true,
  },
  successText:
    "You match the Aero-Fuzz drone stride for stride, then disappear down the neon canyons before it can lock a tether.",
  failureText: ({ playerStats }) =>
    `The Aero-Fuzz drone lands a taser-tether. You dump charge to break free, leaving ${playerStats.batteryRemaining} RNG in the pack.`,
  onFailure: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -20 }],
};

export const TheEscape: MissionHazardStep = {
  id: "the-escape",
  kind: "hazard",
  name: "The Transitional Zone",
  phase: 4,
  hazardType: "Endurance Check",
  requirement: {
    kind: "stat",
    stat: "batteryRemaining",
    minimum: 15,
    affectedByHeat: true,
  },
  successText: ({ playerStats }) =>
    `You cross the Transitional Zone on fumes but make the safehouse. Final battery reserve: ${playerStats.batteryRemaining} RNG.`,
  failureText: ({ playerStats }) =>
    `Your board dies in the Transitional Zone at ${playerStats.batteryRemaining} RNG. You have to ditch the board or get busted with the data chip in hand.`,
  onSuccess: [{ type: "adjust", stat: "batteryRemaining", amount: -15 }],
  onFailure: [{ type: "adjust", stat: "batteryRemaining", amount: -15 }],
  endsMissionOnFailure: true,
};

const GLASS_CANOPY_MISSION: MissionDefinition = {
  id: "operation-glass-canopy",
  name: "Operation: Glass Canopy",
  steps: [
    LobbyDrone,
    {
      id: "payload-acquired",
      kind: "item",
      name: "The Payload",
      phase: 2,
      item: ThePayload,
      narrativeText:
        "You lift the data chip from the penthouse vault. The Payload goes into your inventory and drags your active STEALTH down by 2 for the rest of the run.",
      onResolve: [{ type: "addItem", item: ThePayload }],
    },
    BlastDoors,
    AeroFuzzDrone,
    TheEscape,
  ],
};

export function runGlassCanopyMission(playerDeck: MissionPlayerDeck): MissionResult {
  return runMission(GLASS_CANOPY_MISSION, playerDeck);
}

function roundPreviewStat(value: number): number {
  return Number(value.toFixed(1));
}

function resolveRunnerCard(cards: CardPayload[], runnerCardId?: string): CardPayload | null {
  if (cards.length === 0) return null;
  return cards.find((card) => card.id === runnerCardId) ?? cards[0];
}

export function buildGlassCanopyMissionPreview(
  cards: CardPayload[],
  runnerCardId?: string,
): GlassCanopyMissionPreview {
  const runnerCard = resolveRunnerCard(cards, runnerCardId);
  const runnerBoard = runnerCard?.board;
  const runnerLoadout = runnerCard?.boardLoadout ?? (runnerBoard ? calculateBoardStats(runnerBoard) : null);
  const runnerBoardBonuses = runnerBoard ? getBoardStatBonuses(runnerBoard) : {};

  if (!runnerCard) {
    return {
      playerDeck: {},
      runnerCard: null,
      runnerLoadout: null,
      stats: calculateStartingStats({}),
    };
  }

  const deckSize = cards.length || 1;
  const totalStats = cards.reduce(
    (acc, card) => {
      acc.speed += card.stats.speed;
      acc.stealth += card.stats.stealth;
      acc.tech += card.stats.tech;
      acc.grit += card.stats.grit;
      acc.rep += card.stats.rep;
      return acc;
    },
    { speed: 0, stealth: 0, tech: 0, grit: 0, rep: 0 },
  );

  const averageSpeed = totalStats.speed / deckSize;
  const averageStealth = totalStats.stealth / deckSize;
  const averageTech = totalStats.tech / deckSize;
  const averageGrit = totalStats.grit / deckSize;
  const averageRep = totalStats.rep / deckSize;

  const playerDeck: MissionPlayerDeck = {
    board: runnerBoard,
    boardLoadout: runnerLoadout ?? undefined,
    wheelType: runnerBoard?.wheels,
    stats: {
      speed: roundPreviewStat(averageSpeed * 0.6 + (runnerLoadout?.speed ?? 0) * 0.7 + averageRep * 0.15),
      acceleration: roundPreviewStat(averageTech * 0.45 + averageGrit * 0.25 + (runnerLoadout?.acceleration ?? 0) * 0.7),
      stealth: roundPreviewStat(averageStealth * 0.75 + averageTech * 0.15 + (runnerBoardBonuses.stealth ?? 0)),
      batteryRemaining: roundPreviewStat((runnerLoadout?.range ?? 0) + averageTech + averageGrit / 2 + deckSize),
      range: roundPreviewStat((runnerLoadout?.range ?? 0) + averageTech + averageGrit / 2 + deckSize),
      health: roundPreviewStat(100 + averageGrit * 3),
    },
  };

  return {
    playerDeck,
    runnerCard,
    runnerLoadout,
    stats: calculateStartingStats(playerDeck),
  };
}
