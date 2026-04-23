import { buildRandomBoardConfig, getRandomItemExcluding } from "../../lib/cardForgeRandom";
import { resolveArchetypeStyle } from "../../lib/styles";
import type { CardPayload, CardPrompts } from "../../lib/types";
import type { BoardConfig } from "../../lib/boardBuilder";
import {
  ACCENT_PRESETS,
  AGE_GROUPS,
  BODY_TYPES,
  DISTRICTS,
  GENDERS,
  HAIR_LENGTHS,
  RARITIES,
  SKIN_TONES,
  FACE_CHARACTERS,
} from "./constants";

export function buildRandomizedPrompts(prompts: CardPrompts, archetypeValues: readonly CardPrompts["archetype"][]) {
  const archetype = getRandomItemExcluding(archetypeValues, prompts.archetype);
  return {
    ...prompts,
    archetype,
    style: resolveArchetypeStyle(archetype, prompts.style),
    rarity: getRandomItemExcluding(RARITIES, prompts.rarity),
    district: getRandomItemExcluding(DISTRICTS, prompts.district),
    accentColor: getRandomItemExcluding(ACCENT_PRESETS, prompts.accentColor),
    gender: getRandomItemExcluding(GENDERS, prompts.gender),
    ageGroup: getRandomItemExcluding(AGE_GROUPS, prompts.ageGroup),
    bodyType: getRandomItemExcluding(BODY_TYPES, prompts.bodyType),
    hairLength: getRandomItemExcluding(HAIR_LENGTHS, prompts.hairLength),
    skinTone: getRandomItemExcluding(SKIN_TONES, prompts.skinTone),
    faceCharacter: getRandomItemExcluding(FACE_CHARACTERS, prompts.faceCharacter),
  };
}

export function buildRandomizedBoardConfig(boardConfig: BoardConfig) {
  return buildRandomBoardConfig(boardConfig);
}

export function applyPreviewUpdates(card: CardPayload | null, updates: { name?: string; age?: string; flavorText?: string }): CardPayload | null {
  if (!card) return card;

  return {
    ...card,
    identity: (updates.name != null || updates.age != null)
      ? {
          ...card.identity,
          ...(updates.name != null ? { name: updates.name } : {}),
          ...(updates.age != null ? { age: updates.age } : {}),
        }
      : card.identity,
    front: {
      ...card.front,
      ...(updates.flavorText != null ? { flavorText: updates.flavorText } : {}),
    },
  };
}
