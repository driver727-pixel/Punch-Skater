import { calculateBoardStats, getBoardStatBonuses } from "./boardBuilder";
import { MAX_SINGLE_STAT, LEGACY_STAT_MAX } from "./generator";
import type { CardPayload, District } from "./types";
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

export interface MissionForkOption {
  label: string;
  description: string;
  narrativeText: string | ((context: MissionNarrativeContext) => string);
  effects?: MissionEffect[];
}

interface MissionForkStep extends MissionStepBase {
  kind: "fork";
  prompt: string;
  optionA: MissionForkOption;
  optionB: MissionForkOption;
}

export type ForkChoice = "A" | "B";

type MissionStep = MissionHazardStep | MissionItemStep | MissionForkStep;

interface MissionDefinition {
  id: string;
  name: string;
  steps: MissionStep[];
}

export interface DistrictMissionDefinition extends MissionDefinition {
  district: District;
  pinLabel: string;
  tagline: string;
  briefing: string;
  checkTags: string[];
}

export interface MissionResult {
  success: boolean;
  playerStats: MissionPlayerStats;
  inventory: MissionItem[];
  missionLog: string[];
}

export interface MissionForkPrompt {
  kind: "fork";
  forkStepId: string;
  prompt: string;
  optionA: { label: string; description: string };
  optionB: { label: string; description: string };
  /** Log entries accumulated before this fork. */
  logSoFar: string[];
}

interface MissionComplete {
  kind: "complete";
  result: MissionResult;
}

export type MissionOutcome = MissionForkPrompt | MissionComplete;

