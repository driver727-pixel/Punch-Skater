/**
 * Punch Skater — Lore Data
 *
 * This file is the single source of truth for all narrative content consumed by the
 * app. It mirrors the canonical Markdown files in docs/lore/ and provides structured
 * data for both:
 *
 *  - src/lib/generator.ts  — flat arrays used when generating card content
 *  - src/pages/Lore.tsx    — the in-app Codex page
 *
 * When updating lore, keep both this file and the docs/lore/ Markdown files in sync.
 */

import type { District, Archetype } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DistrictLore {
  name: District;
  tagline: string;
  description: string;
  atmosphere: string;
  controlledBy: string;
  crews: string[];
  flavorTexts: string[];
}

export interface ArchetypeLore {
  name: Archetype;
  tagline: string;
  description: string;
  strengths: string;
}

export interface FactionLore {
  name: string;
  districts: string[];
  tagline: string;
  description: string;
}

export interface ManufacturerLore {
  name: string;
  tagline: string;
  description: string;
}

// ── World Overview ────────────────────────────────────────────────────────────

export const WORLD_LORE = {
  title: "The City",
  summary:
    "There is no country anymore. There is only the City — a three-hundred-kilometer " +
    "megastructure sprawl where six dominant corporations own the law, the infrastructure, " +
    "and the narrative. The courier underground emerged as the only communication channel " +
    "the corps can't surveil. Punch Skaters are the people who keep it running.",
  factions: [
    "Axiom Dynamics — defense contracting and private security",
    "Prism Media Group — information, entertainment, and the public feeds",
    "HexChain Logistics — the official (and compromised) delivery network",
    "NovaChem — pharmaceuticals, augmentations, and black-market biologics",
    "VertexBank — financial infrastructure; every credit flows through their nodes",
    "Cascade Technologies — AI, server farms, and the City's data backbone",
  ],
  code: [
    "The package gets there.",
    "You don't open the package.",
    "You don't sell out your crew.",
    "Speed is survival.",
    "Reputation is everything.",
  ],
};

// ── Districts ─────────────────────────────────────────────────────────────────

