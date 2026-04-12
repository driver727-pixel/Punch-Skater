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

interface MissionForkBlueprint {
  label: string;
  description: string;
  narrativeText: string | ((context: MissionNarrativeContext) => string);
  effects?: MissionEffect[];
}

interface MissionItemBlueprint {
  id: string;
  name: string;
  description: string;
  narrativeText: string;
  modifiers?: MissionItemModifier[];
}

interface DistrictMissionThresholds {
  stealth: number;
  acceleration: number;
  speed: number;
  battery: number;
}

interface DistrictMissionBlueprint {
  id: string;
  name: string;
  district: District;
  pinLabel: string;
  tagline: string;
  briefing: string;
  thresholds: DistrictMissionThresholds;
  phase1: {
    name: string;
    successText: string;
    failureText: string | ((context: MissionNarrativeContext) => string);
    heatPenalty: number;
    hazardType?: MissionHazardStep["hazardType"];
  };
  item: MissionItemBlueprint;
  fork: {
    name: string;
    prompt: string;
    optionA: MissionForkBlueprint;
    optionB: MissionForkBlueprint;
  };
  phase3: {
    name: string;
    successText: string;
    failureText: string | ((context: MissionNarrativeContext) => string);
    healthPenaltyPct: number;
    speedPenalty: number;
    hazardType?: MissionHazardStep["hazardType"];
  };
  phase4: {
    name: string;
    successText: string;
    failureText: string | ((context: MissionNarrativeContext) => string);
    batteryPenaltyPct: number;
    hazardType?: MissionHazardStep["hazardType"];
  };
  phase5: {
    name: string;
    successText: string | ((context: MissionNarrativeContext) => string);
    failureText: string | ((context: MissionNarrativeContext) => string);
  };
}

function createMissionItem(blueprint: MissionItemBlueprint): MissionItem {
  return {
    id: blueprint.id,
    name: blueprint.name,
    phase: 2,
    description: blueprint.description,
    modifiers: blueprint.modifiers,
  };
}

function createDistrictMission(blueprint: DistrictMissionBlueprint): DistrictMissionDefinition {
  const missionItem = createMissionItem(blueprint.item);

  return {
    id: blueprint.id,
    name: blueprint.name,
    district: blueprint.district,
    pinLabel: blueprint.pinLabel,
    tagline: blueprint.tagline,
    briefing: blueprint.briefing,
    checkTags: [
      `P1 STEALTH ${blueprint.thresholds.stealth}`,
      `P3 ACC ${blueprint.thresholds.acceleration} (+ Heat)`,
      `P4 SPD ${blueprint.thresholds.speed} (+ Heat)`,
      `P4 RNG ${blueprint.thresholds.battery} (+ Heat)`,
    ],
    steps: [
      {
        id: `${blueprint.id}-entry`,
        kind: "hazard",
        name: blueprint.phase1.name,
        phase: 1,
        hazardType: blueprint.phase1.hazardType ?? "Passive Security",
        requirement: { kind: "stat", stat: "stealth", minimum: blueprint.thresholds.stealth },
        successText: blueprint.phase1.successText,
        failureText: blueprint.phase1.failureText,
        onFailure: [{ type: "adjust", stat: "heatLevel", amount: blueprint.phase1.heatPenalty }],
      },
      {
        id: `${blueprint.id}-item`,
        kind: "item",
        name: blueprint.item.name,
        phase: 2,
        item: missionItem,
        narrativeText: blueprint.item.narrativeText,
        onResolve: [{ type: "addItem", item: missionItem }],
      },
      {
        id: `${blueprint.id}-fork`,
        kind: "fork",
        name: blueprint.fork.name,
        phase: 2,
        prompt: blueprint.fork.prompt,
        optionA: blueprint.fork.optionA,
        optionB: blueprint.fork.optionB,
      },
      {
        id: `${blueprint.id}-phase3`,
        kind: "hazard",
        name: blueprint.phase3.name,
        phase: 3,
        hazardType: blueprint.phase3.hazardType ?? "Environmental Hazard",
        requirement: {
          kind: "stat",
          stat: "acceleration",
          minimum: blueprint.thresholds.acceleration,
          affectedByHeat: true,
        },
        successText: blueprint.phase3.successText,
        failureText: blueprint.phase3.failureText,
        onFailure: [
          { type: "adjustPercent", stat: "health", percent: blueprint.phase3.healthPenaltyPct },
          { type: "adjust", stat: "speed", amount: blueprint.phase3.speedPenalty },
        ],
      },
      {
        id: `${blueprint.id}-phase4`,
        kind: "hazard",
        name: blueprint.phase4.name,
        phase: 4,
        hazardType: blueprint.phase4.hazardType ?? "Active Enemy",
        requirement: {
          kind: "stat",
          stat: "speed",
          minimum: blueprint.thresholds.speed,
          affectedByHeat: true,
        },
        successText: blueprint.phase4.successText,
        failureText: blueprint.phase4.failureText,
        onFailure: [{ type: "adjustPercent", stat: "batteryRemaining", percent: blueprint.phase4.batteryPenaltyPct }],
      },
      {
        id: `${blueprint.id}-phase5`,
        kind: "hazard",
        name: blueprint.phase5.name,
        phase: 4,
        hazardType: "Endurance Check",
        requirement: {
          kind: "stat",
          stat: "batteryRemaining",
          minimum: blueprint.thresholds.battery,
          affectedByHeat: true,
        },
        successText: blueprint.phase5.successText,
        failureText: blueprint.phase5.failureText,
        onSuccess: [{ type: "adjust", stat: "batteryRemaining", amount: -blueprint.thresholds.battery }],
        onFailure: [{ type: "adjust", stat: "batteryRemaining", amount: -blueprint.thresholds.battery }],
        endsMissionOnFailure: true,
      },
    ],
  };
}

