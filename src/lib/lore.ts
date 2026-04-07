import { Faction, Manufacturer, Archetype, Vibe, District } from './types';

// ── Character names ────────────────────────────────────────────────────────────

export const LORE_CHARACTER_NAMES = [
  "Skip 'Skids' Mayhew",
  "Ketch",
  "Cyber Jeff",
  "Quill-01",
  "Neon Stalker",
];

// ── Archetype → Faction mapping ────────────────────────────────────────────────

export const ARCHETYPE_TO_FACTION: Record<Archetype, Faction> = {
  "The Knights Technarchy":  "The Knights Technarchy",
  "Qu111s":                  "Qu111s (Quills)",
  "Iron Curtains":           "Iron Curtains",
  "D4rk $pider":             "D4rk $pider",
  "The Asclepians":          "The Asclepians",
  "The Mesopotamian Society":"The Mesopotamian Society",
  "Hermes' Squirmies":       "Hermes' Squirmies",
  "UCPS":                    "UCPS Workers",
  "The Team":                "The Team",
};

// ── Vibe → Manufacturer mapping ────────────────────────────────────────────────

export const VIBE_TO_MANUFACTURER: Record<Vibe, Manufacturer> = {
  "Grunge":   "DIY/Plywood",
  "Neon":     "VoidRacer",
  "Chrome":   "Dark Light Labs",
  "Plastic":  "UCA",
  "Recycled": "The Wooders",
};

// ── Passive traits & active abilities ─────────────────────────────────────────

export const LORE_PASSIVE_TRAITS = [
  { name: "Gutter Punk Resilience",  description: "Gain +1 Armor when below 50% HP." },
  { name: "Luddite's Balance",       description: "+2 to Grinding on wood decks." },
];

export const LORE_ACTIVE_ABILITIES = [
  { name: "Broomstick Sabotage", description: "Instant wipeout for UCA White Bikes." },
  { name: "Turbo Boost",         description: "Triple Speed; take 1 damage." },
];

// ── World overview ─────────────────────────────────────────────────────────────

export const WORLD_LORE = {
  summary:
    "The world is mostly unified under the United Corporations of America (UCA), which " +
    "operates from the elevated city of Airaway. Below it, the former roads and tunnels " +
    "have been repurposed into a sprawling courier underground. Electric skateboards " +
    "(Esk8) are the dominant transport — cheaper than flying cars and perfect for decayed " +
    "roads. The Skater Courier is the most valuable information mule in the city, fought " +
    "over by every faction. Information — stored on thumb drives to dodge hackers — is the " +
    "most precious commodity in this world.",
  factions: [
    "United Corporations of America (UCA)",
    "Qu111s (Quills)",
    "Ne0n Legion",
    "Iron Curtains",
    "D4rk $pider",
    "The Asclepians",
    "The Mesopotamian Society",
    "The Knights Technarchy",
    "Hermes' Squirmies",
    "UCPS Workers",
    "Moonrisers",
    "The Wooders",
    "Punch Skaters",
  ],
  code: [
    "Esk8 or die — motorized vehicles are relics.",
    "Never open the package.",
    "UCA white bikes are enemy symbols — broomstick first.",
    "The Nightshade belongs to the crews. Outsiders skate at their own risk.",
    "Scratch talks; corps walk.",
    "Airaway is not for you — unless you've got a contractor pass or nerve.",
    "Data on a thumb drive beats data on a server.",
    "A Punch Skater owes nothing to nobody. Until they owe everything.",
  ],
};

// ── District lore ──────────────────────────────────────────────────────────────

export interface DistrictLoreEntry {
  name: District;
  controlledBy: string;
  tagline: string;
  description: string;
  atmosphere: string;
  crews: string[];
  flavorTexts: string[];
}