export const DISTRICT_LORE: DistrictLore[] = [
  {
    name: "Airaway",
    tagline: "The higher you go, the colder the air. The colder the air, the cleaner the money.",
    description:
      "Polished steel, pressurized walkways, and glass-and-chrome towers rising above the City's " +
      "smog layer. Airaway is the corporate penthouse — home to Axiom Dynamics and Prism Media " +
      "Group's executive campuses and rooftop rail networks. Getting in requires a badge, a " +
      "contractor pass, or the kind of nerve that makes other couriers nervous.",
    atmosphere: "Elevated plazas, mag-rail bridges, automated maintenance drones, and corporate security on every corner.",
    controlledBy: "Axiom Dynamics",
    crews: ["Chrome Blades", "Phantom Riders"],
    flavorTexts: [
      "The rooftop rails belong to the corps. The gaps between them belong to us.",
      "Axiom clears the checkpoints. Chrome Blades clear the checkpoints quietly.",
      "Above the smog line, every delivery is worth triple. So is every mistake.",
      "You don't run Airaway until Airaway decides you're ready.",
    ],
  },
  {
    name: "Nightshade",
    tagline: "Nobody owns Nightshade. Nightshade owns you.",
    description:
      "Perpetual neon twilight in the shadow of corp towers above. Nightshade never sees direct " +
      "sunlight — only the glow of ten thousand sign-boards, heat-lamp markets, and arc-flash " +
      "from power nodes being jacked. It is loud, dense, and alive in ways the upper districts " +
      "can never replicate. This is where the underground was born.",
    atmosphere: "Narrow alleys, switchback stairwells, open-air markets on pedestrian bridges, and the Undercity below.",
    controlledBy: "The Courier Crews (contested)",
    crews: ["Nightshade Runners", "The Undercurrent", "Neon Ghosts", "The Dark Lanes"],
    flavorTexts: [
      "In Nightshade, your reputation is your only currency.",
      "Born in the Undercity, risen by the ride.",
      "Every alley has a name. Every name has a story. Learn them or lose the run.",
      "The neon never lies. It just lights up the truth you weren't ready for.",
    ],
  },
  {
    name: "Batteryville",
    tagline: "The City runs on our power. We run on spite.",
    description:
      "Industrial and raw — massive power generation plants, refinery complexes, rail yards, and " +
      "recycler facilities. The air tastes like ozone and machine oil. Wide industrial boulevards " +
      "built for cargo haulers, not pedestrians. Rail yard switchways cut across everything. " +
      "Couriers here specialize in bulk and endurance.",
    atmosphere: "Elevated conveyors, maintenance scaffolding, rail yard switchways, and the constant hum of the City's engines.",
    controlledBy: "HexChain Logistics (official) / Plant Unions (informal)",
    crews: ["Iron Circuit", "Voltage Saints", "Circuit Breakers"],
    flavorTexts: [
      "They built walls. We built wheels.",
      "Every delivery is a chance to disappear into the grid.",
      "The package doesn't care who's chasing you.",
      "Fast enough to outrun the corps, smart enough to stay alive.",
    ],
  },
  {
    name: "The Grid",
    tagline: "Information wants to be free. The Grid decides the price.",
    description:
      "Sterile precision. The Grid is the City's data district — server farm towers humming at " +
      "sub-audible frequencies, fiber conduit running visible along every wall and ceiling, and " +
      "Cascade Technologies' sensor network blanketing every square meter. The most surveilled " +
      "district in the City. You don't run here without a plan.",
    atmosphere: "Wide grid-pattern streets, server farm towers, diagnostic readouts, and invisible sensor tripwires.",
    controlledBy: "Cascade Technologies",
    crews: ["The Static Pack", "Phantom Riders"],
    flavorTexts: [
      "Every step is logged. Every blink is recorded. Run faster than the timestamp.",
      "The Grid's walls have eyes. The Static Pack has the admin password.",
      "Chrome wheels on neon streets — this is what freedom sounds like.",
      "Data moves at light-speed. A good courier moves at courier-speed. Both get there.",
    ],
  },
  {
    name: "Glass City",
    tagline: "Everyone is watching. Make sure they like what they see.",
    description:
      "Glamour as infrastructure. Fashion house towers with mirrored facades, media studio " +
      "complexes, and influencer broadcast towers. Everything is beautiful; everything is " +
      "branded. Running here is performance — the couriers are celebrities, and reputation " +
      "is currency, literally.",
    atmosphere: "Exhibition boulevards, mirrored towers, broadcast drones, and the constant soft glow of Prism Media feeds.",
    controlledBy: "Prism Media Group",
    crews: ["Chrome Blades", "Neon Ghosts"],
    flavorTexts: [
      "The megacity never sleeps, but the streets belong to those who dare.",
      "In Glass City your rep score opens doors scratch can't buy.",
      "Prism wants the spectacle. Give them the spectacle. Deliver the package.",
      "The most dangerous courier in Glass City is the one who looks like they belong.",
    ],
  },
];

// ── Archetypes ────────────────────────────────────────────────────────────────

