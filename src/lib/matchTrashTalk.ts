/**
 * matchTrashTalk.ts — Procedural trash talk during arena encounters.
 *
 * Workshop Feedback: "Don't Hide the Flavor in the Fridge"
 * When cards from different factions face off, generate contextual
 * cyber-Australian slang taunts using district language flavour.
 *
 * This module provides seeded, deterministic trash talk selection so
 * both players in a race/joust see the same lines. A future enhancement
 * can call CraftLingua's translate API for full conlang versions.
 */

/**
 * Faction-specific taunt pools.
 * Each faction has lines they throw at opponents.
 */
const FACTION_TAUNTS: Partial<Record<string, string[]>> = {
  "Ne0n Legion": [
    "You're runnin' dark in a lit lane, courier. Neons don't lose to shadows.",
    "Pixel dust in ya wake — that's all they'll remember of you.",
    "We upload wins, mate. You're still buffering.",
  ],
  "The Wooders": [
    "Bush telegraph says you're soft. Let's find out, yeah?",
    "You smell like city chrome. The Wooder roads eat that for brekkie.",
    "Root and branch, courier. We grow where you crack.",
  ],
  "Iron Curtains": [
    "Steel don't bend, courier. But you will.",
    "Welcome to the anvil lane. Hope ya brought grit.",
    "Curtain's dropping. Lights out for your stats.",
  ],
  "D4rk $pider": [
    "Caught in the web already, courier. Didn't even feel the thread.",
    "Every packet you send passes through us. Smile.",
    "Shadow protocol active. You won't see us till it's done.",
  ],
  "Qu111s (Quills)": [
    "Ink on parchment, courier — that's how we write your loss.",
    "Qu111s cut clean. You'll bleed data before you blink.",
    "The pen stabs deeper than the lance, mate.",
  ],
  "United Corporate Alliance (UCA)": [
    "Corporate efficiency: we win on schedule, not on hope.",
    "Your indie hustle is cute. Our margins say otherwise.",
    "Synergy report: you lose. Meeting adjourned.",
  ],
  "Hermes' Squirmies": [
    "Quick as mercury, twice as slippery. Catch us if you can.",
    "Parcel's already delivered, mate. You're racing ghosts.",
    "Winged heels don't touch tarmac. We float past.",
  ],
  "The Asclepians": [
    "We'll patch you up after — it's the healer's curse.",
    "Diagnosis: too slow. Prognosis: defeat.",
    "First do no harm? That's off the track, courier.",
  ],
};

/**
 * District-specific narrator color lines (environmental trash talk).
 */
const DISTRICT_NARRATOR_LINES: Partial<Record<string, string[]>> = {
  Airaway: [
    "The Airaway breeze carries the stench of a slow start.",
    "Chrome towers watch — the district judges speed above all.",
    "Courier radar pings — someone's about to eat turbulence.",
  ],
  Nightshade: [
    "Purple haze swallows the track. Only the bold survive Nightshade.",
    "Neon bleeds from the walls. The district hungers for a show.",
    "Nightshade doesn't forgive hesitation. Move or be consumed.",
  ],
  Batteryville: [
    "Sparks fly off the battery stacks. Batteryville fuels the fierce.",
    "Amber light scorches the slow. Batteryville demands voltage.",
    "The district hums. It knows a crash is coming.",
  ],
  "The Grid": [
    "Grid scanners lock on. Every move is logged, every flaw exposed.",
    "Blue light protocols engage. The Grid sees everything.",
    "Data streams converge — The Grid is choosing its champion.",
  ],
  "The Forest": [
    "Roots crack through the pavement. The Forest takes what it wants.",
    "Green canopy closes overhead. No satellites, no backup.",
    "The Forest path narrows. Only the strong make it through.",
  ],
  "Glass City": [
    "Reflections multiply — Glass City shows you a dozen ways to lose.",
    "Crystal spires amplify every sound. The city hears your doubt.",
    "Glass shatters for the unworthy. Prove yourself.",
  ],
};

/**
 * Seeded RNG for deterministic trash talk selection.
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export interface MatchTrashTalkResult {
  /** Challenger's faction taunt (if available). */
  challengerTaunt?: string;
  /** Defender's faction taunt (if available). */
  defenderTaunt?: string;
  /** District narrator flavor line. */
  narratorLine?: string;
}

/**
 * Generate contextual trash talk for a match-up.
 *
 * @param challengerFaction - The challenger card's faction/crew.
 * @param defenderFaction - The defender card's faction/crew.
 * @param district - The district where the encounter takes place.
 * @param seed - Deterministic seed (typically the race/match seed).
 */
export function generateMatchTrashTalk(
  challengerFaction: string | null | undefined,
  defenderFaction: string | null | undefined,
  district: string | null | undefined,
  seed: string,
): MatchTrashTalkResult {
  const h = hashSeed(seed);
  const result: MatchTrashTalkResult = {};

  // Challenger taunt
  if (challengerFaction) {
    const pool = FACTION_TAUNTS[challengerFaction];
    if (pool?.length) {
      result.challengerTaunt = pick(pool, h);
    }
  }

  // Defender taunt
  if (defenderFaction) {
    const pool = FACTION_TAUNTS[defenderFaction];
    if (pool?.length) {
      result.defenderTaunt = pick(pool, h + 7); // offset to avoid same index
    }
  }

  // Narrator district line
  if (district) {
    const pool = DISTRICT_NARRATOR_LINES[district];
    if (pool?.length) {
      result.narratorLine = pick(pool, h + 13);
    }
  }

  return result;
}

/**
 * Get all available faction taunts (for admin/debug/preview).
 */
export function getAllFactionTaunts(): Record<string, string[]> {
  return { ...FACTION_TAUNTS } as Record<string, string[]>;
}

/**
 * Get all district narrator lines (for admin/debug/preview).
 */
export function getAllDistrictNarratorLines(): Record<string, string[]> {
  return { ...DISTRICT_NARRATOR_LINES } as Record<string, string[]>;
}
