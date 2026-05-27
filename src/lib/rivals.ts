/**
 * rivals.ts — First five Punch Skater™ district rivals.
 *
 * This is the canonical, data-driven catalogue referenced by
 * docs/JOUSTING_LITE_DESIGN.md ("Rival catalogue"). Each entry carries a
 * boss-tier joust card snapshot, a signature tactic, a personality dossier,
 * a card reward, and a codex unlock. The shapes here intentionally stay flat
 * so future phases (rival ladders, boss jousts, async PvP) can plug in
 * without reshaping the data.
 *
 * Mirror any change in this file to `server/lib/rivals.js`. Tests live in
 * `server/test/rivals.test.js`.
 */

import type {
  Archetype,
  BattleCardSnapshot,
  District,
  Faction,
  JoustOutcome,
  JoustCardSnapshot,
  JoustDifficulty,
  JoustTactic,
} from "./types";

/**
 * A card reward that drops on a successful boss joust against a district
 * rival. The id is stable so future card forge / pack hooks can resolve it.
 */
export interface RivalCardReward {
  id: string;
  name: string;
  rarity: "Rare" | "Legendary";
  archetype: Archetype;
  tagline: string;
  signatureTrait: string;
}

/**
 * A codex entry that unlocks the first time the rival is defeated. The id
 * is referenced from the joust resolution `lore: string[]` field per
 * docs/JOUSTING_LITE_DESIGN.md ("Joust encounter result").
 */
export interface RivalCodexUnlock {
  id: string;
  title: string;
  summary: string;
}

/**
 * Short narration lines used by the joust UI / mission run state when this
 * rival is encountered. Kept in plain Aussie cadence per the design pillars.
 */
export interface RivalDialogue {
  intro: string;
  win: string;
  loss: string;
  draw: string;
}

export interface RivalMissionHook {
  missionDefinitionIds: string[];
  label: string;
  intro: string;
  summary: string;
  difficulty: JoustDifficulty;
}

export interface RivalProgressionHook {
  districtReputationDelta: number;
  codexEntryIds: string[];
}

export interface RivalProgressionAward {
  rivalId: string;
  district: District;
  cardRewardId: string;
  codexEntryIds: string[];
  districtReputationDelta: number;
}

export interface DistrictRival {
  id: string;
  name: string;
  district: District;
  faction: Faction;
  archetype: Archetype;
  /** One-line tagline used on rival cards and ladder tiles. */
  tagline: string;
  /** Short personality dossier — two or three sentences, plain English. */
  personality: string;
  /** The joust tactic the rival opens with and is best statted for. */
  signatureTactic: JoustTactic;
  /** A small named modifier the boss applies in joust resolution. */
  signatureTrait: string;
  /** Difficulty band — first five rivals all sit at boss-tier per Phase 4. */
  difficulty: JoustDifficulty;
  /** The full card snapshot the joust resolver fights against. */
  signatureCard: JoustCardSnapshot;
  /** Card reward dropped on first defeat. */
  cardReward: RivalCardReward;
  /** Codex entry unlocked on first defeat. */
  codexUnlock: RivalCodexUnlock;
  /** Boss dialogue used by the joust UI. */
  dialogue: RivalDialogue;
  /** Mission-board districts that surface this rival before the boss ladder. */
  missionHook: RivalMissionHook;
  /** First-defeat progression metadata shared by Codex and leaderboard hooks. */
  progressionHook: RivalProgressionHook;
}

/**
 * The first five named district rivals, matching the example list in
 * PUNCH_SKATER_VISION_ROADMAP.md ("Phase 4 — Districts, Rivals, and Boss
 * Jousts"). The Forest is intentionally left without a named rival in this
 * batch and remains a future expansion slot.
 */