export const ARCHETYPE_LORE: ArchetypeLore[] = [
  {
    name: "Ninja",
    tagline: "You don't see them coming. You don't see them going.",
    description:
      "Former Axiom black-site contractors and shadow operatives who went freelance. They were " +
      "paid to disappear and reappear somewhere they weren't expected. The courier underground " +
      "offered a way to keep doing exactly that — but on their own terms. They take the jobs " +
      "they want and decline the rest without explanation.",
    strengths: "Maximum Stealth, elite Speed. Excels in surveillance-heavy districts.",
  },
  {
    name: "Punk Rocker",
    tagline: "Every run is a show. Every delivery is a statement.",
    description:
      "Anti-corporate agitators from Nightshade's music and art underground. Punk Rockers treat " +
      "every run as an act of public rebellion — they tag corp surveillance cameras on the way " +
      "through, broadcast their deliveries on encrypted feeds, and build rep by making the corps " +
      "look slow.",
    strengths: "Maximum Rep, high Grit. Thrives in Nightshade and Glass City.",
  },
  {
    name: "Ex Military",
    tagline: "Corps hired us to protect their assets. Turns out their biggest asset was us — and we quit.",
    description:
      "Discharged soldiers from Axiom's private defense forces who took their training and left " +
      "the service. They plan routes like operations — contingencies mapped, gear maintained to " +
      "spec, fallback routes committed to memory. Crews respect their operational reliability.",
    strengths: "High Grit, balanced stats. Steady performers across all districts.",
  },
  {
    name: "Hacker",
    tagline: "I don't need to know what's in the package. I built the encryption protecting it.",
    description:
      "Former Cascade Technologies employees and dark-web data brokers who know that physical " +
      "delivery is the only channel Cascade's AI can't intercept. Hackers carry chips they often " +
      "encrypted themselves — which means they understand exactly how dangerous the information " +
      "is.",
    strengths: "Maximum Tech, strong Rep in digital districts. The Grid is their domain.",
  },
  {
    name: "Chef",
    tagline: "I know every service entrance in this city. Turns out that's more useful than anyone thought.",
    description:
      "Workers from the City's food service infrastructure who move through back corridors and " +
      "freight elevators without raising a flag. A courier who looks like a catering delivery is " +
      "basically invisible to corp security. They trade in favors and community goodwill as much " +
      "as scratch.",
    strengths: "Good Speed, high terrain knowledge, strong community networks. Versatile across districts.",
  },
  {
    name: "Olympic",
    tagline: "They built us to win. We found something more interesting to do with the training.",
    description:
      "Retired or disgraced athletes from the City's corporate-sponsored sports leagues. Their " +
      "conditioning makes them the fastest straight-line runners in the network. They don't just " +
      "run jobs — they time themselves, track personal bests, and push their limits every run.",
    strengths: "Maximum Speed, high Grit. Dominant in open-terrain districts.",
  },
  {
    name: "Fash",
    tagline: "Reputation doesn't just open doors. In Glass City, reputation IS the door.",
    description:
      "Former insiders from Glass City's fashion and media industry who burned their corporate " +
      "bridges but kept the connections. They can walk through Glass City corridors that would " +
      "get anyone else detained, simply because Prism's facial-recognition index still shows " +
      "them as friendly names.",
    strengths: "Maximum Rep, unmatched Glass City access. Limited Stealth — being seen is the job.",
  },
];

// ── Factions ──────────────────────────────────────────────────────────────────

export const FACTION_LORE: FactionLore[] = [
  {
    name: "Nightshade Runners",
    districts: ["Nightshade"],
    tagline: "The original crew. Everything started here.",
    description:
      "The oldest active courier crew in the City. They are the cultural center of the " +
      "underground — other crews measure themselves against the Runners' standards, and disputes " +
      "between factions are brought to a Runners elder for arbitration.",
  },
  {
    name: "Chrome Blades",
    districts: ["Airaway", "Glass City"],
    tagline: "Precision is the only luxury that matters.",
    description:
      "Corporate-adjacent but not corp-owned. Chrome Blades run high-value intelligence " +
      "packages for executive-level clients. Their gear is showroom-clean and their routes are " +
      "planned with operational precision. They'll carry anything if the scratch is right.",
  },
  {
    name: "Neon Ghosts",
    districts: ["Nightshade", "Glass City"],
    tagline: "We were never there.",
    description:
      "Specialists in invisible operations. Neon Ghosts take packages that cannot be traced — " +
      "no biometric flags, no camera sightings, no delivery confirmation. Crew members use " +
      "code-names only. A run that gets attributed to a Ghost is career-ending.",
  },
  {
    name: "The Static Pack",
    districts: ["The Grid"],
    tagline: "Data is the only package that matters.",
    description:
      "Hacker-couriers who treat every run as an intelligence operation. They maintain their " +
      "own encrypted comms infrastructure — the only crew comms Cascade has never " +
      "successfully compromised. They double as information brokers.",
  },
  {
    name: "Iron Circuit",
    districts: ["Batteryville"],
    tagline: "We built the infrastructure. We know every crack in it.",
    description:
      "Military-trained courier collective with deep roots in Batteryville's plant-worker " +
      "unions. Founded by ex-Axiom soldiers. They run the most organized operation of any crew — " +
      "formal shifts, standardized training, shared equipment depot.",
  },
  {
    name: "The Undercurrent",
    districts: ["Nightshade"],
    tagline: "The surface is for people who haven't found a better way yet.",
    description:
      "Operators of the Undercity — the sub-basement tunnel network beneath Nightshade. " +
      "The Undercurrent knows routes through the City's maintenance infrastructure that appear " +
      "on no official map. Joining requires a personal introduction from an existing member.",
  },
  {
    name: "Voltage Saints",
    districts: ["Batteryville"],
    tagline: "Speed is sacred. Hesitation is sin.",
    description:
      "A semi-religious collective that treats exceptional speed as spiritual practice. " +
      "Their pre-run rituals and group discipline produce consistently fast delivery times. " +
      "The fastest runner in the crew at any given time holds the title of Saint.",
  },
  {
    name: "The Dark Lanes",
    districts: ["Nightshade"],
    tagline: "There are back-routes and there are back-routes.",
    description:
      "Specialists in off-grid transit. The Dark Lanes maintain a network of illegal passage " +
      "routes through the City — cleared tunnels, negotiated crossings, rooftop paths that " +
      "technically don't exist. They license these routes to other crews for a fee.",
  },
  {
    name: "Circuit Breakers",
    districts: ["Batteryville"],
    tagline: "Two services, one price.",
    description:
      "Anti-corporate saboteurs who fund their activism through courier work. Every Circuit " +
      "Breakers run includes at minimum one infrastructure disruption: a surveillance node " +
      "offline, a tracking beacon destroyed, a power junction tapped for the underground.",
  },
  {
    name: "Phantom Riders",
    districts: ["Airaway", "The Grid"],
    tagline: "Who runs the Phantoms? Nobody knows. That's the point.",
    description:
      "The most mysterious crew in the network. No one knows the membership. Jobs are left at " +
      "specific drop-points and either get picked up or don't. No confirmed Phantom Rider has " +
      "ever been detained by corp security.",
  },
];