export interface MissionPreview {
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

function runMission(
  mission: MissionDefinition,
  playerDeck: MissionPlayerDeck,
  forkChoices?: Record<string, ForkChoice>,
): MissionOutcome {
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

    if (step.kind === "fork") {
      const choice = forkChoices?.[step.id];
      if (!choice) {
        return {
          kind: "fork",
          forkStepId: step.id,
          prompt: step.prompt,
          optionA: { label: step.optionA.label, description: step.optionA.description },
          optionB: { label: step.optionB.label, description: step.optionB.description },
          logSoFar: [...state.missionLog],
        };
      }
      const picked = choice === "A" ? step.optionA : step.optionB;
      applyEffects(picked.effects, state);
      state.missionLog.push(`Phase ${step.phase}: ${formatNarrativeText(picked.narrativeText, state)}`);
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
    kind: "complete",
    result: {
      success: state.success,
      playerStats: { ...state.playerStats },
      inventory: [...state.inventory],
      missionLog: [...state.missionLog],
    },
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

const GLASS_CANOPY_MISSION: DistrictMissionDefinition = {
  id: "operation-glass-canopy",
  name: "Operation: Glass Canopy",
  district: "Glass City",
  pinLabel: "Glass Canopy",
  tagline: "Break into a silent glass tower, grab the payload, and outrun the response drones.",
  briefing:
    "Infiltrate the Glass City penthouse, grab the payload, and escape the Transitional Zone before the board dies.",
  checkTags: ["P1 STEALTH 7 + Urethane wheels", "P3 ACC 8 (+ Heat)", "P4 SPD 8 (+ Heat)", "P4 RNG 15 (+ Heat)"],
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
    {
      id: "overheat-fork",
      kind: "fork",
      name: "Overheating Board",
      phase: 2,
      prompt:
        "Your board's heat sink is redlining from the payload. The drivetrain is smoking — you can feel it through your shoes.",
      optionA: {
        label: "Push through on the board",
        description: "Keep skating — faster, but the overheating board takes structural damage.",
        narrativeText: ({ playerStats }) =>
          `You grit your teeth and ride the heat. The board screams but holds — barely. Board integrity drops to ${playerStats.health}%.`,
        effects: [{ type: "adjustPercent", stat: "health", percent: -10 }],
      },
      optionB: {
        label: "Dismount and go on foot",
        description: "Carry the board through the corridor — slower but the drivetrain can cool down.",
        narrativeText: ({ playerStats }) =>
          `You kick up the board and sprint the service corridor on foot. The detour costs speed but your board stays intact. SPD drops to ${playerStats.speed}.`,
        effects: [{ type: "adjust", stat: "speed", amount: -1.5 }],
      },
    },
    BlastDoors,
    AeroFuzzDrone,
    TheEscape,
  ],
};

const STATIC_BLOOM_MISSION: DistrictMissionDefinition = {
  id: "operation-static-bloom",
  name: "Operation: Static Bloom",
  district: "The Grid",
  pinLabel: "Static Bloom",
  tagline: "Lift a cooling-core cipher from Cascade storage and ghost the audit sweep.",
  briefing:
    "Thread The Grid's mirrored service lanes, steal the cooling-core cipher, and outrun the compliance sweep before the district locks down.",
  checkTags: ["P1 STEALTH 6 + Urethane wheels", "P3 ACC 7 (+ Heat)", "P4 SPD 7 (+ Heat)", "P4 RNG 13 (+ Heat)"],
  steps: [
    {
      id: "grid-sentry-lattice",
      kind: "hazard",
      name: "Sentry Lattice",
      phase: 1,
      hazardType: "Passive Security",
      requirement: {
        kind: "all",
        requirements: [
          { kind: "stat", stat: "stealth", minimum: 6 },
          { kind: "wheel", wheelType: "Urethane" },
        ],
      },
      successText:
        "You ghost under the Sentry Lattice and reach the maintenance elevator before Cascade can tag your board signature.",
      failureText: ({ playerStats, wheelType }) =>
        `The Sentry Lattice catches your approach${wheelType ? ` on ${wheelType} wheels` : ""}. Heat jumps by +2 to ${playerStats.heatLevel}, tightening every later checkpoint.`,
      onFailure: [{ type: "adjust", stat: "heatLevel", amount: 2 }],
    },
    {
      id: "cooling-core-cipher",
      kind: "item",
      name: "Cooling-Core Cipher",
      phase: 2,
      item: {
        id: "cooling-core-cipher",
        name: "Cooling-Core Cipher",
        phase: 2,
        description: "A chilled data prism that leaks visible vapor and makes clean movement harder.",
        modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
      },
      narrativeText:
        "You pop the cooling-core cipher from the rack. The vapor trail clings to you, dropping active STEALTH by 1 for the rest of the run.",
      onResolve: [
        {
          type: "addItem",
          item: {
            id: "cooling-core-cipher",
            name: "Cooling-Core Cipher",
            phase: 2,
            description: "A chilled data prism that leaks visible vapor and makes clean movement harder.",
            modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
          },
        },
      ],
    },
    {
      id: "cipher-route-fork",
      kind: "fork",
      name: "Cipher Route",
      phase: 2,
      prompt:
        "The cooling-core cipher is destabilizing your battery — frost is crawling up the pack. Two exits from the storage level.",
      optionA: {
        label: "Main corridor — fast but exposed",
        description: "Ride the open corridor and risk a Cascade sensor ping. Faster, but draws heat.",
        narrativeText: ({ playerStats }) =>
          `You blast down the main corridor. A Cascade sensor catches a sliver of your signature and heat ticks up to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Maintenance tunnel — slow but hidden",
        description: "Thread the narrow maintenance tunnel. The cipher drains extra charge in the cold, dark pipe.",
        narrativeText: ({ playerStats }) =>
          `You squeeze through the maintenance tunnel unseen, but the cipher leeches charge in the confined cold. Battery drops to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    {
      id: "coolant-gates",
      kind: "hazard",
      name: "Coolant Gates",
      phase: 3,
      hazardType: "Environmental Hazard",
      requirement: {
        kind: "stat",
        stat: "acceleration",
        minimum: 7,
        affectedByHeat: true,
      },
      successText:
        "You burst through the coolant gates before they can freeze shut around your deck.",
      failureText: ({ playerStats }) =>
        `A blast of super-cold mist seizes the drivetrain. Health dips to ${playerStats.health}% and your line softens to ${playerStats.speed} SPD.`,
      onFailure: [
        { type: "adjustPercent", stat: "health", percent: -10 },
        { type: "adjust", stat: "speed", amount: -1 },
      ],
    },
    {
      id: "audit-sweep",
      kind: "hazard",
      name: "Audit Sweep",
      phase: 4,
      hazardType: "Active Enemy",
      requirement: {
        kind: "stat",
        stat: "speed",
        minimum: 7,
        affectedByHeat: true,
      },
      successText:
        "You break line-of-sight with the audit sweep and leave a trail of false telemetry in your wake.",
      failureText: ({ playerStats }) =>
        `The audit sweep clips your battery pack with an EMP burst, leaving ${playerStats.batteryRemaining} RNG to finish the job.`,
      onFailure: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -15 }],
    },
    {
      id: "fiber-breach",
      kind: "hazard",
      name: "Fiber Breach",
      phase: 4,
      hazardType: "Endurance Check",
      requirement: {
        kind: "stat",
        stat: "batteryRemaining",
        minimum: 13,
        affectedByHeat: true,
      },
      successText: ({ playerStats }) =>
        `You clear the fiber breach and hit the static pack relay with ${playerStats.batteryRemaining} RNG left in reserve.`,
      failureText: ({ playerStats }) =>
        `Your board browns out in the fiber breach at ${playerStats.batteryRemaining} RNG and the cipher goes hot in your hands.`,
      onSuccess: [{ type: "adjust", stat: "batteryRemaining", amount: -13 }],
      onFailure: [{ type: "adjust", stat: "batteryRemaining", amount: -13 }],
      endsMissionOnFailure: true,
    },
  ],
};

const RAILSPIKE_MISSION: DistrictMissionDefinition = {
  id: "operation-railspike-run",
  name: "Operation: Railspike Run",
  district: "Batteryville",
  pinLabel: "Railspike Run",
  tagline: "Hijack a superconductive cell from the yard and punch out through the freight maze.",
  briefing:
    "Slip into Batteryville's rail yard, steal a superconductive freight cell, and ride the switchback lanes before the clamps close.",
  checkTags: ["P1 STEALTH 6", "P3 ACC 7 (+ Heat)", "P4 SPD 8 (+ Heat)", "P4 RNG 14 (+ Heat)"],
  steps: [
    {
      id: "yard-spotters",
      kind: "hazard",
      name: "Yard Spotters",
      phase: 1,
      hazardType: "Passive Security",
      requirement: { kind: "stat", stat: "stealth", minimum: 6 },
      successText:
        "You weave through the parked haulers and the yard spotters never get a clean look at you.",
      failureText: ({ playerStats }) =>
        `A spotter beacon paints your lane. Heat climbs by +2 to ${playerStats.heatLevel} and the whole yard starts to move against you.`,
      onFailure: [{ type: "adjust", stat: "heatLevel", amount: 2 }],
    },
    {
      id: "superconductive-cell",
      kind: "item",
      name: "Superconductive Cell",
      phase: 2,
      item: {
        id: "superconductive-cell",
        name: "Superconductive Cell",
        phase: 2,
        description: "A heavy battery brick that drags on every carve.",
        modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
      },
      narrativeText:
        "You rip the superconductive cell off a freight cradle. The weight knocks your active SPD down by 1 for the rest of the run.",
      onResolve: [
        {
          type: "addItem",
          item: {
            id: "superconductive-cell",
            name: "Superconductive Cell",
            phase: 2,
            description: "A heavy battery brick that drags on every carve.",
            modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
          },
        },
      ],
    },
    {
      id: "yard-fork",
      kind: "fork",
      name: "Rail Yard Fork",
      phase: 2,
      prompt:
        "The rail yard splits ahead. A narrow freight tunnel runs dark and tight on the left. The open switchyard on the right is faster but fully lit.",
      optionA: {
        label: "Open switchyard — fast but visible",
        description: "Cut across the lit yard at speed, but the spotters will see everything.",
        narrativeText: ({ playerStats }) =>
          `You carve through the open switchyard under the floodlights. Fast, but exposed — STEALTH drops to ${playerStats.stealth}.`,
        effects: [{ type: "adjust", stat: "stealth", amount: -2 }],
      },
      optionB: {
        label: "Freight tunnel — hidden but slow",
        description: "Thread the freight tunnel in near darkness. Safe from spotters, but the tight space costs speed.",
        narrativeText: ({ playerStats }) =>
          `You duck into the freight tunnel and grind through in the dark. Nobody sees you, but your line tightens — SPD falls to ${playerStats.speed}.`,
        effects: [{ type: "adjust", stat: "speed", amount: -1.5 }],
      },
    },
    {
      id: "switchback-gates",
      kind: "hazard",
      name: "Switchback Gates",
      phase: 3,
      hazardType: "Environmental Hazard",
      requirement: {
        kind: "stat",
        stat: "acceleration",
        minimum: 7,
        affectedByHeat: true,
      },
      successText:
        "You snap through the switchback gates before the magnetic clamps can seal the lane.",
      failureText: ({ playerStats }) =>
        `A clamp arm slams your tail. Health drops to ${playerStats.health}% and the hit leaves you at ${playerStats.speed} SPD.`,
      onFailure: [
        { type: "adjustPercent", stat: "health", percent: -12 },
        { type: "adjust", stat: "speed", amount: -1 },
      ],
    },
    {
      id: "freight-stampede",
      kind: "hazard",
      name: "Freight Stampede",
      phase: 4,
      hazardType: "Active Enemy",
      requirement: {
        kind: "stat",
        stat: "speed",
        minimum: 8,
        affectedByHeat: true,
      },
      successText:
        "You outrun the freight stampede and throw the yard drones off your line.",
      failureText: ({ playerStats }) =>
        `A side-loader clips the pack and you burn charge stabilizing, leaving ${playerStats.batteryRemaining} RNG.`,
      onFailure: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -18 }],
    },
    {
      id: "smelter-bypass",
      kind: "hazard",
      name: "Smelter Bypass",
      phase: 4,
      hazardType: "Endurance Check",
      requirement: {
        kind: "stat",
        stat: "batteryRemaining",
        minimum: 14,
        affectedByHeat: true,
      },
      successText: ({ playerStats }) =>
        `You clear the smelter bypass with ${playerStats.batteryRemaining} RNG left and the cell still locked down.`,
      failureText: ({ playerStats }) =>
        `The board dies in the furnace haze at ${playerStats.batteryRemaining} RNG and the rail crews scatter before you can deliver.`,
      onSuccess: [{ type: "adjust", stat: "batteryRemaining", amount: -14 }],
      onFailure: [{ type: "adjust", stat: "batteryRemaining", amount: -14 }],
      endsMissionOnFailure: true,
    },
  ],
};

