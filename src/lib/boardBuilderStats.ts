import { isDistrictAccessibleWithBoardType } from "./districtWeather";
import { BATTERY_OPTIONS, BOARD_TYPE_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS } from "./boardBuilderOptions";
import { BATTERY_SEED, BOARD_COMPONENT_CATALOG, BOARD_TYPE_DECK_SEED, DRIVETRAIN_SEED, MOTOR_SEED } from "./boardBuilderCatalog";
import { normalizeBoardConfig } from "./boardBuilderCompatibility";
import type { BoardConfig, BoardLoadout, BoardStatKey } from "./boardBuilderTypes";
import { DISTRICT_ACCESS_ORDER } from "./boardBuilderTypes";

const DEFAULT_STYLE = "Custom";
const DEFAULT_SPEED = 5;
const DEFAULT_ACCEL = 5;
const DEFAULT_RANGE = 5;
const DEFAULT_ACCESS_PROFILE = "General district access";

export function getBoardStatBonuses(config: BoardConfig): Partial<Record<BoardStatKey, number>> {
  const normalizedConfig = normalizeBoardConfig(config);
  const totals: Partial<Record<BoardStatKey, number>> = {};
  const selectedOptions = [
    BOARD_TYPE_OPTIONS.find((option) => option.value === normalizedConfig.boardType),
    DRIVETRAIN_OPTIONS.find((option) => option.value === normalizedConfig.drivetrain),
    MOTOR_OPTIONS.find((option) => option.value === normalizedConfig.motor),
    WHEEL_OPTIONS.find((option) => option.value === normalizedConfig.wheels),
    BATTERY_OPTIONS.find((option) => option.value === normalizedConfig.battery),
  ];

  for (const option of selectedOptions) {
    if (!option) continue;
    for (const [stat, bonus] of Object.entries(option.statBonuses) as [BoardStatKey, number][]) {
      totals[stat] = (totals[stat] ?? 0) + bonus;
    }
  }

  return totals;
}

export function getBoardSummary(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);
  const type = BOARD_TYPE_OPTIONS.find((option) => option.value === normalizedConfig.boardType);
  const drive = DRIVETRAIN_OPTIONS.find((option) => option.value === normalizedConfig.drivetrain);
  const motor = MOTOR_OPTIONS.find((option) => option.value === normalizedConfig.motor);
  const wheel = WHEEL_OPTIONS.find((option) => option.value === normalizedConfig.wheels);
  const battery = BATTERY_OPTIONS.find((option) => option.value === normalizedConfig.battery);
  return [type?.icon, normalizedConfig.boardType, "·", drive?.label, "·", motor?.label, "·", wheel?.label, "Wheels", "·", battery?.label]
    .filter(Boolean)
    .join(" ");
}

function getBoardDistrictAccessProfile(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);
  const accessibleDistricts = DISTRICT_ACCESS_ORDER.filter((district) =>
    isDistrictAccessibleWithBoardType(
      district,
      null,
      normalizedConfig.boardType,
      normalizedConfig.wheels,
    ),
  );

  return accessibleDistricts.length > 0
    ? accessibleDistricts.join(" · ")
    : DEFAULT_ACCESS_PROFILE;
}

export function calculateBoardStats(config: BoardConfig): BoardLoadout {
  const normalizedConfig = normalizeBoardConfig(config);
  const deckSeed = BOARD_TYPE_DECK_SEED[normalizedConfig.boardType];
  const driveSeed = DRIVETRAIN_SEED[normalizedConfig.drivetrain];
  const motorSeed = MOTOR_SEED[normalizedConfig.motor];
  const batterySeed = BATTERY_SEED[normalizedConfig.battery];

  const deckModel = BOARD_COMPONENT_CATALOG.find((model) => model.seedKey === deckSeed);
  const driveModel = BOARD_COMPONENT_CATALOG.find((model) => model.seedKey === driveSeed);
  const motorModel = BOARD_COMPONENT_CATALOG.find((model) => model.seedKey === motorSeed);
  const batteryModel = BOARD_COMPONENT_CATALOG.find((model) => model.seedKey === batterySeed);

  return {
    style: deckModel?.style ?? DEFAULT_STYLE,
    speed: driveModel?.speed ?? DEFAULT_SPEED,
    acceleration: motorModel?.acceleration ?? DEFAULT_ACCEL,
    accessProfile: getBoardDistrictAccessProfile(normalizedConfig),
    range: batteryModel?.range ?? DEFAULT_RANGE,
  };
}
