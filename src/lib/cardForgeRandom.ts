import type { BoardConfig } from "./boardBuilder";
import { BOARD_TYPE_OPTIONS, getAllowedComponents } from "./boardBuilder";

const BOARD_TYPES = BOARD_TYPE_OPTIONS.map((option) => option.value);
const DRIVE_ORIENTATIONS: BoardConfig["driveOrientation"][] = ["Rear-Wheel Drive", "Front-Wheel Drive"];

export function getRandomIndex(length: number): number {
  if (length === 0) {
    throw new Error("Cannot choose a random item from an empty collection.");
  }
  if (length <= 1) return 0;
  const randomBuffer = new Uint32Array(1);
  const unbiasedUpperBound = Math.floor(0x1_0000_0000 / length) * length;
  let randomValue = 0;

  do {
    crypto.getRandomValues(randomBuffer);
    randomValue = randomBuffer[0];
  } while (randomValue >= unbiasedUpperBound);

  return randomValue % length;
}

export function getRandomItem<T>(items: readonly T[]): T {
  return items[getRandomIndex(items.length)];
}

export function getRandomItemExcluding<T>(items: readonly T[], current: T): T {
  const candidates = items.filter((item) => item !== current);
  return candidates.length > 0 ? getRandomItem(candidates) : current;
}

export function buildRandomBoardConfig(currentConfig: BoardConfig): BoardConfig {
  const boardType = getRandomItemExcluding(BOARD_TYPES, currentConfig.boardType);
  const allowed = getAllowedComponents(boardType);
  return {
    boardType,
    drivetrain: getRandomItem(allowed.drivetrains),
    driveOrientation: getRandomItemExcluding(DRIVE_ORIENTATIONS, currentConfig.driveOrientation),
    motor: getRandomItem(allowed.motors),
    wheels: getRandomItem(allowed.wheels),
    battery: getRandomItem(allowed.batteries),
  };
}