const MURKLINE_MISSION: DistrictMissionDefinition = {
  id: "operation-murkline",
  name: "Operation: Murkline",
  district: "Nightshade",
  pinLabel: "Murkline",
  tagline: "Pull a ghost-ledger from the tunnels and escape before the undercity closes around you.",
  briefing:
    "Dive through Nightshade's tunnel web, recover the ghost-ledger, and climb out before the blackout shutters seal the route.",
  checkTags: ["P1 STEALTH 8", "P3 ACC 7 (+ Heat)", "P4 SPD 7 (+ Heat)", "P4 RNG 12 (+ Heat)"],
  steps: [
    {
      id: "tunnel-watch",
      kind: "hazard",
      name: "Tunnel Watch",
      phase: 1,
      hazardType: "Passive Security",
      requirement: { kind: "stat", stat: "stealth", minimum: 8 },
      successText:
        "You pass under the tunnel watch unseen, moving through pure neon shadow.",
      failureText: ({ playerStats }) =>
        `A lookout whistles you into the open. Heat rises by +1 to ${playerStats.heatLevel} and every deep-tunnel turn tightens.`,
      onFailure: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
    },
    {
      id: "ghost-ledger",
      kind: "item",
      name: "Ghost-Ledger",
      phase: 2,
      item: {
        id: "ghost-ledger",
        name: "Ghost-Ledger",
        phase: 2,
        description: "A glass shard index that throws reflections where you do not want them.",
        modifiers: [{ stat: "stealth", amount: -2, duration: "mission" }],
      },
      narrativeText:
        "You pocket the ghost-ledger. Its mirrored casing drops active STEALTH by 2 every time the tunnel lights catch it.",
      onResolve: [
        {
          type: "addItem",
          item: {
            id: "ghost-ledger",
            name: "Ghost-Ledger",
            phase: 2,
            description: "A glass shard index that throws reflections where you do not want them.",
            modifiers: [{ stat: "stealth", amount: -2, duration: "mission" }],
          },
        },
      ],
    },
    {
      id: "tunnel-split-fork",
      kind: "fork",
      name: "Tunnel Split",
      phase: 2,
      prompt:
        "The tunnel splits. Left dives through a flooded underpass — dark, hidden, but ankle-deep in charged runoff. Right climbs a lit service road — fast and dry, but the overhead cameras will track you.",
      optionA: {
        label: "Lit service road — fast but tracked",
        description: "Take the service road for speed. The cameras cost stealth but you keep your charge.",
        narrativeText: ({ playerStats }) =>
          `You power up the service road. Cameras paint your silhouette across every monitor in the district — STEALTH drops to ${playerStats.stealth}.`,
        effects: [{ type: "adjust", stat: "stealth", amount: -2 }],
      },
      optionB: {
        label: "Flooded underpass — hidden but draining",
        description: "Wade through the charged water in total darkness. Nobody sees you, but the runoff eats battery.",
        narrativeText: ({ playerStats }) =>
          `You drop into the flooded underpass and ghost through the dark. The charged water leeches power — battery falls to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -12 }],
      },
    },
    {
      id: "floodgate-drop",
      kind: "hazard",
      name: "Floodgate Drop",
      phase: 3,
      hazardType: "Environmental Hazard",
      requirement: {
        kind: "stat",
        stat: "acceleration",
        minimum: 7,
        affectedByHeat: true,
      },
      successText:
        "You punch up the floodgate ramp and clear the closing shutter with inches to spare.",
      failureText: ({ playerStats }) =>
        `The shutter grazes your deck, knocking health down to ${playerStats.health}% and shaving you to ${playerStats.speed} SPD.`,
      onFailure: [
        { type: "adjustPercent", stat: "health", percent: -10 },
        { type: "adjust", stat: "speed", amount: -1 },
      ],
    },
    {
      id: "glowhound-pack",
      kind: "hazard",
      name: "Glowhound Pack",
      phase: 4,
      hazardType: "Active Enemy",
      requirement: {
        kind: "stat",
        stat: "speed",
        minimum: 7,
        affectedByHeat: true,
      },
      successText:
        "You leave the glowhound pack chewing sparks in a dead-end tunnel while you break for daylight.",
      failureText: ({ playerStats }) =>
        `The glowhounds force a hard brake. You dump power to recover, leaving ${playerStats.batteryRemaining} RNG.`,
      onFailure: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -15 }],
    },
    {
      id: "blackout-climb",
      kind: "hazard",
      name: "Blackout Climb",
      phase: 4,
      hazardType: "Endurance Check",
      requirement: {
        kind: "stat",
        stat: "batteryRemaining",
        minimum: 12,
        affectedByHeat: true,
      },
      successText: ({ playerStats }) =>
        `You crest the blackout climb with ${playerStats.batteryRemaining} RNG left and vanish into the crowd above.`,
      failureText: ({ playerStats }) =>
        `Your lights die on the blackout climb at ${playerStats.batteryRemaining} RNG and Nightshade swallows the mission whole.`,
      onSuccess: [{ type: "adjust", stat: "batteryRemaining", amount: -12 }],
      onFailure: [{ type: "adjust", stat: "batteryRemaining", amount: -12 }],
      endsMissionOnFailure: true,
    },
  ],
};

export const DISTRICT_MISSIONS: DistrictMissionDefinition[] = [
  GLASS_CANOPY_MISSION,
  STATIC_BLOOM_MISSION,
  RAILSPIKE_MISSION,
  MURKLINE_MISSION,
];

function getMissionDefinition(missionId: string): DistrictMissionDefinition {
  return DISTRICT_MISSIONS.find((mission) => mission.id === missionId) ?? GLASS_CANOPY_MISSION;
}

export function runDistrictMission(
  missionId: string,
  playerDeck: MissionPlayerDeck,
  forkChoices?: Record<string, ForkChoice>,
): MissionOutcome {
  return runMission(getMissionDefinition(missionId), playerDeck, forkChoices);
}

function roundPreviewStat(value: number): number {
  return Number(value.toFixed(1));
}

function resolveRunnerCard(cards: CardPayload[], runnerCardId?: string): CardPayload | null {
  if (cards.length === 0) return null;
  return cards.find((card) => card.id === runnerCardId) ?? cards[0];
}

export function buildMissionPreview(
  cards: CardPayload[],
  runnerCardId?: string,
): MissionPreview {
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

  const deckSize = cards.length;
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

  // Normalise card-stat averages from the 1–200 scale back to the legacy 1–10
  // range so that downstream mission formulas and thresholds remain unchanged.
  const norm = MAX_SINGLE_STAT / LEGACY_STAT_MAX;
  const averageSpeed = totalStats.speed / deckSize / norm;
  const averageStealth = totalStats.stealth / deckSize / norm;
  const averageTech = totalStats.tech / deckSize / norm;
  const averageGrit = totalStats.grit / deckSize / norm;
  const averageRep = totalStats.rep / deckSize / norm;

  const playerDeck: MissionPlayerDeck = {
    board: runnerBoard,
    boardLoadout: runnerLoadout || undefined,
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
