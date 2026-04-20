import { BATTERY_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS } from "./boardBuilderOptions";
import type {
  AllowedBoardComponents,
  BoardConfig,
  BoardType,
  CompatibilityError,
} from "./boardBuilderTypes";

const LEGACY_FOUR_WHEEL_DRIVE = "A" + "WD";

function normalizeDrivetrain(drivetrain: string) {
  return drivetrain === LEGACY_FOUR_WHEEL_DRIVE ? "4WD" : drivetrain;
}

export function normalizeBoardConfig(config: BoardConfig): BoardConfig {
  return {
    ...config,
    drivetrain: normalizeDrivetrain(config.drivetrain) as BoardConfig["drivetrain"],
  };
}

export function validateBoardCompatibility(config: BoardConfig): CompatibilityError[] {
  const normalizedConfig = normalizeBoardConfig(config);
  const errors: CompatibilityError[] = [];
  const batteryOpt = BATTERY_OPTIONS.find((option) => option.value === normalizedConfig.battery);
  const isTopMount = batteryOpt?.isTopMounted ?? false;

  switch (normalizedConfig.boardType) {
    case "Street":
      if (isTopMount) {
        errors.push({ component: "battery", message: "Carbon Fiber deck cannot use a top-mounted battery." });
      }
      if (normalizedConfig.drivetrain === "4WD") {
        errors.push({ component: "drivetrain", message: "Street board cannot use 4WD drivetrain." });
      }
      break;
    case "Mountain":
      if (normalizedConfig.wheels === "Urethane") {
        errors.push({ component: "wheels", message: "Mountain board cannot use Poly (Urethane) wheels." });
      }
      if (normalizedConfig.wheels === "Cloud") {
        errors.push({ component: "wheels", message: "Mountain board cannot use Cloud wheels." });
      }
      if (!isTopMount) {
        errors.push({ component: "battery", message: "Mountain board must use a top-mounted battery." });
      }
      if (normalizedConfig.drivetrain !== "4WD") {
        errors.push({ component: "drivetrain", message: "Mountain board must use 4WD drivetrain." });
      }
      if (normalizedConfig.motor === "Micro") {
        errors.push({ component: "motor", message: "Mountain board cannot use the Micro 5055 motor." });
      }
      break;
    case "Surf":
      if (isTopMount) {
        errors.push({ component: "battery", message: "Surf skateboard cannot use a top-mounted battery." });
      }
      if (normalizedConfig.battery === "DoubleStack") {
        errors.push({ component: "battery", message: "Surf skateboard cannot use the Double-Stack Brick battery." });
      }
      if (normalizedConfig.wheels === "Pneumatic") {
        errors.push({ component: "wheels", message: "Surf skateboard cannot use Pneumatic wheels." });
      }
      if (normalizedConfig.wheels === "Rubber") {
        errors.push({ component: "wheels", message: "Surf skateboard cannot use Solid Rubber wheels." });
      }
      if (normalizedConfig.drivetrain === "Belt") {
        errors.push({ component: "drivetrain", message: "Surf skateboard cannot use Belt drive." });
      }
      if (normalizedConfig.drivetrain === "4WD") {
        errors.push({ component: "drivetrain", message: "Surf skateboard cannot use 4WD drivetrain." });
      }
      if (normalizedConfig.motor === "Torque") {
        errors.push({ component: "motor", message: "Surf skateboard cannot use the Torque 6374 motor." });
      }
      if (normalizedConfig.motor === "Outrunner") {
        errors.push({ component: "motor", message: "Surf skateboard cannot use the Outrunner 6396 motor." });
      }
      break;
    case "AT":
      if (isTopMount) {
        errors.push({ component: "battery", message: "Bamboo deck cannot use a top-mounted battery." });
      }
      if (normalizedConfig.drivetrain === "4WD") {
        errors.push({ component: "drivetrain", message: "All-Terrain board cannot use 4WD drivetrain." });
      }
      if (normalizedConfig.motor === "Micro") {
        errors.push({ component: "motor", message: "All-Terrain board cannot use the Micro 5055 motor." });
      }
      break;
  }

  return errors;
}

export function getAllowedComponents(boardType: BoardType): AllowedBoardComponents {
  const allDrivetrains = DRIVETRAIN_OPTIONS.map((option) => option.value);
  const allMotors = MOTOR_OPTIONS.map((option) => option.value);
  const allWheels = WHEEL_OPTIONS.map((option) => option.value);
  const allBatteries = BATTERY_OPTIONS.map((option) => option.value);
  const nonTopMountBatteries = BATTERY_OPTIONS.filter((option) => !option.isTopMounted).map((option) => option.value);
  const topMountBatteries = BATTERY_OPTIONS.filter((option) => option.isTopMounted).map((option) => option.value);
  const no4WD = allDrivetrains.filter((drivetrain) => drivetrain !== "4WD");

  switch (boardType) {
    case "Street":
      return { drivetrains: no4WD, motors: allMotors, wheels: allWheels, batteries: nonTopMountBatteries };
    case "Mountain":
      return {
        drivetrains: ["4WD"],
        motors: allMotors.filter((motor) => motor !== "Micro"),
        wheels: ["Pneumatic", "Rubber"],
        batteries: topMountBatteries,
      };
    case "Surf":
      return {
        drivetrains: allDrivetrains.filter((drivetrain) => drivetrain !== "Belt" && drivetrain !== "4WD"),
        motors: allMotors.filter((motor) => motor !== "Torque" && motor !== "Outrunner"),
        wheels: allWheels.filter((wheel) => wheel !== "Pneumatic" && wheel !== "Rubber"),
        batteries: nonTopMountBatteries.filter((battery) => battery !== "DoubleStack"),
      };
    case "AT":
      return {
        drivetrains: no4WD,
        motors: allMotors.filter((motor) => motor !== "Micro"),
        wheels: allWheels,
        batteries: nonTopMountBatteries,
      };
    case "Slider":
    default:
      return { drivetrains: allDrivetrains, motors: allMotors, wheels: allWheels, batteries: allBatteries };
  }
}

export function enforceCompatibility(config: BoardConfig): BoardConfig {
  const normalizedConfig = normalizeBoardConfig(config);
  const allowed = getAllowedComponents(normalizedConfig.boardType);
  return {
    boardType: normalizedConfig.boardType,
    drivetrain: allowed.drivetrains.includes(normalizedConfig.drivetrain) ? normalizedConfig.drivetrain : allowed.drivetrains[0],
    motor: allowed.motors.includes(normalizedConfig.motor) ? normalizedConfig.motor : allowed.motors[0],
    wheels: allowed.wheels.includes(normalizedConfig.wheels) ? normalizedConfig.wheels : allowed.wheels[0],
    battery: allowed.batteries.includes(normalizedConfig.battery) ? normalizedConfig.battery : allowed.batteries[0],
  };
}
