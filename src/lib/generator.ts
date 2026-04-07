import { LORE_CHARACTER_NAMES, ARCHETYPE_TO_FACTION, VIBE_TO_MANUFACTURER, LORE_PASSIVE_TRAITS, LORE_ACTIVE_ABILITIES } from './lore';
import { CardPayload, CardPrompts } from './types';

export const generateCard = (prompts: CardPrompts): CardPayload => {
  const name = LORE_CHARACTER_NAMES[Math.floor(Math.random() * LORE_CHARACTER_NAMES.length)];
  
  return {
    id: `forge-${Math.random().toString(36).substr(2, 9)}`,
    name,
    crew: ARCHETYPE_TO_FACTION[prompts.archetype],
    district: prompts.district,
    manufacturer: VIBE_TO_MANUFACTURER[prompts.vibe],
    passiveTrait: LORE_PASSIVE_TRAITS[0].name,
    activeAbility: LORE_ACTIVE_ABILITIES[0].name,
    flavorText: `A ${prompts.rarity} ${prompts.archetype} delivery detected in ${prompts.district}.`,
    tags: [prompts.style, prompts.vibe, prompts.rarity]
  };
};