export const DISTRICT_LORE: DistrictLoreEntry[] = [
  {
    name: "Airaway",
    controlledBy: "United Corporations of America (UCA)",
    tagline: "The higher you go, the colder the air. The colder the air, the cleaner the money.",
    description:
      "The gleaming corporate penthouse suspended above the city's smog layer. Airaway is " +
      "home to the UCA consortium — executives, oligarchs, and their families live in " +
      "glass-and-chrome mansions connected by mag-rail bridges and pressurised walkways. " +
      "Motorized vehicles are outlawed; the only ground transport is the electric skateboard. " +
      "Access requires a verified corporate badge, a contractor pass, or the kind of nerve " +
      "that makes other couriers nervous. Punch Skaters are explicitly outlawed here.",
    atmosphere: "Polished steel, pressurised walkways, automated maintenance drones, rarefied air.",
    crews: ["Chrome Blades", "Phantom Riders"],
    flavorTexts: [
      "\"The checkpoints smell like cologne and contempt.\"",
      "\"One wrong turn and your biometrics are flagged city-wide.\"",
      "\"Nobody here is starving. Nobody here is free.\"",
    ],
  },
  {
    name: "The Roads",
    controlledBy: "Uncontrolled — open courier territory",
    tagline: "The cars left. We moved in. Nobody asked for permission.",
    description:
      "When flying drone transport made ground vehicles obsolete, the UCA simply " +
      "decommissioned the roads. The cracked asphalt and faded lane markings became the " +
      "city's unofficial skating highways — wide, fast, and mostly ungoverned. Courier " +
      "networks run their most visible operations here. Speed is everything on the Roads.",
    atmosphere: "Cracked asphalt, faded lane markings, open sky, wind-blasted straightaways.",
    crews: ["Road Runners", "Asphalt Angels"],
    flavorTexts: [
      "\"Lane markings are suggestions. The fastest line is yours.\"",
      "\"Out here there's no checkpoint, no corp, and no shade.\"",
    ],
  },
  {
    name: "Batteryville",
    controlledBy: "HexChain Logistics / Recycler Collectives",
    tagline: "The City runs on our power. We run on spite.",
    description:
      "The city's engine room — power generation plants, refinery complexes, rail yards, " +
      "and recycler facilities that process the city's waste back into raw materials. " +
      "Skip 'Skids' Mayhew grew up here, watching his parents leave for The Grid every " +
      "morning. The air tastes like ozone and machine oil. Rail yard switchways cut " +
      "across everything. Couriers here specialize in bulk: heavy contraband, stockpiled " +
      "biologics, industrial quantities of restricted materials. Stamina is everything.",
    atmosphere: "Industrial, loud, ozone-tinged air, permanent machinery noise, three-dimensional rail scaffolding.",
    crews: ["Iron Circuit", "Voltage Saints", "Circuit Breakers"],
    flavorTexts: [
      "\"Grew up here. Still don't know how anyone breathes this air.\"",
      "\"The load is always too heavy. That's what the training is for.\"",
      "\"Skids' first board had wheels stripped from a cargo cart. Batteryville builds you that way.\"",
    ],
  },
  {
    name: "The Grid",
    controlledBy: "Cascade Technologies",
    tagline: "Information wants to be free. The Grid decides the price.",
    description:
      "The city's data district — server farm towers humming at sub-audible frequencies, " +
      "fiber conduit running visible along every wall and ceiling. Skids' parents " +
      "worked here until they disappeared. The Grid is the most surveilled district in " +
      "the city; every step is logged by Cascade Technologies' AI monitoring network. " +
      "Couriers here carry physical chips containing data so sensitive that no digital " +
      "channel can be trusted. The Static Pack wages a constant war against Cascade's " +
      "surveillance nodes.",
    atmosphere: "Sterile, grid-pattern streets, omnipresent sensor arrays, scrolling diagnostic readouts.",
    crews: ["The Static Pack", "Phantom Riders"],
    flavorTexts: [
      "\"His parents worked here until they didn't. Nobody explains what that means.\"",
      "\"Cascade sees everything. The trick is being too boring to flag.\"",
      "\"The package is always a chip. The chip is always dangerous.\"",
    ],
  },
  {
    name: "Electropolis",
    controlledBy: "City Security — the Fuzz",
    tagline: "Move along. Designated transit corridors only.",
    description:
      "The city's law-and-order showcase — wide boulevards lit by Prism Media Group " +
      "holo-displays, patrolled by city security known as the Fuzz. Skaters are " +
      "tolerated only in designated transit corridors; venture off-grid and you're " +
      "dealing with checkpoint drones and biometric sweeps. Skids and his crew skate " +
      "here occasionally until the Fuzz pushes them out. It looks clean. It isn't.",
    atmosphere: "Bright holo-lit streets, heavy security presence, constant surveillance drones.",
    crews: ["Chrome Blades", "Neon Ghosts"],
    flavorTexts: [
      "\"The corridors are fine. It's the alleys they don't want you in.\"",
      "\"Fuzz drones don't argue. They log, flag, and follow up.\"",
    ],
  },
  {
    name: "Nightshade",
    controlledBy: "Courier crews — no single corp holds it",
    tagline: "Nobody owns Nightshade. Nightshade owns you.",
    description:
      "Also known as the Murk — a specific area of perpetual neon twilight featuring " +
      "tunnels utilized by tight-knit, territorial skate crews for rapid transit and " +
      "private meetings. This is where the underground was born. Every courier network " +
      "in the city traces its roots to a Nightshade back-alley deal. Skids' crew uses " +
      "the Nightshade tunnels but never goes deep, avoiding the more established skate " +
      "gangs. The Moonrisers held their rave here — where Skids first got noticed.",
    atmosphere: "Perpetual neon twilight, narrow alleys, blacklight murals, underground raves, loyal crews.",
    crews: ["Nightshade Runners", "The Undercurrent", "Neon Ghosts", "The Dark Lanes", "Moonrisers"],
    flavorTexts: [
      "\"They held a rave down here. Skids thought it was just a party. It was an audition.\"",
      "\"Don't go deep unless you're known. The established crews don't ask twice.\"",
      "\"Every courier network started with a deal made in Nightshade. Every single one.\"",
    ],
  },
  {
    name: "The Forest",
    controlledBy: "The Wooders — self-governed agrarian commune",
    tagline: "Build with wood. Grind with wood. Live without the grid.",
    description:
      "Outside the main city complex, a wood-based agrarian settlement of Luddites " +
      "who refuse technology and build with natural materials. The settlement resembles " +
      "an Ewok village — wooden boardwalks, carved tree trunks, elevated platforms " +
      "connected by rope bridges. The Wooders are named for their insistence on using " +
      "exclusively wooden skateboard decks. They love grinding on natural surfaces and " +
      "are deeply suspicious of anything corp-made. Their boards outlast anything from " +
      "a UCA factory.",
    atmosphere: "Forest canopy, wooden structures, rope bridges, birdsong and wind, no holo-displays.",
    crews: ["The Wooders"],
    flavorTexts: [
      "\"No screens. No trackers. No corp logos. Just wood and speed.\"",
      "\"A plywood deck built by hand will outlast anything Cascade ever manufactured.\"",
      "\"They don't trust you until you leave your device at the treeline.\"",
    ],
  },
  {
    name: "Glass City",
    controlledBy: "Prism Media Group / Autonomous Systems",
    tagline: "A million screens. Zero witnesses.",
    description:
      "The most densely surveilled district in existence — and somehow the most deserted. " +
      "Glass City is a cyberpunk megalopolis of towering glass skyscrapers packed floor-to-ceiling " +
      "with holographic advertisements, but the streets below are hauntingly empty. No cars, no " +
      "bicycles, no pedestrians. Autonomous delivery drones handle every last-metre run; human " +
      "couriers were phased out years ago by Prism Media Group's AI logistics division. Skaters " +
      "who work Glass City do so illegally, darting between sensor sweeps and drone corridors, " +
      "carrying packages the AI systems are not authorised to touch. Neon reflections pulse on " +
      "rain-soaked pavement. Every surface is a screen. Nobody is watching — and yet everything " +
      "is recorded.",
    atmosphere: "Rain-soaked neon reflections, towering glass towers, holographic ads, silent drone traffic, no humans in sight.",
    crews: ["Neon Ghosts", "The Static Pack", "Phantom Riders"],
    flavorTexts: [
      "\"The city looks alive. It isn't. The screens just make you think something's home.\"",
      "\"Every sensor gap is a window. Every drone route is a door. Learn the schedule.\"",
      "\"Glass City pays the best because nobody sane will skate it.\"",
    ],
  },
];