const DISTRICT_MISSION_BLUEPRINTS: DistrictMissionBlueprint[] = [
  {
    id: "airaway-sky-organ-run",
    name: "Operation: Sky Organ Run",
    district: "Airaway",
    pinLabel: "Sky Organ",
    tagline: "Deliver a chilled organ case to the Asclepians before the skybridge scanners close.",
    briefing: "Lift a viable organ through Airaway's contractor lanes and hand it to the rooftop surgeons before the donor clock runs out.",
    thresholds: { stealth: 7, acceleration: 8, speed: 8, battery: 14 },
    phase1: {
      name: "Contractor Checkpoint",
      successText: "You drift through the contractor checkpoint with the cooler masked as routine med freight.",
      failureText: ({ playerStats }) => `Airaway flags the med-case seal. Heat climbs to ${playerStats.heatLevel} and every tower gate tightens around you.`,
      heatPenalty: 2,
    },
    item: {
      id: "asclepian-organ-case",
      name: "Asclepian Organ Case",
      description: "A cryo-safe organ pod that swings heavy on every turn.",
      narrativeText: "You secure the organ pod under one arm. Its awkward weight drags your active SPD down by 1 for the rest of the mission.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Skybridge Split",
      prompt: "The fastest skybridge is swarming with security drones. A sealed service umbilical below it stays darker but it is longer and colder.",
      optionA: {
        label: "Skybridge lane",
        description: "Stay fast above the clouds and risk tower cameras.",
        narrativeText: ({ playerStats }) => `You blast across the skybridge in plain sight. The run stays quick, but heat ticks up to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Service umbilical",
        description: "Drop into the maintenance tube and spend more battery staying warm.",
        narrativeText: ({ playerStats }) => `You ghost through the service umbilical unseen, but the cold bites deep. Battery falls to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Mag-Rail Gate",
      successText: "You snap through the mag-rail gate before the maintenance shutters can trap your lane.",
      failureText: ({ playerStats }) => `A mag-rail arm clips your tail. Health drops to ${playerStats.health}% and your line softens to ${playerStats.speed} SPD.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Aero-Fuzz Interceptors",
      successText: "You fake a med-evac route and leave the Aero-Fuzz interceptors circling empty air.",
      failureText: ({ playerStats }) => `An interceptor tags the pod with a tether burst. You dump charge to stay upright, leaving ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Surgical Dock Final",
      successText: ({ playerStats }) => `You hit the surgical dock with ${playerStats.batteryRemaining} RNG left and the organ still viable for transplant.`,
      failureText: ({ playerStats }) => `Your board browns out just short of the surgical dock at ${playerStats.batteryRemaining} RNG and the organ clock wins.`,
    },
  },
  {
    id: "airaway-contractor-parts-run",
    name: "Operation: Contractor Parts Run",
    district: "Airaway",
    pinLabel: "Parts Lift",
    tagline: "Shop the contractor market for premium board parts and slip them past corporate inventory control.",
    briefing: "Raid Airaway's licensed skate suppliers, grab the parts your crew actually needs, and get back below the smog before the receipts are audited.",
    thresholds: { stealth: 7, acceleration: 7, speed: 8, battery: 13 },
    phase1: {
      name: "Receipt Scanner",
      successText: "You pass the receipt scanner with forged maintenance credentials and nobody asks who approved the order.",
      failureText: ({ playerStats }) => `Inventory control pings your fake purchase. Heat rises to ${playerStats.heatLevel} and the market shutters start closing.`,
      heatPenalty: 2,
    },
    item: {
      id: "contractor-parts-crate",
      name: "Contractor Parts Crate",
      description: "Precision trucks and ceramic bearings packed in a dense carbon case.",
      narrativeText: "You sling the parts crate under your arm. The bulk knocks active SPD down by 1 until you clear the district.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Procurement Exit",
      prompt: "One route runs through the public contractor concourse under bright ads. The other cuts through a quiet freight lift that drains your pack on every vertical climb.",
      optionA: {
        label: "Public concourse",
        description: "Stay quick through the crowd and eat the cameras.",
        narrativeText: ({ playerStats }) => `You blend with the contractor rush, but the ad towers lock onto you. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Freight lift spine",
        description: "Take the hidden lift and trade charge for cover.",
        narrativeText: ({ playerStats }) => `The freight spine keeps you out of sight, but the lifts chew battery hard. Reserve drops to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Cargo Divider",
      successText: "You thread the cargo divider before the armored doors can seal the procurement floor.",
      failureText: ({ playerStats }) => `A divider clips your front truck. Health slips to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -9,
      speedPenalty: -1,
    },
    phase4: {
      name: "Procurement Enforcers",
      successText: "You lose the procurement enforcers in a wash of delivery carts and maintenance sparks.",
      failureText: ({ playerStats }) => `A stun baton catches your pack and forces a power dump, leaving ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -14,
    },
    phase5: {
      name: "Drop to the Basin",
      successText: ({ playerStats }) => `You clear the basin descent with ${playerStats.batteryRemaining} RNG left and the new parts still boxed.`,
      failureText: ({ playerStats }) => `The board dies on the basin descent at ${playerStats.batteryRemaining} RNG and Airaway gets its merchandise back.`,
    },
  },
  {
    id: "airaway-skybridge-pizza-lift",
    name: "Operation: Skybridge Pizza Lift",
    district: "Airaway",
    pinLabel: "Pizza Lift",
    tagline: "Deliver contraband pizzas to exhausted troops holding the skybridge perimeter.",
    briefing: "A hungry troop detail on Airaway's edge paid in hard credit. Get their pizza stack through the tower cordon before command notices morale improving.",
    thresholds: { stealth: 6, acceleration: 7, speed: 8, battery: 13 },
    phase1: {
      name: "Mess Hall Audit",
      successText: "You slide past the mess hall audit with the pizza stack listed as waste disposal.",
      failureText: ({ playerStats }) => `The smell gives you away. Heat rises to ${playerStats.heatLevel} and every guard suddenly wants a slice and a name.`,
      heatPenalty: 1,
    },
    item: {
      id: "troop-pizza-stack",
      name: "Troop Pizza Stack",
      description: "A warm stack of pizzas that broadcasts your route with every gust of air.",
      narrativeText: "You strap the pizzas to the deck. The scent trail cuts active STEALTH by 1 for the rest of the delivery.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Ration Route",
      prompt: "The direct skybridge is packed with drones. A freezer vent below stays hidden but drains charge while the pizzas stay hot.",
      optionA: {
        label: "Main skybridge",
        description: "Ride straight to the troops and accept the camera coverage.",
        narrativeText: ({ playerStats }) => `You take the straight bridge. Fast, loud, and obvious — heat bumps to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Freezer vent",
        description: "Stay hidden in the ventwork and burn extra battery on the heaters.",
        narrativeText: ({ playerStats }) => `The vent keeps the stack hidden, but your heaters chew power. Battery drops to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -9 }],
      },
    },
    phase3: {
      name: "Service Hatch Drop",
      successText: "You pop the service hatch clean and land inside the perimeter before the locks cycle shut.",
      failureText: ({ playerStats }) => `A hatch edge shaves your deck. Health falls to ${playerStats.health}% and SPD slides to ${playerStats.speed}.`,
      healthPenaltyPct: -8,
      speedPenalty: -1,
    },
    phase4: {
      name: "Taser Patrol",
      successText: "You dump the taser patrol in a wash of steam vents and ration carts.",
      failureText: ({ playerStats }) => `The patrol zaps your battery housing, dropping reserve to ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -14,
    },
    phase5: {
      name: "Perimeter Drop-Off",
      successText: ({ playerStats }) => `You hand over the pizzas with ${playerStats.batteryRemaining} RNG left and the troops cheer louder than their officers.`,
      failureText: ({ playerStats }) => `Your board stalls at ${playerStats.batteryRemaining} RNG and the perimeter shift goes hungry another night.`,
    },
  },
  {
    id: "roads-dead-atlas",
    name: "Operation: Dead Atlas",
    district: "The Roads",
    pinLabel: "Dead Atlas",
    tagline: "Recover a forgotten road map before a rival convoy burns the evidence.",
    briefing: "Somewhere on the Nullarbor ruins sits an old courier atlas showing safe bypasses. Find it, copy it, and get out before raiders torch the cache.",
    thresholds: { stealth: 6, acceleration: 7, speed: 8, battery: 15 },
    phase1: {
      name: "Convoy Watchfires",
      successText: "You skirt the watchfires and reach the atlas cache without kicking up a readable dust trail.",
      failureText: ({ playerStats }) => `A convoy scout clocks your route from the ridge. Heat spikes to ${playerStats.heatLevel} and every straightaway grows meaner.`,
      heatPenalty: 2,
    },
    item: {
      id: "dead-atlas-map-tube",
      name: "Dead Atlas Map Tube",
      description: "A brittle tube full of hand-marked freight routes and water notes.",
      narrativeText: "You lock the atlas tube to your pack. The long canister throws your balance, dropping active SPD by 1.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Salt Flat Choice",
      prompt: "A salt flat shortcut is wide open and brutally fast. An old culvert line stays hidden from scouts, but its potholes chew charge.",
      optionA: {
        label: "Salt flat blast",
        description: "Take the clean horizon and risk being seen for miles.",
        narrativeText: ({ playerStats }) => `You launch across the salt flat in full view. Heat ticks up to ${playerStats.heatLevel} but the line stays quick.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Culvert crawl",
        description: "Hide in the broken drainage line and spend battery on constant corrections.",
        narrativeText: ({ playerStats }) => `The culvert keeps you hidden, but the rough line drains power. Battery falls to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -11 }],
      },
    },
    phase3: {
      name: "Collapsed Overpass",
      successText: "You punch through the collapsed overpass gap and keep the atlas dry and intact.",
      failureText: ({ playerStats }) => `Rebar tags your deck. Health drops to ${playerStats.health}% and the hit leaves you at ${playerStats.speed} SPD.`,
      healthPenaltyPct: -11,
      speedPenalty: -1,
    },
    phase4: {
      name: "Punch Skater Chasers",
      successText: "You leave the road raiders eating dust and bad guesses at the next marker post.",
      failureText: ({ playerStats }) => `A chaser clips your battery case in the scrum, dropping you to ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -16,
    },
    phase5: {
      name: "Mirage Finish",
      successText: ({ playerStats }) => `You reach the relay camp with ${playerStats.batteryRemaining} RNG left and the atlas ready to copy.`,
      failureText: ({ playerStats }) => `The board dies in the mirage heat at ${playerStats.batteryRemaining} RNG and the atlas falls back into the dust.`,
    },
  },
  {
    id: "roads-grease-mile",
    name: "Operation: Grease Mile",
    district: "The Roads",
    pinLabel: "Grease Mile",
    tagline: "Hunt down industrial lubricant before the long-haul convoy seizes up in the desert.",
    briefing: "A relay convoy is out of chain lube and half its boards are screaming. Bring back enough lubricant from an abandoned depot to keep the line moving.",
    thresholds: { stealth: 6, acceleration: 7, speed: 7, battery: 14 },
    phase1: {
      name: "Depot Smoke",
      successText: "You ghost through the depot smoke and pull the lube drums before anyone spots fresh tracks.",
      failureText: ({ playerStats }) => `A scavenger tower sees your silhouette. Heat climbs to ${playerStats.heatLevel} and the depot wakes up around you.`,
      heatPenalty: 2,
    },
    item: {
      id: "chain-lube-drums",
      name: "Chain Lube Drums",
      description: "Two dense lubricant canisters with seals that leak if you carve too hard.",
      narrativeText: "You strap the lube drums to the deck. Their weight drags active SPD down by 1 for the run home.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Refinery Bypass",
      prompt: "A refinery frontage gives you a direct line but floodlights every meter. A rusted maintenance trench stays hidden and chews charge in deep sand.",
      optionA: {
        label: "Floodlit frontage",
        description: "Stay quick beside the refinery and risk being marked.",
        narrativeText: ({ playerStats }) => `You skim the frontage under full floodlights. Heat rises to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Maintenance trench",
        description: "Hide low in the sand-cut trench and spend more battery clawing out.",
        narrativeText: ({ playerStats }) => `The trench keeps you out of sight, but the sand eats charge. Battery falls to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Washout Ramp",
      successText: "You clear the washout ramp and keep the drums from rupturing.",
      failureText: ({ playerStats }) => `Your deck slams the far edge. Health drops to ${playerStats.health}% and SPD sinks to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Dust Raiders",
      successText: "You shake the dust raiders in a crosswind and leave them following the wrong plume.",
      failureText: ({ playerStats }) => `A raider hooks your battery housing and you bleed power to recover, leaving ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Convoy Relief",
      successText: ({ playerStats }) => `You roll into the convoy with ${playerStats.batteryRemaining} RNG left and enough lubricant to quiet every chain in camp.`,
      failureText: ({ playerStats }) => `The board gives up at ${playerStats.batteryRemaining} RNG and the convoy stays one mile from disaster.`,
    },
  },
  {
    id: "roads-relief-kitchen",
    name: "Operation: Relief Kitchen",
    district: "The Roads",
    pinLabel: "Relief Run",
    tagline: "Feed the roadside camps before Punch Skater raiders strip the supplies.",
    briefing: "A camp of stranded couriers is out of food. Move relief baskets across open road and get them there before the raiders roll in.",
    thresholds: { stealth: 5, acceleration: 7, speed: 8, battery: 14 },
    phase1: {
      name: "Camp Perimeter",
      successText: "You slip out of the relief camp with the baskets packed tight and the sentries calm.",
      failureText: ({ playerStats }) => `The relief camp's smoke column gives your departure away. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 1,
    },
    item: {
      id: "relief-food-baskets",
      name: "Relief Food Baskets",
      description: "Packed meals and water bags bundled high on your deck.",
      narrativeText: "You secure the relief baskets to the deck. The load knocks active SPD down by 1 until delivery.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Mercy Split",
      prompt: "The direct stretch is faster but exposed to anyone scanning the horizon. A dead fuel trench stays hidden, though it costs charge and time.",
      optionA: {
        label: "Highway straight",
        description: "Race the horizon and trust your speed.",
        narrativeText: ({ playerStats }) => `You take the highway straight and every raider with eyes gets a look. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Fuel trench",
        description: "Stay low and hidden while the rough ground drains the pack.",
        narrativeText: ({ playerStats }) => `The trench hides the baskets, but the bad ground drains battery down to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Bridge Skeleton",
      successText: "You clear the bridge skeleton and keep the baskets from spilling into the gorge.",
      failureText: ({ playerStats }) => `A loose beam smashes your underside. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -9,
      speedPenalty: -1,
    },
    phase4: {
      name: "Relief Camp Raiders",
      successText: "You draw the raiders off the hungry camp and leave them chasing empty road.",
      failureText: ({ playerStats }) => `A raider blade scores the pack and leaves you with ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Camp Supper",
      successText: ({ playerStats }) => `You hit the roadside camp with ${playerStats.batteryRemaining} RNG left and enough meals to hold the line.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the camp watches food stop just short of their firelight.`,
    },
  },
  {
    id: "batteryville-lithium-bleed",
    name: "Operation: Lithium Bleed",
    district: "Batteryville",
    pinLabel: "Lithium",
    tagline: "Hunt fresh lithium batteries through the recycler belt before the clamps lock down.",
    briefing: "The recycler collectives located a crate of clean lithium cells in Batteryville's scrap belt. Pull it free and move it before HexChain repossesses the lot.",
    thresholds: { stealth: 6, acceleration: 7, speed: 8, battery: 14 },
    phase1: {
      name: "Recycler Spotters",
      successText: "You move through the recycler belt with your lights off and the spotters never call it in.",
      failureText: ({ playerStats }) => `A recycler beacon paints your lane. Heat jumps to ${playerStats.heatLevel} and the belt starts closing around you.`,
      heatPenalty: 2,
    },
    item: {
      id: "lithium-cell-crate",
      name: "Lithium Cell Crate",
      description: "Fresh battery bricks packed in shock foam and heavier than they look.",
      narrativeText: "You rip the lithium crate free. The weight drags active SPD down by 1 for the rest of the extraction.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Smelter Choice",
      prompt: "One route cuts across the open smelter bridge. The other dives through a conveyor trench that keeps you hidden but grinds charge away.",
      optionA: {
        label: "Smelter bridge",
        description: "Stay fast above the furnaces and risk every camera.",
        narrativeText: ({ playerStats }) => `You sprint the smelter bridge and light yourself up on every camera. Heat rises to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Conveyor trench",
        description: "Hide below the line and let the trench chew your battery.",
        narrativeText: ({ playerStats }) => `The trench keeps the cells hidden, but the constant climb drains you to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Clamp Gate",
      successText: "You clear the clamp gate before the magnet arms can lock your deck in place.",
      failureText: ({ playerStats }) => `A clamp arm slams your truck. Health drops to ${playerStats.health}% and SPD slips to ${playerStats.speed}.`,
      healthPenaltyPct: -12,
      speedPenalty: -1,
    },
    phase4: {
      name: "Forklift Rush",
      successText: "You outrun the forklift rush and leave the yard crews boxed in behind you.",
      failureText: ({ playerStats }) => `A side-loader forces a hard correction and burns you down to ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -18,
    },
    phase5: {
      name: "Recycler Hand-Off",
      successText: ({ playerStats }) => `You make the recycler hand-off with ${playerStats.batteryRemaining} RNG left and enough lithium to keep the district alive.`,
      failureText: ({ playerStats }) => `The pack dies at ${playerStats.batteryRemaining} RNG and the lithium cells are lost back into the furnace haze.`,
    },
  },
  {
    id: "batteryville-thumbburn-heist",
    name: "Operation: Thumbburn Heist",
    district: "Batteryville",
    pinLabel: "Thumbburn",
    tagline: "Steal a thumb drive ledger from a HexChain foreman and escape the freight maze.",
    briefing: "A foreman is moving payout records on a physical thumb drive. Grab it out of the dispatch office and get it to the union before the shred order hits.",
    thresholds: { stealth: 6, acceleration: 7, speed: 8, battery: 13 },
    phase1: {
      name: "Dispatch Glass",
      successText: "You slip under the dispatch glass and reach the foreman's locker without a ping.",
      failureText: ({ playerStats }) => `A foreman drone catches your reflection. Heat rises to ${playerStats.heatLevel} and the freight maze starts to seal.`,
      heatPenalty: 2,
    },
    item: {
      id: "hexchain-thumb-drive",
      name: "HexChain Thumb Drive",
      description: "A stolen payout drive taped into a heat-shielded sleeve.",
      narrativeText: "You pocket the thumb drive. The thermal sleeve is bulky and drops active STEALTH by 1 whenever the yard lights hit it.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Freight Maze Fork",
      prompt: "The open lane is short and lit. The covered coolant tunnel stays hidden but bleeds battery in the cold.",
      optionA: {
        label: "Open freight lane",
        description: "Take the quick line and trust the crowd.",
        narrativeText: ({ playerStats }) => `You shoot the open lane and every overhead lens gets a look. Heat bumps to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Coolant tunnel",
        description: "Hide the drive in the cold dark and spend charge getting out.",
        narrativeText: ({ playerStats }) => `You ghost through the coolant tunnel, but the cold drains battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Switch Rail",
      successText: "You hop the live switch rail and clear the yard before the routes rewrite under you.",
      failureText: ({ playerStats }) => `A rail kick hammers your board. Health drops to ${playerStats.health}% and SPD slides to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Rail Yard Enforcers",
      successText: "You lose the enforcers between ore haulers and hot slag vents.",
      failureText: ({ playerStats }) => `An enforcer hook yanks the battery pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -16,
    },
    phase5: {
      name: "Union Archive",
      successText: ({ playerStats }) => `You reach the union archive with ${playerStats.batteryRemaining} RNG left and the thumb drive still unread.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and HexChain's ledger stays buried.`,
    },
  },
  {
    id: "batteryville-mutual-spark",
    name: "Operation: Mutual Spark",
    district: "Batteryville",
    pinLabel: "Spark Aid",
    tagline: "Help neighboring factions by escorting spare cells out of Batteryville.",
    briefing: "The Static Pack and Wooders both need backup power. Drag a mutual-aid sled of cells through the yards and get it onto the outbound line.",
    thresholds: { stealth: 5, acceleration: 7, speed: 7, battery: 14 },
    phase1: {
      name: "Outbound Inspection",
      successText: "You clear the outbound inspection point with the aid sled hidden in a freight manifest spoof.",
      failureText: ({ playerStats }) => `The inspection drone flags the extra weight. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 1,
    },
    item: {
      id: "mutual-aid-sled",
      name: "Mutual Aid Sled",
      description: "A low drag crate full of spare power cells for neighboring factions.",
      narrativeText: "You hitch the aid sled to your line. The extra pull knocks active SPD down by 1 until delivery.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Aid Route",
      prompt: "The union spur is fast but watched. A slag run-off channel is quieter and rough enough to drain extra charge.",
      optionA: {
        label: "Union spur",
        description: "Take the direct spur and risk the patrols.",
        narrativeText: ({ playerStats }) => `You race the union spur in clear view. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Slag run-off",
        description: "Stay low in the rough and spend battery keeping the sled stable.",
        narrativeText: ({ playerStats }) => `The run-off channel hides you, but the sled fights every carve. Battery drops to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -11 }],
      },
    },
    phase3: {
      name: "Transfer Ramp",
      successText: "You clear the transfer ramp and keep the spare cells intact.",
      failureText: ({ playerStats }) => `The sled fishtails and slams your deck. Health falls to ${playerStats.health}% and SPD drops to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Punch Skater Looters",
      successText: "You hold the looters off long enough to keep the mutual-aid cells moving.",
      failureText: ({ playerStats }) => `A looter clips your pack in the scrum and leaves you with ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Neighboring Hand-Off",
      successText: ({ playerStats }) => `You complete the aid hand-off with ${playerStats.batteryRemaining} RNG left and two factions owing Batteryville a favor.`,
      failureText: ({ playerStats }) => `The board stalls at ${playerStats.batteryRemaining} RNG and the mutual-aid convoy never leaves the yard.`,
    },
  },
  {
    id: "grid-black-badge",
    name: "Operation: Black Badge",
    district: "The Grid",
    pinLabel: "Black Badge",
    tagline: "Steal a thumb drive full of Cascade black-badge credentials from the data district.",
    briefing: "Cascade moved its cleanest admin keys back onto an encrypted thumb drive. Slip into the access vault, steal it, and outrun the audit sweep.",
    thresholds: { stealth: 7, acceleration: 7, speed: 7, battery: 13 },
    phase1: {
      name: "Sentry Lattice",
      successText: "You ghost under the sentry lattice and reach the access vault before Cascade tags your signature.",
      failureText: ({ playerStats }) => `The lattice catches a fragment of your route. Heat jumps to ${playerStats.heatLevel}.`,
      heatPenalty: 2,
    },
    item: {
      id: "black-badge-thumb-drive",
      name: "Black Badge Thumb Drive",
      description: "A chilled admin drive in a vapor-sealed sleeve.",
      narrativeText: "You jack the thumb drive from its cradle. The vapor sleeve drops active STEALTH by 1 for the rest of the run.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Cipher Route",
      prompt: "One exit is the bright admin corridor. The other is a maintenance duct full of cold airflow that drains batteries fast.",
      optionA: {
        label: "Admin corridor",
        description: "Take the fast corridor and risk the audit lenses.",
        narrativeText: ({ playerStats }) => `You blast the admin corridor and the audit lenses flare awake. Heat rises to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Maintenance duct",
        description: "Hide in the ductwork and let the cold eat your charge.",
        narrativeText: ({ playerStats }) => `You stay hidden in the duct, but the cold drains you to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Coolant Gates",
      successText: "You burst through the coolant gates before they freeze the lane shut.",
      failureText: ({ playerStats }) => `A coolant blast seizes the drivetrain. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Audit Sweep",
      successText: "You leave the audit sweep chasing false telemetry and bad assumptions.",
      failureText: ({ playerStats }) => `An EMP lash from the audit sweep leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Relay Exit",
      successText: ({ playerStats }) => `You hit the static relay with ${playerStats.batteryRemaining} RNG left and the admin drive still cold.`,
      failureText: ({ playerStats }) => `Your board browns out at ${playerStats.batteryRemaining} RNG and Cascade keeps its black badges.`,
    },
  },
  {
    id: "grid-blindspot-atlas",
    name: "Operation: Blindspot Atlas",
    district: "The Grid",
    pinLabel: "Blindspot",
    tagline: "Discover and extract a map of every surveillance blindspot in The Grid.",
    briefing: "The Static Pack uncovered a maintenance atlas showing where Cascade cannot see. Recover the map and get it out before the AI notices the gap.",
    thresholds: { stealth: 7, acceleration: 7, speed: 7, battery: 12 },
    phase1: {
      name: "Mirror Hall",
      successText: "You move through the mirror hall without giving the sensor mesh a clean angle.",
      failureText: ({ playerStats }) => `A mirrored panel catches your full reflection. Heat climbs to ${playerStats.heatLevel}.`,
      heatPenalty: 2,
    },
    item: {
      id: "blindspot-map-core",
      name: "Blindspot Map Core",
      description: "A prism drive full of maintenance routes and blind camera arcs.",
      narrativeText: "You lift the map core from its rack. Its humming shell drops active STEALTH by 1 until extraction.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Shadow Route",
      prompt: "A public service boulevard gets you out fast but exposes the map core to every watcher. A cable tunnel is hidden and miserable on battery.",
      optionA: {
        label: "Service boulevard",
        description: "Take the clean route and risk the lenses.",
        narrativeText: ({ playerStats }) => `You hit the service boulevard at speed and the watcher net heats up to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Cable tunnel",
        description: "Stay hidden in the tunnel and spend extra battery crawling the pipe.",
        narrativeText: ({ playerStats }) => `You disappear into the cable tunnel, but the crawl drags battery down to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -9 }],
      },
    },
    phase3: {
      name: "Servo Turnstiles",
      successText: "You slip the servo turnstiles before they can lock your path into a dead end.",
      failureText: ({ playerStats }) => `A turnstile arm hammers the deck. Health drops to ${playerStats.health}% and SPD softens to ${playerStats.speed}.`,
      healthPenaltyPct: -9,
      speedPenalty: -1,
    },
    phase4: {
      name: "Camera Hounds",
      successText: "You dump the camera hounds into an endless diagnostic loop.",
      failureText: ({ playerStats }) => `A hound lances your pack with static and leaves ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -14,
    },
    phase5: {
      name: "Atlas Relay",
      successText: ({ playerStats }) => `You deliver the blindspot atlas with ${playerStats.batteryRemaining} RNG left and the routes stay hidden from Cascade.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and the map core falls back into the net.`,
    },
  },
  {
    id: "grid-relay-stand",
    name: "Operation: Relay Stand",
    district: "The Grid",
    pinLabel: "Relay Stand",
    tagline: "Defend a static relay from a Punch Skater horde long enough to finish an upload.",
    briefing: "The Static Pack needs four more minutes to uplink stolen records. Hold the relay against a Punch Skater horde and keep the transmitters alive.",
    thresholds: { stealth: 6, acceleration: 7, speed: 7, battery: 13 },
    phase1: {
      name: "Quiet Setup",
      successText: "You get the relay humming before the raiders realize anything valuable is online.",
      failureText: ({ playerStats }) => `The startup glow gives the relay away. Heat jumps to ${playerStats.heatLevel} and the horde starts converging.`,
      heatPenalty: 1,
    },
    item: {
      id: "relay-defense-kit",
      name: "Relay Defense Kit",
      description: "Signal boosters, spare cable, and a shock baton for the last line.",
      narrativeText: "You strap the relay defense kit on. The bundle drops active SPD by 1 while you hold the site.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Defense Posture",
      prompt: "You can post up on the visible relay roof for a cleaner escape line, or hole up in the service trench and let the upload drain more battery.",
      optionA: {
        label: "Relay roof",
        description: "Keep speed for the escape but expose the site.",
        narrativeText: ({ playerStats }) => `You hold the roofline and the horde sees exactly where to rush. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Service trench",
        description: "Hide the relay core and spend charge keeping the transmitters boosted.",
        narrativeText: ({ playerStats }) => `The trench keeps the upload hidden, but the boosters drain you to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Shutter Break",
      successText: "You kick through the relay shutters before the raiders can pen you in.",
      failureText: ({ playerStats }) => `A shutter slams your deck. Health falls to ${playerStats.health}% and SPD drops to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Punch Skater Horde",
      successText: "You break the horde's rush long enough for the upload to lock and transmit.",
      failureText: ({ playerStats }) => `A raider swarm batters your pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Upload Hold",
      successText: ({ playerStats }) => `You hold until the upload completes with ${playerStats.batteryRemaining} RNG left and the relay still broadcasting.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and the relay goes dark before the send finishes.`,
    },
  },
  {
    id: "electropolis-corridor-parts",
    name: "Operation: Corridor Parts Run",
    district: "Electropolis",
    pinLabel: "Corridor",
    tagline: "Shop the sanctioned transit strip for rare skateboard parts and get out before the Fuzz audits the lane.",
    briefing: "Electropolis keeps its best legal parts behind corridor checkpoints. Buy or steal what you can, then leave before the biometric sweeps reconcile inventory.",
    thresholds: { stealth: 7, acceleration: 7, speed: 8, battery: 13 },
    phase1: {
      name: "Transit Checkpoint",
      successText: "You drift through the transit checkpoint with a clean contractor face and a dirtier intent.",
      failureText: ({ playerStats }) => `The Fuzz tags your biometrics for review. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 2,
    },
    item: {
      id: "corridor-parts-haul",
      name: "Corridor Parts Haul",
      description: "Fresh bearings, urethane sleeves, and tuned trucks packed in a police-approved bag.",
      narrativeText: "You sling the parts haul under your jacket. The rigid bag drags active SPD down by 1 until you're clear.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Tourist Strip Split",
      prompt: "The bright tourist strip is fast and watched. A service arcade under the ads is quieter but drains charge over its ramps.",
      optionA: {
        label: "Tourist strip",
        description: "Stay in the clean corridor and risk every lens.",
        narrativeText: ({ playerStats }) => `You carve the tourist strip under holo-light and heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Service arcade",
        description: "Hide under the ads and spend battery fighting the ramps.",
        narrativeText: ({ playerStats }) => `The service arcade keeps you hidden, but the ramps drain battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Barrier Chicane",
      successText: "You slip the barrier chicane before the corridor clamps can pin you.",
      failureText: ({ playerStats }) => `A barrier edge hammers your truck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -9,
      speedPenalty: -1,
    },
    phase4: {
      name: "Fuzz Glide Team",
      successText: "You lose the glide team in a pulse of transit glare and bad data.",
      failureText: ({ playerStats }) => `A glide team shock net costs you battery, leaving ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Clean Exit",
      successText: ({ playerStats }) => `You leave Electropolis with ${playerStats.batteryRemaining} RNG left and enough new parts to rebuild a squad.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and the Fuzz reclaims every part in the bag.`,
    },
  },
  {
    id: "electropolis-garrison-pizza",
    name: "Operation: Garrison Pizza",
    district: "Electropolis",
    pinLabel: "Garrison",
    tagline: "Deliver pizzas to corridor troops before a morale crackdown shuts the order down.",
    briefing: "A troop detail on the transit strip pooled credits for hot food. Get the pizzas through Electropolis before the Fuzz decides hungry soldiers are safer soldiers.",
    thresholds: { stealth: 6, acceleration: 7, speed: 8, battery: 12 },
    phase1: {
      name: "Curbside Sweep",
      successText: "You slip the curbside sweep with the pizza boxes tagged as maintenance foam.",
      failureText: ({ playerStats }) => `The smell hits a patrol first. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 1,
    },
    item: {
      id: "garrison-pizza-boxes",
      name: "Garrison Pizza Boxes",
      description: "Hot pizza boxes stacked high enough to make every patrol hungry.",
      narrativeText: "You strap the pizza stack tight. The smell trail drops active STEALTH by 1 for the rest of the run.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Mess Route",
      prompt: "The direct plaza gets you there fast but keeps you under drone sight. A tram underpass stays hidden and costs more battery in the climb out.",
      optionA: {
        label: "Direct plaza",
        description: "Trust speed and pray the drones are bored.",
        narrativeText: ({ playerStats }) => `You blast the plaza and the patrol net wakes up. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Tram underpass",
        description: "Stay below the strip and spend charge getting the boxes back up.",
        narrativeText: ({ playerStats }) => `The underpass hides the delivery, but the long climb drains battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -9 }],
      },
    },
    phase3: {
      name: "Security Divider",
      successText: "You clear the security divider and keep every pizza box upright.",
      failureText: ({ playerStats }) => `The divider slams your deck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -8,
      speedPenalty: -1,
    },
    phase4: {
      name: "Drone Marshal",
      successText: "You lose the drone marshal in a knot of transit lights and crowd noise.",
      failureText: ({ playerStats }) => `A drone marshal forces a hard brake and leaves ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -14,
    },
    phase5: {
      name: "Barracks Drop",
      successText: ({ playerStats }) => `You hand over the pizzas with ${playerStats.batteryRemaining} RNG left and the corridor troops finally get a hot meal.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the troops smell dinner without ever seeing it.`,
    },
  },
  {
    id: "electropolis-neighbor-line",
    name: "Operation: Neighbor Line",
    district: "Electropolis",
    pinLabel: "Neighbor",
    tagline: "Help neighboring factions move supplies through Electropolis without the Fuzz shutting the route.",
    briefing: "The Wooders and Static Pack need a clean corridor run through Electropolis. Escort their mutual-aid parcel out of the transit strip before it gets confiscated.",
    thresholds: { stealth: 7, acceleration: 7, speed: 7, battery: 13 },
    phase1: {
      name: "Corridor Badge Scan",
      successText: "You spoof the corridor badge scan and keep the aid parcel moving.",
      failureText: ({ playerStats }) => `The scan lingers on your fake badge. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 2,
    },
    item: {
      id: "neighbor-aid-parcel",
      name: "Neighbor Aid Parcel",
      description: "Medical wraps, filters, and spare cells promised to allied crews.",
      narrativeText: "You secure the aid parcel to your back. The rigid case drags active SPD down by 1 until hand-off.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Border Choice",
      prompt: "A lit surface corridor gets you to the district edge fast. A drainage arcade below keeps you hidden but drains charge climbing back out.",
      optionA: {
        label: "Surface corridor",
        description: "Go fast and risk being tagged by the Fuzz.",
        narrativeText: ({ playerStats }) => `You run the surface corridor in full view and heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Drainage arcade",
        description: "Hide the parcel underground and trade battery for cover.",
        narrativeText: ({ playerStats }) => `The drainage arcade keeps the parcel safe, but the climb burns battery down to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Checkpoint Drop",
      successText: "You clear the checkpoint drop before the barrier arms can lock.",
      failureText: ({ playerStats }) => `A barrier arm catches your deck. Health falls to ${playerStats.health}% and SPD drops to ${playerStats.speed}.`,
      healthPenaltyPct: -9,
      speedPenalty: -1,
    },
    phase4: {
      name: "Transit Suppressors",
      successText: "You outfox the transit suppressors and keep the neighboring factions supplied.",
      failureText: ({ playerStats }) => `A suppressor pulse clips the pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Faction Hand-Off",
      successText: ({ playerStats }) => `You finish the hand-off with ${playerStats.batteryRemaining} RNG left and Electropolis none the wiser.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the neighboring factions lose the corridor window.`,
    },
  },
  {
    id: "nightshade-midnight-organ",
    name: "Operation: Midnight Organ",
    district: "Nightshade",
    pinLabel: "Midnight",
    tagline: "Deliver a black-bag organ through Nightshade's tunnels before the blackout shutters fall.",
    briefing: "A tunnel clinic needs a fresh organ now, not at dawn. Take the black-bag case through Nightshade and get it to the surgeons before the shutters trap you below.",
    thresholds: { stealth: 8, acceleration: 7, speed: 7, battery: 12 },
    phase1: {
      name: "Tunnel Watch",
      successText: "You slide under the tunnel watch and keep the organ case out of every lantern beam.",
      failureText: ({ playerStats }) => `A lookout whistles your line. Heat rises to ${playerStats.heatLevel} and the deep crews start listening.`,
      heatPenalty: 1,
    },
    item: {
      id: "nightshade-organ-case",
      name: "Nightshade Organ Case",
      description: "A chilled black-bag organ pod wrapped in quilted insulation.",
      narrativeText: "You lock the organ case to your side. The awkward bulk drops active SPD by 1 until delivery.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Underpass Split",
      prompt: "A lit service road gets you to the clinic quickly. A flooded underpass stays hidden, but its charged runoff drains the pack.",
      optionA: {
        label: "Lit service road",
        description: "Stay fast above the floodwater and trust the shadows.",
        narrativeText: ({ playerStats }) => `You take the service road in plain neon. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Flooded underpass",
        description: "Hide in the dark water and sacrifice battery.",
        narrativeText: ({ playerStats }) => `You wade the flooded underpass unseen, but the runoff drags battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -12 }],
      },
    },
    phase3: {
      name: "Floodgate Lift",
      successText: "You clear the floodgate lift before the shutter buries the route.",
      failureText: ({ playerStats }) => `The shutter skims your deck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Glowhound Pack",
      successText: "You leave the glowhound pack snapping at sparks in a dead tunnel.",
      failureText: ({ playerStats }) => `The glowhounds force a hard brake and leave you with ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Clinic Climb",
      successText: ({ playerStats }) => `You crest the clinic climb with ${playerStats.batteryRemaining} RNG left and the organ still cold enough to save a life.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and Nightshade's clinic loses its chance.`,
    },
  },
  {
    id: "nightshade-shelter-line",
    name: "Operation: Shelter Line",
    district: "Nightshade",
    pinLabel: "Shelter",
    tagline: "Feed the needy in blackout shelters before the tunnel gangs loot the stock.",
    briefing: "Nightshade's shelter kitchens are down to crumbs. Push meal packs through the blackout zone and get them there before the gangs strip the line.",
    thresholds: { stealth: 7, acceleration: 7, speed: 7, battery: 12 },
    phase1: {
      name: "Laneway Lookouts",
      successText: "You drift through the lookout lanes and keep the shelter run quiet.",
      failureText: ({ playerStats }) => `A laneway caller spots the food packs. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 1,
    },
    item: {
      id: "shelter-meal-packs",
      name: "Shelter Meal Packs",
      description: "Hot meal packs wrapped in reflective foil and stacked high.",
      narrativeText: "You strap the meal packs down. Their foil flashes under the lights and drops active STEALTH by 1.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Blackout Choice",
      prompt: "The upper lane is quick but watched by every hungry crew. The lower storm pipe stays hidden and drains battery through standing water.",
      optionA: {
        label: "Upper lane",
        description: "Take the faster line and risk being seen.",
        narrativeText: ({ playerStats }) => `You hit the upper lane and every window turns toward you. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Storm pipe",
        description: "Stay hidden in the pipe and spend battery in the water.",
        narrativeText: ({ playerStats }) => `The storm pipe hides the meal packs, but the water drags battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -11 }],
      },
    },
    phase3: {
      name: "Shutter Gap",
      successText: "You punch through the shutter gap and keep the meal packs dry.",
      failureText: ({ playerStats }) => `A shutter edge clips your deck. Health falls to ${playerStats.health}% and SPD drops to ${playerStats.speed}.`,
      healthPenaltyPct: -9,
      speedPenalty: -1,
    },
    phase4: {
      name: "Tunnel Looters",
      successText: "You shake the looters and keep the shelter line alive.",
      failureText: ({ playerStats }) => `A looter rush forces a battery dump and leaves ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Shelter Drop",
      successText: ({ playerStats }) => `You reach the shelters with ${playerStats.batteryRemaining} RNG left and the blackout kitchens can serve again.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the shelters stay hungry through the blackout.`,
    },
  },
  {
    id: "nightshade-glowhound-breakers",
    name: "Operation: Glowhound Breakers",
    district: "Nightshade",
    pinLabel: "Breakers",
    tagline: "Battle a Punch Skater crew in the tunnels before they overrun the courier lanes.",
    briefing: "A Punch Skater crew has turned a tunnel junction into a toll gate. Break their hold, keep the lane open, and get your people out alive.",
    thresholds: { stealth: 7, acceleration: 7, speed: 7, battery: 12 },
    phase1: {
      name: "Staging Shadows",
      successText: "You stage in pure shadow and the tunnel crew never sees the strike team form up.",
      failureText: ({ playerStats }) => `A raider catches the setup and heat jumps to ${playerStats.heatLevel} before the first swing.`,
      heatPenalty: 1,
    },
    item: {
      id: "breaker-kit",
      name: "Breaker Kit",
      description: "A shock baton, spare wheels, and road flares for tunnel combat.",
      narrativeText: "You lock the breaker kit onto your back. The added weight drops active SPD by 1 during the fight.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Fight Line",
      prompt: "Rush the junction head-on and keep speed, or slip a side pipe to flank them while the detour drains more battery.",
      optionA: {
        label: "Head-on rush",
        description: "Break them with speed and accept the attention.",
        narrativeText: ({ playerStats }) => `You launch the head-on rush and the whole junction lights up. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Side-pipe flank",
        description: "Stay hidden until the hit and spend battery on the detour.",
        narrativeText: ({ playerStats }) => `The side pipe gets you a clean flank, but the detour drains battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Scrap Ramp",
      successText: "You clear the scrap ramp and crash into the junction at full force.",
      failureText: ({ playerStats }) => `The ramp bucks your deck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Punch Skater Bruisers",
      successText: "You break the bruisers, scatter the toll crew, and reopen the lane.",
      failureText: ({ playerStats }) => `A bruiser hooks your pack in the melee and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -16,
    },
    phase5: {
      name: "Lane Hold",
      successText: ({ playerStats }) => `You hold the lane with ${playerStats.batteryRemaining} RNG left and Nightshade's couriers flow again.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the toll crew regains the tunnel.`,
    },
  },
  {
    id: "forest-resin-hunt",
    name: "Operation: Resin Hunt",
    district: "The Forest",
    pinLabel: "Resin",
    tagline: "Hunt for organic lubricant resin before the Wooders' mills seize in the wet season.",
    briefing: "The Wooders refine a tree resin into chain lubricant. Get a fresh haul from deep canopy taps and return before the rain and raiders spoil the harvest.",
    thresholds: { stealth: 6, acceleration: 8, speed: 7, battery: 14 },
    phase1: {
      name: "Canopy Wardens",
      successText: "You pass the canopy wardens without disturbing a single bridge lantern.",
      failureText: ({ playerStats }) => `A branch snaps under your wheels. Heat rises to ${playerStats.heatLevel} and the wardens start calling through the trees.`,
      heatPenalty: 1,
    },
    item: {
      id: "resin-lube-casks",
      name: "Resin Lube Casks",
      description: "Sap-lube casks sealed in bark wrap and sloshing on every carve.",
      narrativeText: "You tie the resin casks to the deck. Their sway drops active SPD by 1 until the mills get their oil.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Root Bridge Choice",
      prompt: "A high root bridge is the fastest line through the canopy. A mossy creek path stays hidden, but the mud drains charge hard.",
      optionA: {
        label: "High root bridge",
        description: "Keep the casks high and move fast.",
        narrativeText: ({ playerStats }) => `You take the root bridge in full view of the canopy. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Creek path",
        description: "Stay hidden under the leaves and spend battery in the mud.",
        narrativeText: ({ playerStats }) => `The creek path keeps the casks hidden, but the mud drags battery down to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -11 }],
      },
    },
    phase3: {
      name: "Rope Lift",
      successText: "You clear the rope lift before the rain-slick pulleys can throw you back down.",
      failureText: ({ playerStats }) => `A pulley bucks your deck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Timber Raiders",
      successText: "You shake the timber raiders among the trunks and keep the resin safe.",
      failureText: ({ playerStats }) => `A raider strike batters your pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "Mill Return",
      successText: ({ playerStats }) => `You return with ${playerStats.batteryRemaining} RNG left and enough resin to keep every mill alive through the rain.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the mills grind toward a dry halt.`,
    },
  },
  {
    id: "forest-canopy-stand",
    name: "Operation: Canopy Stand",
    district: "The Forest",
    pinLabel: "Canopy",
    tagline: "Defend the timber bridges against a Punch Skater horde before they burn the commune out.",
    briefing: "A Punch Skater horde is climbing the timber approaches. Hold the bridges, keep the Wooders alive, and push the horde back into the mud.",
    thresholds: { stealth: 6, acceleration: 8, speed: 7, battery: 14 },
    phase1: {
      name: "Treewatch",
      successText: "You reach the forward bridge while the horde is still guessing which trail matters.",
      failureText: ({ playerStats }) => `The horde spots the bridge defense forming. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 1,
    },
    item: {
      id: "bridge-defense-bundle",
      name: "Bridge Defense Bundle",
      description: "Spike strips, lantern charges, and rope hooks for the bridge fight.",
      narrativeText: "You shoulder the defense bundle. Its weight drops active SPD by 1 during the hold.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Defense Lane",
      prompt: "Hold the high bridge for a faster retreat, or sink into the root trench and spend battery powering the warning lights.",
      optionA: {
        label: "High bridge",
        description: "Keep speed and dare the horde to climb.",
        narrativeText: ({ playerStats }) => `You take the high bridge and the horde sees exactly where to rush. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Root trench",
        description: "Stay hidden below and spend battery on the warning grid.",
        narrativeText: ({ playerStats }) => `The trench hides the defense line, but the warning lights drain battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Bridge Snap",
      successText: "You leap the snapped bridge segment and keep the defense line intact.",
      failureText: ({ playerStats }) => `The broken planks hammer your deck. Health falls to ${playerStats.health}% and SPD drops to ${playerStats.speed}.`,
      healthPenaltyPct: -11,
      speedPenalty: -1,
    },
    phase4: {
      name: "Punch Skater Horde",
      successText: "You break the horde's lead rush and save the commune's bridge line.",
      failureText: ({ playerStats }) => `The horde batters your pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -16,
    },
    phase5: {
      name: "Bridge Hold",
      successText: ({ playerStats }) => `You hold the bridge with ${playerStats.batteryRemaining} RNG left and the Wooders keep their canopy home.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the horde forces its way onto the bridges.`,
    },
  },
  {
    id: "forest-mutual-aid",
    name: "Operation: Mutual Aid Timber",
    district: "The Forest",
    pinLabel: "Aid Timber",
    tagline: "Help neighboring factions by bringing timber medicine and food out of the canopy.",
    briefing: "The Wooders promised herbal meds and smoked rations to allies in the city. Carry the aid bundle down the timber route before raiders or weather take it.",
    thresholds: { stealth: 6, acceleration: 8, speed: 7, battery: 13 },
    phase1: {
      name: "Commune Gate",
      successText: "You leave the commune clean, with only the treewatch knowing the route.",
      failureText: ({ playerStats }) => `The aid train creaks too loud leaving the gate. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 1,
    },
    item: {
      id: "wooder-aid-bundle",
      name: "Wooder Aid Bundle",
      description: "Herbal poultices, rations, and carved parts packed in a timber crate.",
      narrativeText: "You secure the aid bundle to the board. The crate drops active SPD by 1 until the city hand-off.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Timber Route Split",
      prompt: "A ridge route gets you out fast but leaves you silhouetted. A fern tunnel keeps you hidden and spends more battery fighting roots.",
      optionA: {
        label: "Ridge route",
        description: "Stay quick above the trees and risk being seen.",
        narrativeText: ({ playerStats }) => `You take the ridge in full silhouette. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Fern tunnel",
        description: "Stay hidden in the brush and spend charge on the rough line.",
        narrativeText: ({ playerStats }) => `The fern tunnel hides the crate, but the roots drag battery down to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Branch Ladder",
      successText: "You clear the branch ladder and keep the aid crate from splintering.",
      failureText: ({ playerStats }) => `The ladder throws your deck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Roadside Raiders",
      successText: "You shake the roadside raiders and keep the neighboring factions supplied.",
      failureText: ({ playerStats }) => `A raider rush forces a battery dump and leaves ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -15,
    },
    phase5: {
      name: "City Hand-Off",
      successText: ({ playerStats }) => `You make the city hand-off with ${playerStats.batteryRemaining} RNG left and the neighboring factions fed and patched up.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the aid never clears the timber line.`,
    },
  },
  {
    id: "glass-city-lifeline-case",
    name: "Operation: Lifeline Case",
    district: "Glass City",
    pinLabel: "Lifeline",
    tagline: "Deliver a stolen organ case through Glass City before a private clinic loses its patient.",
    briefing: "A private clinic in Glass City needs a fresh organ that UCA procurement would rather deny. Steal the case, cross the towers, and get it there before the timer expires.",
    thresholds: { stealth: 7, acceleration: 8, speed: 8, battery: 15 },
    phase1: {
      name: "Lobby Drone",
      successText: "You slip past the lobby drone with the organ case masked as luxury biotech.",
      failureText: ({ playerStats }) => `The lobby drone tags the med-case seal. Heat spikes to ${playerStats.heatLevel} inside the tower.`,
      heatPenalty: 2,
    },
    item: {
      id: "glass-organ-case",
      name: "Glass Organ Case",
      description: "A silent cryo-case with mirrored panels and zero forgiveness.",
      narrativeText: "You steal the organ case from the clinic vault. The case drags active STEALTH down by 1 under the tower lights.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Atrium Split",
      prompt: "A polished atrium lane is fast but fully watched. A maintenance spine below is darker and more expensive on battery.",
      optionA: {
        label: "Atrium lane",
        description: "Move fast across the glass and accept the cameras.",
        narrativeText: ({ playerStats }) => `You cut across the atrium and every lens wakes up. Heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Maintenance spine",
        description: "Stay hidden beneath the tower and let the climb drain charge.",
        narrativeText: ({ playerStats }) => `The maintenance spine keeps the case hidden, but the climb burns battery down to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Blast Doors",
      successText: "You hit the throttle and clear the blast doors before they seal the lane.",
      failureText: ({ playerStats }) => `The blast doors clip your deck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -15,
      speedPenalty: -1,
    },
    phase4: {
      name: "Aero-Fuzz Drone",
      successText: "You burn the Aero-Fuzz drone in the tower canyons and keep the case intact.",
      failureText: ({ playerStats }) => `The drone tasers your pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -20,
    },
    phase5: {
      name: "Clinic Arrival",
      successText: ({ playerStats }) => `You reach the clinic with ${playerStats.batteryRemaining} RNG left and the organ case still viable.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and the clinic loses its last chance.`,
    },
  },
  {
    id: "glass-city-thumb-drive",
    name: "Operation: Penthouse Thumb Drive",
    district: "Glass City",
    pinLabel: "Penthouse",
    tagline: "Steal a thumb drive from a silent penthouse and outrun the response drones.",
    briefing: "A Glass City executive moved his leverage onto a physical thumb drive. Get into the penthouse, take it, and survive the drop back into the transitional zone.",
    thresholds: { stealth: 7, acceleration: 8, speed: 8, battery: 15 },
    phase1: {
      name: "Concierge Mesh",
      successText: "You drift through the concierge mesh and into the penthouse with the room still convinced you belong.",
      failureText: ({ playerStats }) => `The concierge mesh catches your route. Heat jumps to ${playerStats.heatLevel}.`,
      heatPenalty: 2,
    },
    item: {
      id: "executive-thumb-drive",
      name: "Executive Thumb Drive",
      description: "A blackmail drive in a mirrored sleeve that flashes under luxury light.",
      narrativeText: "You pocket the executive thumb drive. Its mirrored sleeve drops active STEALTH by 1 for the rest of the escape.",
      modifiers: [{ stat: "stealth", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Glass Escape",
      prompt: "The atrium is quickest but leaves you floating in every camera feed. The service shaft is quieter and drains battery on the climb.",
      optionA: {
        label: "Atrium drop",
        description: "Trust speed and vanish after the cameras see you.",
        narrativeText: ({ playerStats }) => `You commit to the atrium drop and heat climbs to ${playerStats.heatLevel} before you land.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Service shaft",
        description: "Stay hidden in the shaft and spend more battery on the descent control.",
        narrativeText: ({ playerStats }) => `The shaft keeps you hidden, but constant braking drains battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Security Doors",
      successText: "You thread the security doors before the lock cycle traps you inside the tower.",
      failureText: ({ playerStats }) => `A security door catches your rear truck. Health drops to ${playerStats.health}% and SPD falls to ${playerStats.speed}.`,
      healthPenaltyPct: -12,
      speedPenalty: -1,
    },
    phase4: {
      name: "Response Drones",
      successText: "You dump the response drones into a maze of mirrored balconies.",
      failureText: ({ playerStats }) => `A response drone scorches the battery pack and leaves ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -18,
    },
    phase5: {
      name: "Transitional Zone",
      successText: ({ playerStats }) => `You clear the transitional zone with ${playerStats.batteryRemaining} RNG left and the thumb drive still unread.`,
      failureText: ({ playerStats }) => `Your board dies at ${playerStats.batteryRemaining} RNG and the penthouse pulls its secrets back behind glass.`,
    },
  },
  {
    id: "glass-city-boutique-parts",
    name: "Operation: Boutique Parts",
    district: "Glass City",
    pinLabel: "Boutique",
    tagline: "Shop the luxury board boutiques for elite parts before the towers lock their inventories.",
    briefing: "Glass City keeps absurdly good skateboard parts for the rich alone. Lift a boutique haul and get it back to the crews before the towers notice the shelves are light.",
    thresholds: { stealth: 7, acceleration: 8, speed: 8, battery: 14 },
    phase1: {
      name: "Showroom Silence",
      successText: "You slip the boutique floor without disturbing a single sensor-polished display.",
      failureText: ({ playerStats }) => `A showroom lens catches the wrong reflection. Heat rises to ${playerStats.heatLevel}.`,
      heatPenalty: 2,
    },
    item: {
      id: "luxury-parts-haul",
      name: "Luxury Parts Haul",
      description: "Ceramic bearings, precision trucks, and handcrafted decks in a velvet hard case.",
      narrativeText: "You seize the luxury parts haul. The hard case drags active SPD down by 1 until you break line-of-sight.",
      modifiers: [{ stat: "speed", amount: -1, duration: "mission" }],
    },
    fork: {
      name: "Tower Exit",
      prompt: "A gallery overpass gets you out quickly in plain view. A delivery shaft stays hidden but drains the pack on repeated lifts.",
      optionA: {
        label: "Gallery overpass",
        description: "Stay quick and trust the crowd to blur you.",
        narrativeText: ({ playerStats }) => `You cut the overpass under bright glass and heat climbs to ${playerStats.heatLevel}.`,
        effects: [{ type: "adjust", stat: "heatLevel", amount: 1 }],
      },
      optionB: {
        label: "Delivery shaft",
        description: "Stay hidden in freight access and spend battery on the lifts.",
        narrativeText: ({ playerStats }) => `The delivery shaft hides the haul, but the lifts drain battery to ${playerStats.batteryRemaining} RNG.`,
        effects: [{ type: "adjustPercent", stat: "batteryRemaining", percent: -10 }],
      },
    },
    phase3: {
      name: "Mirror Ramp",
      successText: "You clear the mirror ramp and keep the case from exploding open across the tower floor.",
      failureText: ({ playerStats }) => `The ramp bucks your deck. Health falls to ${playerStats.health}% and SPD drops to ${playerStats.speed}.`,
      healthPenaltyPct: -10,
      speedPenalty: -1,
    },
    phase4: {
      name: "Concierge Hunters",
      successText: "You dump the concierge hunters at the edge of the glass district.",
      failureText: ({ playerStats }) => `A hunter drone catches your pack and leaves you at ${playerStats.batteryRemaining} RNG.`,
      batteryPenaltyPct: -17,
    },
    phase5: {
      name: "Crew Safehouse",
      successText: ({ playerStats }) => `You reach the safehouse with ${playerStats.batteryRemaining} RNG left and enough boutique parts to kit out the whole crew.`,
      failureText: ({ playerStats }) => `The board dies at ${playerStats.batteryRemaining} RNG and the tower keeps its toys.`,
    },
  },
];

export const DISTRICT_MISSIONS: DistrictMissionDefinition[] = DISTRICT_MISSION_BLUEPRINTS.map(createDistrictMission);

function getMissionDefinition(missionId: string): DistrictMissionDefinition {
  return DISTRICT_MISSIONS.find((mission) => mission.id === missionId) ?? DISTRICT_MISSIONS[0];
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
