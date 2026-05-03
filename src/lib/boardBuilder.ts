export type {
  AllowedBoardComponents,
  BatteryOption,
  BatteryType,
  BoardComponentImageUrls,
  BoardComponentModel,
  BoardConfig,
  BoardLoadout,
  BoardOption,
  BoardStatKey,
  BoardType,
  CompatibilityError,
  Drivetrain,
  MotorOption,
  MotorType,
  SkateStats,
  WheelType,
} from "./boardBuilderTypes";

export {
  BATTERY_OPTIONS,
  BOARD_TYPE_OPTIONS,
  DEFAULT_BOARD_CONFIG,
  DRIVETRAIN_OPTIONS,
  MOTOR_OPTIONS,
  WHEEL_OPTIONS,
} from "./boardBuilderOptions";

export {
  BOARD_COMPONENT_IMAGE_URLS,
  BATTERY_SEED,
  BOARD_COMPONENT_CATALOG,
  BOARD_TYPE_DECK_SEED,
  DRIVETRAIN_SEED,
  MOTOR_SEED,
  WHEEL_SEED,
  getBoardAssetUrls,
  getBoardComponentImageUrls,
} from "./boardBuilderCatalog";

export {
  enforceCompatibility,
  getAllowedComponents,
  normalizeBoardConfig,
  validateBoardCompatibility,
} from "./boardBuilderCompatibility";

export {
  calculateBoardStats,
  getBoardStatBonuses,
  getBoardSummary,
} from "./boardBuilderStats";

export { buildBoardImagePrompt } from "./boardBuilderPrompt";

export {
  computeSkateStats,
  CRITICAL_FORGE_CHANCE,
  CRITICAL_FORGE_WEIGHT_REDUCTION,
} from "./boardBuilderStatEnvelope";