// ── Manufacturer Lore ─────────────────────────────────────────────────────────

export const MANUFACTURER_LORE: ManufacturerLore[] = [
  {
    name: "VoltEdge",
    tagline: "Faster by design.",
    description:
      "High-output electric propulsion boards with adaptive torque systems. The top-shelf choice " +
      "for speed-focused couriers.",
  },
  {
    name: "NightRider Tech",
    tagline: "Built for places that don't want to be found.",
    description:
      "Stealth-optimized equipment — low acoustic signature wheels, signal-dampened chassis, " +
      "matte-finish surfaces that don't catch surveillance camera light.",
  },
  {
    name: "ChromeCraft",
    tagline: "Because your gear says everything before you do.",
    description:
      "Premium alloy construction with a signature mirror-chrome aesthetic. The status symbol " +
      "of choice in Airaway and Glass City.",
  },
  {
    name: "NeonForge",
    tagline: "Customizable from the ground up.",
    description:
      "Mid-market modular boards with an emphasis on customization. Popular in Nightshade for " +
      "the extensive third-party modification ecosystem.",
  },
  {
    name: "StaticWave",
    tagline: "When the grid goes down, we keep rolling.",
    description:
      "EMP-hardened equipment for The Grid and environments with active electronic " +
      "countermeasures. Less flashy than VoltEdge but keeps functioning after a Cascade sweep.",
  },
  {
    name: "IronPulse",
    tagline: "Military spec, street price.",
    description:
      "Rugged, high-durability equipment originally designed for Axiom security forces. " +
      "Found its way into the underground when ex-military couriers brought their issued gear.",
  },
  {
    name: "ShadowDrive",
    tagline: "Unregistered. Untracked. Yours.",
    description:
      "Black-market hardware with no manufacturer's registry, no embedded tracking chips, " +
      "and no warranty. Indispensable to couriers who need to move without leaving a hardware signature.",
  },
  {
    name: "ApexRoll",
    tagline: "Competition-grade. No compromises.",
    description:
      "Engineered to competition specifications. The preferred brand of ex-Olympic athletes " +
      "and sponsored couriers. Customer base is narrow but intensely loyal.",
  },
  {
    name: "CyberGlide",
    tagline: "Smarter than the route.",
    description:
      "AI-assisted navigation boards that build and update routing models in real time. " +
      "Hackers love them; everyone else finds the onboard AI a bit opinionated.",
  },
  {
    name: "VoidRacer",
    tagline: "No registry. No history. No problem.",
    description:
      "Pure propulsion with zero digital footprint. Cannot be remotely disabled, pinged, or " +
      "ID-matched to their rider. The corps would ban them if they could find the factory.",
  },
];