// ── Archetype lore ─────────────────────────────────────────────────────────────

export interface ArchetypeLoreEntry {
  name: Archetype;
  tagline: string;
  description: string;
  strengths: string;
}

export const ARCHETYPE_LORE: ArchetypeLoreEntry[] = [
  {
    name: "The Knights Technarchy",
    tagline: "The Dark Lights see everything. Serve or be disappeared.",
    description:
      "Cyber ninja zealots who serve a massive secret society known as the Dark Lights. " +
      "They move packages between hidden temples, and few dare to open them for fear of " +
      "being disappeared. The Knights Technarchy are predicted to attack the protagonist " +
      "to acquire a sacred artifact. They have no logos, no visible crew markings — " +
      "their rep is built entirely through fear and demonstrated precision.",
    strengths: "Maximum Stealth, elite Speed. Excels in surveillance-heavy districts. Penalty: low Rep.",
  },
  {
    name: "Qu111s",
    tagline: "The truth is in the data. We will release it.",
    description:
      "A guerilla journalist organization that monitors the activities of the oligarchs. " +
      "Known to protect individuals like Skids and plan to release intercepted data to " +
      "incite a revolution. The Qu111s operate through couriers who blend in as everyday " +
      "riders while carrying evidence that could topple the entire UCA power structure. " +
      "Quill-01 is their most active field operative.",
    strengths: "Maximum Rep, high Grit. Thrives in Nightshade and open districts. Penalty: low Stealth.",
  },
  {
    name: "Iron Curtains",
    tagline: "Overthrow the oligarchy. By any means necessary.",
    description:
      "Publicly known as a Communist revolutionary insurgent group wanting to overthrow the " +
      "oligarchy. They traffic in weapons and terrorism, viewing themselves as freedom fighters, " +
      "and use stolen information as leverage. They recruit heavily from ex-military veterans. " +
      "[Future Reveal Detail]: The Iron Curtains are later revealed to be a secret arm of the " +
      "UCA, operating as a false flag revolutionary group to suck in malcontents and keep them impotent.",
    strengths: "High Grit, balanced stats. Adaptable across all districts. Steady performers over specialists.",
  },
  {
    name: "D4rk $pider",
    tagline: "Data for blackmail. Blackmail for survival.",
    description:
      "Hackers on the dark web who mirror the Qu111s' methods but use data for blackmail " +
      "and scams rather than journalism. They carry chips they often encrypted themselves — " +
      "which means they know exactly how dangerous the information is. " +
      "[Mysterious Detail]: It is unknown if they are secretly funded by revolutionaries " +
      "(like the Iron Curtains) or if they are simply poor people using their skills to earn money.",
    strengths: "Maximum Tech, strong Stealth. The Grid is their natural habitat.",
  },
  {
    name: "The Asclepians",
    tagline: "Medicine moves. People live. No questions asked.",
    description:
      "A medical humanitarian organization funded by rich oligarchy philanthropy. They use " +
      "couriers to transport special medical gear, organs, or medicine to impoverished " +
      "neighborhoods, though sometimes to rich people as well. These items are highly sought " +
      "after and often stolen. The Asclepians placed Skids undercover after the Moonrisers " +
      "recruited him — using his clean record as cover for a high-risk mission.",
    strengths: "Good Speed, high Grit, strong community access. Thrives in Batteryville and Nightshade.",
  },
  {
    name: "The Mesopotamian Society",
    tagline: "Indiana Jones on an electric mountain skateboard.",
    description:
      "A university archaeological organization dedicated to tracking down and transporting " +
      "rare artifacts for museums and wealthy Airaway mansions. Their work leads them into " +
      "the Nightshade and into contact with secret religious cults who try to steal the items " +
      "back. They are connected to the sacred artifact that the Knights Technarchy wants — " +
      "the object that puts Skids in the crosshairs of multiple factions.",
    strengths: "Maximum Rep, high Tech. Unmatched Electropolis access. Penalty: limited Stealth.",
  },
  {
    name: "Hermes' Squirmies",
    tagline: "Any job. Any package. Any risk. Price adjusted accordingly.",
    description:
      "A neutral union of couriers with a strong policy on secrecy. They hide in plain " +
      "sight by blending in as union blue collar workers. Hermes' Squirmies will take any " +
      "job from any client with no ideological screening — a deliberate strategy that keeps " +
      "them employable across all sides of every conflict. No questions. Price adjusted for risk.",
    strengths: "Balanced stats. Neutral reputation. Works across all districts without faction penalties.",
  },
  {
    name: "UCPS",
    tagline: "Sanctioned delivery. Corporate rates. No questions.",
    description:
      "The postal service officially sanctioned by the Airaway governing body. The UCPS uses " +
      "board-riding workers and is known to hire from Punch Skater crowds because of their " +
      "knowledge of the 'ropes'. Working for the UCPS is a common cover identity for couriers " +
      "who need to move through Electropolis checkpoints without Fuzz attention.",
    strengths: "Good Speed, solid Rep. Moves through corp-controlled districts with reduced scrutiny.",
  },
  {
    name: "The Team",
    tagline: "Coordination wins races. Coordination wins everything.",
    description:
      "A neutral coordinated group of ex athletes who team up with such precision that they " +
      "provide stiff competition for the big oligarchs. They dress like Olympic snowboarders — " +
      "matching sponsored ensembles, high-end performance fabrics, coordinated team colors. " +
      "Individually skilled but devastatingly effective as a unit. The oligarchs haven't " +
      "figured out how to buy them — yet.",
    strengths: "High Speed, high Grit. Exceptional in team-based operations. Strong Rep through visible performance.",
  },
];

