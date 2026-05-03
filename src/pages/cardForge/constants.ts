import type {
  AgeGroup,
  BodyType,
  District,
  FaceCharacter,
  Gender,
  HairLength,
  Rarity,
  SkinTone,
} from "../../lib/types";
import type { ImageGenOptions } from "../../services/imageGen";

export const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare"];
export const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
export const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];
export const AGE_GROUPS: AgeGroup[] = ["Young Adult", "Adult", "Middle-aged", "Senior"];
export const BODY_TYPES: BodyType[] = ["Slim", "Athletic", "Average", "Heavy"];
export const HAIR_LENGTHS: HairLength[] = ["Bald", "Short", "Medium", "Long"];
export const SKIN_TONES: SkinTone[] = ["Light", "Medium", "Dark", "Very Dark"];
export const FACE_CHARACTERS: FaceCharacter[] = ["Conventional", "Attractive", "Weathered", "Scarred", "Rugged"];
export const RANDOM_SKATER_TOOLTIP = "Randomizes the Character loadout and the Board loadout with one click.";
export const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#3366ff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];
export const CHARACTER_CACHE_VERSION = "v7-no-skateboard-terms";
export const CHARACTER_GENERATION_OPTIONS: ImageGenOptions = {
  imageSize: { width: 750, height: 1050 },
  numInferenceSteps: 28,
  guidanceScale: 4,
  falProfile: "character",
};
export const NON_LORA_GENERATION_OPTIONS: ImageGenOptions = {
  loras: [],
};
export const CHARACTER_MIN_DIMENSIONS = { width: 750, height: 1050 };
export const CHARACTER_SEED_VARIANTS = ["hq-a", "hq-b"];