// ── Flat arrays for generator.ts ──────────────────────────────────────────────
// These are the arrays imported by generator.ts to produce lore-accurate card content.

/** Lore-canon crew names, one per faction (matches FACTION_LORE). */
export const LORE_CREWS: string[] = FACTION_LORE.map((f) => f.name);

/** Lore-canon manufacturer names (matches MANUFACTURER_LORE). */
export const LORE_MANUFACTURERS: string[] = MANUFACTURER_LORE.map((m) => m.name);

/** Lore-accurate flavor texts drawn from all district pools. */
export const LORE_FLAVOR_TEXTS: string[] = [
  // Nightshade
  "In Nightshade, your reputation is your only currency.",
  "Born in the Undercity, risen by the ride.",
  "Every alley has a name. Every name has a story. Learn them or lose the run.",
  // Batteryville
  "They built walls. We built wheels.",
  "The package doesn't care who's chasing you.",
  "Fast enough to outrun the corps, smart enough to stay alive.",
  // The Grid
  "Chrome wheels on neon streets — this is what freedom sounds like.",
  "Every step is logged. Every blink is recorded. Run faster than the timestamp.",
  // Airaway
  "The rooftop rails belong to the corps. The gaps between them belong to us.",
  "You don't run Airaway until Airaway decides you're ready.",
  // Glass City
  "The megacity never sleeps, but the streets belong to those who dare.",
  "The most dangerous courier in Glass City is the one who looks like they belong.",
  // Universal
  "Every delivery is a chance to disappear into the grid.",
  "The Code isn't written down. Everyone in the underground already knows it.",
  "Speed is sacred. Everything else is negotiable.",
  "What you carry defines who you are. Handle it accordingly.",
];

/** Lore-grounded passive traits. */
export const LORE_PASSIVE_TRAITS: { name: string; description: string }[] = [
  { name: "Neural Link", description: "Gains +1 Speed when below 3 HP" },
  { name: "Ghost Protocol", description: "First stealth action each turn costs 0" },
  { name: "Street Smart", description: "+2 to all district navigation checks" },
  { name: "Iron Chassis", description: "Immune to the first damage each round" },
  { name: "Data Sponge", description: "Draw an extra card when entering Corporate zones" },
  { name: "Voltage Surge", description: "After using Active Ability, gain +2 Speed next turn" },
  { name: "Shadow Step", description: "Can pass through Stealth barriers once per game" },
  { name: "Jury Rig", description: "Can repair board without losing a turn once per game" },
  { name: "Undercity Routes", description: "Ignore the first terrain obstacle on any Nightshade run" },
  { name: "Corp Contacts", description: "Once per game, ignore a Corporate zone checkpoint" },
  { name: "Crowd Read", description: "+2 Rep when completing a delivery through occupied tiles" },
  { name: "Scavenger", description: "Recover 1 spent resource when passing recycler zones in Batteryville" },
];

/** Lore-grounded active abilities. */
export const LORE_ACTIVE_ABILITIES: { name: string; description: string }[] = [
  { name: "Turbo Boost", description: "Triple Speed for one turn; take 1 damage" },
  { name: "Smoke Screen", description: "All enemies lose sight of you until end of turn" },
  { name: "EMP Pulse", description: "Disable one Tech obstacle or enemy device" },
  { name: "Crowd Surf", description: "Move through occupied tiles without triggering reactions" },
  { name: "Data Heist", description: "Instantly complete a pickup without a skill check" },
  { name: "Grind Rail", description: "Travel along any rail or ledge for free this turn" },
  { name: "Bail and Roll", description: "Avoid all damage this turn; lose 2 Speed next turn" },
  { name: "Network Ping", description: "Reveal all hidden threats in current district" },
  { name: "Blackout", description: "Cut all surveillance in a 3-tile radius for one turn" },
  { name: "Syndicate Call", description: "Summon a crew member to intercept a pursuer this turn" },
  { name: "Signal Jam", description: "Prevent all enemy communication checks this turn" },
  { name: "Overcharge",      description: "Push stamina beyond rated limit; take 1 fatigue next turn" },
];
