/**
 * generator.ts
 * Logic for randomly assembling Punch-Skater character seeds.
 * Uses the synchronized lore and types derived from the Skater Punk documentation.
 */

import { 
  LORE_CHARACTER_NAMES, 
  LORE_CREWS, 
  LORE_MANUFACTURERS, 
  LORE_PASSIVE_TRAITS, 
  LORE_ACTIVE_ABILITIES, 
  LORE_FLAVOR_TEXTS 
} from './lore';
import { CardPayload, Faction, Manufacturer, District } from './types';

/**
 * Utility to grab a random element from an array.
 */
const getRandom = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Generates a randomized starting character "Run" based on the world lore.
 */
export const generateCharacterSeed = (): CardPayload => {
  const name = getRandom(LORE_CHARACTER_NAMES);
  const crew = getRandom(LORE_CREWS) as Faction;
  const manufacturer = getRandom(LORE_MANUFACTURERS) as Manufacturer;
  const trait = getRandom(LORE_PASSIVE_TRAITS);
  const ability = getRandom(LORE_ACTIVE_ABILITIES);
  const flavor = getRandom(LORE_FLAVOR_TEXTS);

  // Defaulting to a random district from the Skater Punk geography
  const districts: District[] = [
    "Airaway", "The Roads", "The Tunnels", "Batteryville", 
    "The Grid", "Electropolis", "Nightshade (The Murk)", "The Forest"
  ];

  return {
    id: `run-${Math.random().toString(36).substr(2, 9)}`,
    name,
    crew,
    district: getRandom(districts),
    manufacturer,
    passiveTrait: trait.name,
    activeAbility: ability.name,
    flavorText: flavor,
    tags: ["starter-seed", crew.toLowerCase().replace(/\s/g, '-')]
  };
};

/**
 * Example Usage:
 * const newRun = generateCharacterSeed();
 * console.log(`Starting Run: ${newRun.name} of the ${newRun.crew}`);
 */