export const DISTRICT_RIVALS: readonly DistrictRival[] = [
  {
    id: "batteryville-jax-voltage",
    name: "Jax Voltage",
    district: "Batteryville",
    faction: "Iron Curtains",
    archetype: "Iron Curtains",
    tagline: "Reckless boost-charge rider out of the breaker yards.",
    personality:
      "Jax grew up on the Pilbara freight scaffolds and treats every joust like the rail line is closing in five seconds. Loud, grinning, allergic to caution — they will burn a battery to win a single pass and laugh while the cells smoke.",
    signatureTactic: "boost",
    signatureTrait: "Boost Charge",
    difficulty: "boss",
    signatureCard: {
      id: "rival-card-jax-voltage",
      name: "Jax Voltage",
      archetype: "Iron Curtains",
      crew: "Iron Curtains",
      district: "Batteryville",
      stats: { speed: 9, range: 6, rangeNm: 6, stealth: 4, grit: 7 },
      joust: {
        lance: 8,
        shield: 5,
        hype: 8,
        gear: {
          boardType: "Street",
          lanceType: "kinetic",
          shieldType: "scrap",
          armorTag: "breaker-yard plate",
        },
        traits: ["Boost Charge", "Heavy Lance"],
      },
    },
    cardReward: {
      id: "card-reward-voltage-relay",
      name: "Voltage Relay",
      rarity: "Rare",
      archetype: "Iron Curtains",
      tagline: "A spare-cell lance pulled from Jax's wreck pile.",
      signatureTrait: "Boost Charge",
    },
    codexUnlock: {
      id: "codex-rival-jax-voltage",
      title: "Jax Voltage: Breaker-Yard Bolt",
      summary:
        "First-defeat dossier on Jax Voltage, the Iron Curtains boost-charge rider who turned Batteryville's freight scaffolds into a personal joust circuit.",
    },
    dialogue: {
      intro: "Jax Voltage flicks the throttle wide open. \"Send it, mate. Last one breathing wins.\"",
      win: "Jax cackles through the smoke. \"Bloody oath. You earned that one.\"",
      loss: "Jax slaps the rail and grins. \"Told ya. Full noise beats half-measures every time.\"",
      draw: "Jax shrugs at the sparks. \"Knife-edge. Run it back when you've got a real cell.\"",
    },
    missionHook: {
      missionDefinitionIds: ["batteryville-breaker-yard", "batteryville-switchyard-uprising"],
      label: "Jax Voltage joust",
      intro: "Jax Voltage boots onto the breaker lane, sparks flying. \"Send it, mate. Freight only moves if you do.\"",
      summary: "Beat Jax Voltage in the breaker lane for a named-rival payout and Batteryville bragging rights.",
      difficulty: "standard",
    },
    progressionHook: {
      districtReputationDelta: 40,
      codexEntryIds: ["codex-rival-jax-voltage"],
    },
  },
  {
    id: "airaway-mina-chrome",
    name: "Mina Chrome",
    district: "Airaway",
    faction: "United Corporate Alliance (UCA)",
    archetype: "The Team",
    tagline: "Corporate shield specialist on the Blue Mountains glass lanes.",
    personality:
      "Mina runs the Airaway checkpoints like a board meeting: polite, polished, and absolutely lethal. She quotes the contractor handbook between passes and treats a clean Magnetic Guard the way other riders treat a knockout punch.",
    signatureTactic: "guard",
    signatureTrait: "Magnetic Guard",
    difficulty: "boss",
    signatureCard: {
      id: "rival-card-mina-chrome",
      name: "Mina Chrome",
      archetype: "The Team",
      crew: "United Corporate Alliance (UCA)",
      district: "Airaway",
      stats: { speed: 6, range: 7, rangeNm: 7, stealth: 5, grit: 9 },
      joust: {
        lance: 6,
        shield: 9,
        hype: 7,
        gear: {
          boardType: "Carbon",
          lanceType: "kinetic",
          shieldType: "magnetic",
          armorTag: "executive carbon shell",
        },
        traits: ["Magnetic Guard", "Riot Shield"],
      },
    },
    cardReward: {
      id: "card-reward-chrome-aegis",
      name: "Chrome Aegis",
      rarity: "Legendary",
      archetype: "The Team",
      tagline: "A magnetised executive shield logged out of Airaway's evidence vault.",
      signatureTrait: "Magnetic Guard",
    },
    codexUnlock: {
      id: "codex-rival-mina-chrome",
      title: "Mina Chrome: Glass-Lane Marshal",
      summary:
        "First-defeat dossier on Mina Chrome, the UCA shield specialist who polices Airaway's mag-rail bridges with a Magnetic Guard most riders never see coming.",
    },
    dialogue: {
      intro: "Mina taps her badge to the lane reader. \"Compliance check. Hold the line, mate, and try not to break it.\"",
      win: "Mina nods once, all business. \"Recorded. Cleanest pass on the ledger this quarter.\"",
      loss: "Mina holsters the lance. \"Filed under 'expected outcome'. Try the appeals process.\"",
      draw: "Mina arches an eyebrow. \"A draw on a checkpoint. The auditors will love that one.\"",
    },
    missionHook: {
      missionDefinitionIds: ["airaway-sky-lane", "airaway-coldchain-pass"],
      label: "Mina Chrome checkpoint joust",
      intro: "Mina Chrome locks the glass gate and levels a magnetic shield. \"Compliance check. Hold the line, mate.\"",
      summary: "Clear Mina Chrome's checkpoint joust for extra Airaway cred and a cleaner route out.",
      difficulty: "standard",
    },
    progressionHook: {
      districtReputationDelta: 40,
      codexEntryIds: ["codex-rival-mina-chrome"],
    },
  },
  {
    id: "nightshade-rook-wraith",
    name: "Rook Wraith",
    district: "Nightshade",
    faction: "Ne0n Legion",
    archetype: "Ne0n Legion",
    tagline: "Shortcut and feint master of the Fitzroy laneways.",
    personality:
      "Rook learned every Melbourne laneway that the city forgot to map and treats them like personal property. Quiet, unsmiling, allergic to spotlights — the only way to read Rook is the wrong way, and they will charge a small Ozzy bounty for the lesson.",
    signatureTactic: "feint",
    signatureTrait: "Neon Flourish",
    difficulty: "boss",
    signatureCard: {
      id: "rival-card-rook-wraith",
      name: "Rook Wraith",
      archetype: "Ne0n Legion",
      crew: "Ne0n Legion",
      district: "Nightshade",
      stats: { speed: 8, range: 6, rangeNm: 6, stealth: 9, grit: 6 },
      joust: {
        lance: 7,
        shield: 6,
        hype: 8,
        gear: {
          boardType: "Surf-Skate",
          lanceType: "glitch",
          shieldType: "mirror",
          armorTag: "laneway shadow weave",
        },
        traits: ["Neon Flourish", "Street Parry"],
      },
    },
    cardReward: {
      id: "card-reward-wraith-shortcut",
      name: "Wraith Shortcut",
      rarity: "Rare",
      archetype: "Ne0n Legion",
      tagline: "A laneway map etched into a stolen surf-skate deck.",
      signatureTrait: "Neon Flourish",
    },
    codexUnlock: {
      id: "codex-rival-rook-wraith",
      title: "Rook Wraith: Laneway Ghost",
      summary:
        "First-defeat dossier on Rook Wraith, the Ne0n Legion feint master who treats Nightshade's blacklight laneways as a private joust circuit nobody else gets to chart.",
    },
    dialogue: {
      intro: "Rook ghosts out of the blacklight. \"You don't see the lane till I want you to. Dodgy as.\"",
      win: "Rook clicks their tongue. \"Clean read. The lane was yours.\"",
      loss: "Rook is already gone. The reply lands a second later: \"Showpony.\"",
      draw: "Rook taps their lance against yours. \"Even split. The lane keeps the difference.\"",
    },
    missionHook: {
      missionDefinitionIds: ["nightshade-tunnel-run", "nightshade-moonrise-echo"],
      label: "Rook Wraith tunnel joust",
      intro: "Rook Wraith slips out of the tunnel glare and taps the rail. \"You don't see the lane till I want you to.\"",
      summary: "Beat Rook Wraith in the tunnel mouth to leave Nightshade with extra hush money and lore.",
      difficulty: "standard",
    },
    progressionHook: {
      districtReputationDelta: 40,
      codexEntryIds: ["codex-rival-rook-wraith"],
    },
  },
  {
    id: "grid-vex-static",
    name: "Vex Static",
    district: "The Grid",
    faction: "D4rk $pider",
    archetype: "D4rk $pider",
    tagline: "Signal hacker and glitch duelist inside Cascade's surveillance net.",
    personality:
      "Vex talks to the cameras like they're old friends and pays them in counter-traces. They run every joust as a data problem and will glitch a Counter so hard the lane briefly forgets the joust happened. Calm, sarcastic, almost never blinks.",
    signatureTactic: "counter",
    signatureTrait: "Street Parry",
    difficulty: "boss",
    signatureCard: {
      id: "rival-card-vex-static",
      name: "Vex Static",
      archetype: "D4rk $pider",
      crew: "D4rk $pider",
      district: "The Grid",
      stats: { speed: 7, range: 8, rangeNm: 8, stealth: 8, grit: 6 },
      joust: {
        lance: 7,
        shield: 8,
        hype: 6,
        gear: {
          boardType: "Street",
          lanceType: "signal",
          shieldType: "holo",
          armorTag: "signal-jammer trench",
        },
        traits: ["Street Parry", "Magnetic Guard"],
      },
    },
    cardReward: {
      id: "card-reward-static-trace",
      name: "Static Trace",
      rarity: "Legendary",
      archetype: "D4rk $pider",
      tagline: "A bricked Cascade trace beacon Vex left in your inventory as a receipt.",
      signatureTrait: "Street Parry",
    },
    codexUnlock: {
      id: "codex-rival-vex-static",
      title: "Vex Static: Lane in the Static",
      summary:
        "First-defeat dossier on Vex Static, the D4rk $pider glitch duelist who turns The Grid's surveillance net into a counter-attack lane on demand.",
    },
    dialogue: {
      intro: "Vex thumbs a tab on their lance. \"Cameras are mine for the next ninety seconds. Have a crack.\"",
      win: "Vex blinks slowly. \"Huh. The trace cleared you. Lucky day.\"",
      loss: "Vex is already filing the footage. \"Counter, archived. Try a different pattern next time.\"",
      draw: "Vex tilts their head. \"Stalemate logged. The Grid will get curious about that one.\"",
    },
    missionHook: {
      missionDefinitionIds: ["grid-trace", "grid-parent-trace"],
      label: "Vex Static trace joust",
      intro: "Vex Static hijacks the live feed and glides into the trace lane. \"Cameras are mine. Have a crack.\"",
      summary: "Take Vex Static on in a live trace joust for extra archive value and Grid standing.",
      difficulty: "hard",
    },
    progressionHook: {
      districtReputationDelta: 40,
      codexEntryIds: ["codex-rival-vex-static"],
    },
  },
  {
    id: "glass-city-nova-saint",
    name: "Nova Saint",
    district: "Glass City",
    faction: "The Team",
    archetype: "The Team",
    tagline: "Style icon and crowd-control rider on the Swan River screens.",
    personality:
      "Nova performs every joust for the holo-ads as much as for the win, and the crowd numbers prove it works. Warm on camera, ruthless off it — Nova will Trick Strike past a defence just to make the highlight reel chime, then sign autographs while you reset.",
    signatureTactic: "trickStrike",
    signatureTrait: "Neon Flourish",
    difficulty: "boss",
    signatureCard: {
      id: "rival-card-nova-saint",
      name: "Nova Saint",
      archetype: "The Team",
      crew: "The Team",
      district: "Glass City",
      stats: { speed: 8, range: 7, rangeNm: 7, stealth: 6, grit: 6 },
      joust: {
        lance: 8,
        shield: 6,
        hype: 9,
        gear: {
          boardType: "Carbon",
          lanceType: "neon",
          shieldType: "banner",
          armorTag: "sponsor-polished kit",
        },
        traits: ["Neon Flourish", "Boost Charge"],
      },
    },
    cardReward: {
      id: "card-reward-saint-spotlight",
      name: "Saint Spotlight",
      rarity: "Legendary",
      archetype: "The Team",
      tagline: "A signed Nova Saint sponsor banner that doubles as a hype shield.",
      signatureTrait: "Neon Flourish",
    },
    codexUnlock: {
      id: "codex-rival-nova-saint",
      title: "Nova Saint: Highlight Reel",
      summary:
        "First-defeat dossier on Nova Saint, The Team's Glass City showrider whose Trick Strike line is the most-replayed joust clip in the Swan River feeds.",
    },
    dialogue: {
      intro: "Nova waves at the holo-cams. \"Big crowd tonight. Showpony for the screens, mate?\"",
      win: "Nova claps once and means it. \"That was a clip. You just made my highlight reel.\"",
      loss: "Nova throws the crowd a wink. \"Roll the replay. That's the one.\"",
      draw: "Nova laughs at the screens. \"Cliffhanger ending. The advertisers will love it.\"",
    },
    missionHook: {
      missionDefinitionIds: ["glass-city-exchange"],
      label: "Nova Saint broker joust",
      intro: "Nova Saint skates into the exchange halo with the cameras already live. \"Big crowd tonight. Showpony?\"",
      summary: "Beat Nova Saint in the open lane for extra Glass City cash and a fresh Codex hook.",
      difficulty: "standard",
    },
    progressionHook: {
      districtReputationDelta: 40,
      codexEntryIds: ["codex-rival-nova-saint"],
    },
  },
] as const;

