import type { District } from "./types";

export type BoardType = "Street" | "AT" | "Mountain" | "Surf" | "Slider";
export type Drivetrain = "Belt" | "Hub" | "Gear" | "4WD";
export type MotorType = "Micro" | "Standard" | "Torque" | "Outrunner";
export type WheelType = "Urethane" | "Pneumatic" | "Rubber" | "Cloud";
export type BatteryType = "SlimStealth" | "DoubleStack" | "TopPeli";

export interface BoardConfig {
  boardType: BoardType;
  drivetrain: Drivetrain;
  motor: MotorType;
  wheels: WheelType;
  battery: BatteryType;
}

/** Stat keys that board bonuses can affect (mirrors CardPayload.stats). */
export type BoardStatKey = "speed" | "stealth" | "tech" | "grit" | "rep";

export interface BoardOption<T extends string> {
  value: T;
  label: string;
  icon: string;
  tagline: string;
  description: string;
  statBonuses: Partial<Record<BoardStatKey, number>>;
}

export interface MotorOption {
  value: MotorType;
  label: string;
  icon: string;
  tagline: string;
  description: string;
  acceleration: number;
  statBonuses: Partial<Record<BoardStatKey, number>>;
}

export interface BatteryOption {
  value: BatteryType;
  label: string;
  icon: string;
  tagline: string;
  description: string;
  range: number;
  isTopMounted: boolean;
  statBonuses: Partial<Record<BoardStatKey, number>>;
}

export interface BoardComponentModel {
  category: "Deck" | "Wheel" | "Drivetrain" | "Motor" | "Battery" | "Truck";
  name: string;
  description: string;
  seedKey: string;
  icon: string;
  style?: string;
  speed?: number;
  acceleration?: number;
  accessProfile?: string;
  range?: number;
  isTopMounted?: boolean;
}

export interface BoardComponentImageUrls {
  deckUrl: string;
  drivetrainUrl: string;
  motorUrl: string;
  wheelsUrl: string;
  batteryUrl: string;
}

export interface BoardLoadout {
  style: string;
  speed: number;
  acceleration: number;
  accessProfile: string;
  range: number;
}

export interface CompatibilityError {
  component: "drivetrain" | "motor" | "wheels" | "battery";
  message: string;
}

export interface AllowedBoardComponents {
  drivetrains: Drivetrain[];
  motors: MotorType[];
  wheels: WheelType[];
  batteries: BatteryType[];
}

export const DISTRICT_ACCESS_ORDER: District[] = [
  "Airaway",
  "Nightshade",
  "Batteryville",
  "The Grid",
  "The Forest",
  "Glass City",
];