// ── Faction lore ───────────────────────────────────────────────────────────────

export interface FactionLoreEntry {
  name: Faction;
  districts: string[];
  tagline: string;
  description: string;
}

export const FACTION_LORE: FactionLoreEntry[] = [
  {
    name: "United Corporations of America (UCA)",
    districts: ["Airaway", "Electropolis"],
    tagline: "Infrastructure, security, compliance. In that order.",
    description:
      "The dominant governing body — a consortium of leading corporations managing global " +
      "infrastructure from Airaway. The UCA provides identical white bikes to workers and " +
      "families as a symbol of sanctioned transit. These bikes are prime targets for Punch " +
      "Skater broomstick attacks. The UCA secretly controls the Iron Curtains as a false-flag " +
      "revolutionary group to contain and neutralize genuine dissent.",
  },
  {
    name: "Qu111s (Quills)",
    districts: ["Nightshade"],
    tagline: "The truth is in the data. We will release it.",
    description:
      "A guerrilla journalist organization that monitors the activities of the oligarchs. " +
      "The Quills are known to protect couriers like Skids who carry dangerous information. " +
      "Their end goal is to release intercepted data — including evidence that the Iron " +
      "Curtains are a UCA false-flag operation — to spark a city-wide revolution. " +
      "Quill-01 is their most active field operative.",
  },
  {
    name: "Ne0n Legion",
    districts: ["Nightshade", "The Grid"],
    tagline: "Information is a commodity. We are the market.",
    description:
      "Thieves and mercenaries for hire who steal information and sell it back to oligarchs " +
      "or other political interests. The Neon Legion operates without ideology — they are " +
      "purely transactional. They are one of the factions that puts Skids in their crosshairs " +
      "after he picks up the memory disc containing evidence against the UCA.",
  },
  {
    name: "Iron Curtains",
    districts: ["The Grid", "Batteryville"],
    tagline: "Overthrow the oligarchy. By any means necessary.",
    description:
      "Publicly known as a Communist revolutionary insurgent group. They traffic in weapons " +
      "and terrorism, viewing themselves as freedom fighters who use stolen information as " +
      "leverage. They recruit heavily from Ex Military archetypes. " +
      "[Hidden truth]: The Iron Curtains are secretly a UCA false-flag operation — designed " +
      "to absorb malcontents and keep them impotent. A small internal faction discovered the " +
      "truth and sent Skids undercover to protect him from the deception.",
  },
  {
    name: "D4rk $pider",
    districts: ["The Grid", "Nightshade"],
    tagline: "Data for blackmail. Blackmail for survival.",
    description:
      "Hackers on the dark web who mirror the Quills' methods but use data for blackmail " +
      "and scams rather than journalism. Predominantly Hacker archetypes. " +
      "[Unresolved detail]: It is unknown whether D4rk $pider is secretly funded by " +
      "revolutionary interests (like the real Iron Curtains) or whether they are simply " +
      "skilled poor people using their abilities to survive.",
  },
  {
    name: "The Asclepians",
    districts: ["Airaway", "Batteryville", "Nightshade"],
    tagline: "Medicine moves. People live. No questions asked.",
    description:
      "A medical humanitarian organization funded by oligarchy philanthropy. They use couriers " +
      "to transport medical gear, organs, and medicine to impoverished neighborhoods — and " +
      "sometimes to wealthy clients as well. These deliveries are highly sought-after and " +
      "frequently stolen. The Asclepians placed Skids undercover in their organization after " +
      "the Moonrisers recruited him — using his clean record as cover for a high-risk mission.",
  },
  {
    name: "The Mesopotamian Society",
    districts: ["Nightshade", "Airaway"],
    tagline: "Indiana Jones on an electric mountain skateboard.",
    description:
      "A university archaeological organization dedicated to tracking down and transporting " +
      "rare artifacts for museums and wealthy Airaway mansions. Their work leads them into " +
      "the Nightshade and into contact with secret religious cults who try to steal the items " +
      "back. They are connected to the sacred artifact that Cyber Jeff Bezos wants delivered " +
      "— the object that puts the Knights Technarchy on Skids' trail.",
  },
  {
    name: "The Knights Technarchy",
    districts: ["Nightshade", "Airaway"],
    tagline: "The Dark Lights see everything. Serve or be disappeared.",
    description:
      "Cyber ninja zealots who serve a massive secret society known as the Dark Lights. " +
      "They move packages between hidden temples, and few dare to open them for fear of " +
      "being disappeared. The Knights Technarchy are predicted to attack Skids directly to " +
      "obtain the sacred artifact he has been tasked with delivering to Cyber Jeff Bezos — " +
      "creating the chaos that the Quills will use to release their data and spark a revolution.",
  },
  {
    name: "Hermes' Squirmies",
    districts: ["The Roads", "Batteryville", "Nightshade"],
    tagline: "Any job. Any package. Any risk. Price adjusted accordingly.",
    description:
      "A neutral union of couriers with a strong policy on secrecy. Hermes' Squirmies will " +
      "take any job from any client with no ideological screening. They are the most " +
      "politically neutral faction in the city — a deliberate strategy that keeps them " +
      "employable across all sides of every conflict.",
  },
  {
    name: "UCPS Workers",
    districts: ["Airaway", "Electropolis", "The Roads"],
    tagline: "Sanctioned delivery. Corporate rates. No questions.",
    description:
      "The postal service officially sanctioned by the Airaway governing body. The UCPS uses " +
      "board-riding workers and is known to hire from Punch Skater crowds because of their " +
      "street knowledge. Working for the UCPS is a common cover identity for couriers who " +
      "need to move through Electropolis checkpoints without Fuzz attention.",
  },
  {
    name: "Moonrisers",
    districts: ["Nightshade", "Batteryville"],
    tagline: "The capitalist pigs will fall. We just need the right spark.",
    description:
      "A gang that talks loudly about fighting the capitalist pigs and organizes underground " +
      "raves in Nightshade. Ketch brought Skids to a Moonriser rave where Skids demonstrated " +
      "his skills and was recruited for a test delivery run. Although Skids wanted to run with " +
      "the Moonrisers, they directed him to join the Asclepians undercover, using his clean " +
      "record as an asset.",
  },
  {
    name: "The Wooders",
    districts: ["The Forest"],
    tagline: "Build with wood. Grind with wood. Live without the grid.",
    description:
      "A Luddite community living in a wood-based agrarian forest settlement outside the main " +
      "city complex. The settlement resembles an Ewok village of wooden boardwalks and " +
      "elevated platforms. The Wooders insist on using exclusively wooden skateboard decks — " +
      "hence the name. They are deeply suspicious of corporate technology and are completely " +
      "self-governed. Their hand-built boards are legendarily durable.",
  },
  {
    name: "Punch Skaters",
    districts: ["Nightshade", "The Roads", "Batteryville"],
    tagline: "We are the lowest rung. And we are everywhere.",
    description:
      "The coined phrase for the lowest rung of Esk8r: bruised, bloodied gutter punks. " +
      "The term is both noun and verb — everyone in this world generally wants to 'punch them'. " +
      "Faction-less and amateur, they are outlawed in Airaway and considered a nuisance " +
      "by professional skaters. Their most infamous act is attacking UCA white bike riders " +
      "by throwing broomsticks into the wheel spokes. Skip 'Skids' Mayhew started here.",
  },
];