export function getDistrictRival(id: string): DistrictRival | undefined {
  return DISTRICT_RIVALS.find((rival) => rival.id === id);
}

export function getDistrictRivalByDistrict(district: District): DistrictRival | undefined {
  return DISTRICT_RIVALS.find((rival) => rival.district === district);
}

export function getDistrictRivalsByDistrict(district: District): DistrictRival[] {
  return DISTRICT_RIVALS.filter((rival) => rival.district === district);
}

export function getDistrictRivalMissionHook(district: District): (RivalMissionHook & {
  rivalId: string;
  rivalCard: JoustCardSnapshot;
}) | null {
  const rival = getDistrictRivalByDistrict(district);
  if (!rival) return null;
  return {
    ...rival.missionHook,
    rivalId: rival.id,
    rivalCard: rival.signatureCard,
  };
}

export function createDistrictRivalBattleCardSnapshot(
  rivalOrId: DistrictRival | string,
): BattleCardSnapshot | undefined {
  const rival = typeof rivalOrId === "string" ? getDistrictRival(rivalOrId) : rivalOrId;
  if (!rival) return undefined;
  return {
    id: rival.signatureCard.id,
    archetype: rival.signatureCard.archetype,
    stats: { ...rival.signatureCard.stats },
  };
}

export function getDistrictRivalProgressionAward(
  rivalOrId: DistrictRival | string,
  outcome: JoustOutcome = "win",
): RivalProgressionAward | null {
  if (outcome !== "win") return null;
  const rival = typeof rivalOrId === "string" ? getDistrictRival(rivalOrId) : rivalOrId;
  if (!rival) return null;
  return {
    rivalId: rival.id,
    district: rival.district,
    cardRewardId: rival.cardReward.id,
    codexEntryIds: [...rival.progressionHook.codexEntryIds],
    districtReputationDelta: rival.progressionHook.districtReputationDelta,
  };
}
