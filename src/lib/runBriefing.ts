/**
 * runBriefing.ts — Narrative Router for the Flash Courier mechanic.
 *
 * Accepts the five key variables (archetype, district, vectorShard,
 * ghostShard, payloadShard) and returns a `StoryNode` containing
 * prose text and a branching choice tree — the "Run Briefing."
 *
 * All prose is stored client-side; no LLM/server call is required.
 * The routing logic uses a priority cascade:
 *   1. Exact 5-variable match (rare; reserved for special combinations)
 *   2. District × Vector tag match
 *   3. District fallback (generic district flavour)
 *   4. Global fallback
 */

import type { CompiledNavDeck } from "./flashCourier";

// ── Output types ──────────────────────────────────────────────────────────────

/** A single branching choice offered at the end of the Run Briefing. */
export interface BriefingChoice {
  id: string;
  label: string;
  /** Short consequence hint shown in the choice button. */
  consequence: string;
  /** Stat modifier hints (narrative only — not mechanically enforced here). */
  modifiers?: {
    stealthDelta?: number;
    speedDelta?: number;
    riskDelta?: number;
    rewardDelta?: number;
  };
}

/**
 * The fully resolved Run Briefing story node.
 * Displayed after the Splicer Terminal compile animation completes.
 */
export interface StoryNode {
  /** Short one-line title for the briefing panel header. */
  title: string;
  /**
   * Multi-paragraph prose briefing (plain text; newlines are rendered as
   * paragraph breaks by the RunBriefing component).
   */
  prose: string[];
  /**
   * 2–3 player choices that end the briefing phase and feed into
   * the next game-state transition (encounter resolution, district run, etc.)
   */
  choices: BriefingChoice[];
  /** Optional atmospheric sub-header line (shown below the title in smaller text). */
  eyebrow?: string;
}

// ── Helper: tag intersection ──────────────────────────────────────────────────

function hasTags(tags: string[], ...checks: string[]): boolean {
  return checks.some((c) => tags.includes(c));
}

// ── District-level prose blocks ───────────────────────────────────────────────

type DistrictKey = "Airaway" | "Batteryville" | "The Grid" | "Nightshade" | "The Forest" | "Glass City";

const DISTRICT_OPEN_LINES: Record<DistrictKey, string> = {
  Airaway:
    "The thermals over Airaway are rough tonight — the transit drones are running offset patterns to avoid a pressure ridge stalling across the elevated freight lane. Amber hazard strobes blink in loose sequence eight stories below your drop point.",
  Batteryville:
    "Batteryville smells like ozone and overheated rubber. Every third block there's a charging plaza humming at a frequency that makes cheap electronics glitch. The surveillance grid here runs on distributed mesh — there's no single tower to knock out.",
  "The Grid":
    "The Grid is always awake. Data relay towers pulse in pink and white across the skyline. Down at street level, corporate walkers move in the kind of purposeful blur that means they're jacked in, half-present. The city processes you before you process it.",
  Nightshade:
    "Nightshade after 21:00 is a different architecture. The neon-bar signs are the brightest thing in the district — everything else is deliberately dim. Three rival factions claim adjacent blocks here, and the edges blur without warning.",
  "The Forest":
    "What they call The Forest is a kilometre-wide stretch of bio-reclaimed land between two old industrial zones. Sensor towers grow through the canopy. The corporate environmental arm runs access-controlled trails, but the root network runs deep and the old utility paths are off the map.",
  "Glass City":
    "Glass City doesn't hide anything — it puts it all in a display case. Every surface is reflective, every corner is archived to a cloud. The paradox is that the surveillance is so dense it folds on itself. Too much data reads as noise.",
};

const DISTRICT_CLOSE_LINES: Record<DistrictKey, string> = {
  Airaway:
    "The wind shear at this altitude will cover a lot of sound. That's the only advantage the approach has given you.",
  Batteryville:
    "The charging-plaza interference buys you maybe ninety seconds of clean movement before the mesh self-heals.",
  "The Grid":
    "You have one window — a seven-minute diagnostic cycle when the relay towers are handshaking the overnight backup. Use it.",
  Nightshade:
    "The dark works for you until it doesn't. Once a rival marks you, the shadows belong to them too.",
  "The Forest":
    "The old utility paths don't show on any corporate map. That's the edge. Don't waste it.",
  "Glass City":
    "In Glass City, looking like you belong is the only armour that matters. Everything else is a tell.",
};

// ── Vector-tag prose inserts ──────────────────────────────────────────────────

function getVectorProse(tags: string[]): string {
  if (hasTags(tags, "aerial", "elevated")) {
    return "You drop from altitude, the city spread below you like a circuit board someone left face-up in the rain.";
  }
  if (hasTags(tags, "underground", "off-grid")) {
    return "The tunnel is warm and smells like two decades of standing water. Your board's proximity sensors tick quietly as you navigate the drainage geometry.";
  }
  if (hasTags(tags, "social", "fast")) {
    return "You move inside the flow of civilian traffic, matching their rhythm, invisible in your specificity.";
  }
  if (hasTags(tags, "infrastructure", "vertical")) {
    return "The maintenance shaft is a straight vertical drop — no camera coverage, no patrol schedule, no record of your access in the system.";
  }
  return "The route opens in front of you — not elegant, but uncontested.";
}

// ── Ghost-tag prose inserts ───────────────────────────────────────────────────

function getGhostProse(tags: string[]): string {
  if (hasTags(tags, "spoofed", "social")) {
    return "The badge reader blinks green. Somewhere in the authentication chain a cloned credential is standing in for you, clean and deniable.";
  }
  if (hasTags(tags, "electronic", "aoe")) {
    return "The EMP wash rolls out in a soft cone. Camera buffers wipe. You count three seconds and move.";
  }
  if (hasTags(tags, "stealth", "physical")) {
    return "The thermal wrap makes you invisible to passive sensors — a ghost on the thermal register, a gap in the heat map.";
  }
  if (hasTags(tags, "passive", "urban")) {
    return "You dissolve into foot traffic, letting the crowd pattern-match around you while the AI loses your thread in the density.";
  }
  return "The cover holds — for now.";
}

// ── Payload-tag prose inserts ─────────────────────────────────────────────────

function getPayloadProse(tags: string[]): string {
  if (hasTags(tags, "economic", "greed")) {
    return "The packet weight is wrong. You can feel it — whatever the client said was in here, there's more. Credits, data, or something the manifest doesn't name. You could leave it. You probably should.";
  }
  if (hasTags(tags, "intel", "passive")) {
    return "You've already opened a passive tap on the relay. Whatever passes through this node tonight goes into a buffer you'll review later. The client never has to know it happened.";
  }
  if (hasTags(tags, "deception", "high-risk")) {
    return "The real package is three blocks north, in a dead drop you seeded two days ago. What you're delivering now is a convincing nothing — a decoy that will keep the receiving party occupied long enough for you to clear the district.";
  }
  if (hasTags(tags, "stealth", "clean")) {
    return "No ping. No trace. The ghost-exit protocol is already running — by the time anyone reviews the footage, your biometrics are scrubbed and your route is a dead sector in the archive.";
  }
  return "The secondary objective is live. Whether you act on it is the only variable the mission didn't account for.";
}

// ── Archetype-flavoured coda lines ────────────────────────────────────────────

function getArchetypeCoda(archetype: string): string {
  const coda: Record<string, string> = {
    "The Knights Technarchy":
      "Your courier ID reads 'Lab Sample Logistics.' The badge is immaculate. The sample satchel gives the whole disguise a weight that sells itself.",
    "Qu111s":
      "The press pass is clipped visible — not hiding, just another journalist chasing a story through a restricted zone. Nobody looks twice at someone taking notes.",
    "Ne0n Legion":
      "The security-guard posture is muscle memory. You move like someone who belongs here, because you've spent long enough pretending that you almost believe it.",
    "Iron Curtains":
      "The delivery bag is heavy and you carry it like it isn't. Hard-wearing patience is the whole skill.",
    "D4rk $pider":
      "The hoodie is up. The wrist-screen is dark. You are, from the right angle, just another coder moving between access points — technically present, practically invisible.",
    "The Asclepians":
      "The aid-vest pockets are full of things that look medical. The medical pouch at your hip is the real cargo and nobody is going to stop a relief worker tonight.",
    "The Mesopotamian Society":
      "Field notebook in hand, survey satchel on the back — you're an archaeologist. This district is just another dig site, and the path through it is already mapped in your head.",
    "Hermes' Squirmies":
      "Hard hat, reflective vest, work boots. You look like you were sent by dispatch and nobody sends you home from a job site without a work order.",
    UCPS:
      "The postal route is logged, laminated, and clipped to the bag. You are, on paper, delivering parcels. On paper is good enough.",
    "The Team":
      "Service vest, bar rag at the belt, comfortable shoes. You move like the floor is your domain — because it has been, every shift, for years.",
  };
  return coda[archetype] ?? "You've run harder approaches. This one is manageable.";
}

// ── Choice banks by payload tag ───────────────────────────────────────────────

function getChoices(payloadTags: string[], district: string): BriefingChoice[] {
  if (hasTags(payloadTags, "economic", "greed")) {
    return [
      {
        id: "take-the-extra",
        label: "Skim the overflow",
        consequence: "Pocket what the manifest doesn't account for. Higher Ozzies return, but the client may notice.",
        modifiers: { rewardDelta: 2, riskDelta: 1 },
      },
      {
        id: "run-clean",
        label: "Run clean",
        consequence: "Deliver the packet intact. Lower risk, standard reward. No paper trail.",
        modifiers: { stealthDelta: 1, riskDelta: -1 },
      },
      {
        id: "document-anomaly",
        label: "Document the discrepancy",
        consequence: "Record the weight irregularity and flag it to a third party after the run. Slow burn reward.",
        modifiers: { rewardDelta: 1, speedDelta: -1 },
      },
    ];
  }
  if (hasTags(payloadTags, "intel", "passive", "deniable")) {
    return [
      {
        id: "keep-tap-running",
        label: "Keep the tap open",
        consequence: "Let the buffer fill through the whole run. Richer intel, tighter exit window.",
        modifiers: { rewardDelta: 2, speedDelta: -1 },
      },
      {
        id: "close-tap-early",
        label: "Pull the tap before delivery",
        consequence: "Limit exposure. What you have is enough. Cleaner exit, lower haul.",
        modifiers: { stealthDelta: 1, rewardDelta: -1 },
      },
      {
        id: "sell-to-rival",
        label: `Pass the intel to a ${district} contact`,
        consequence: "High immediate payout. The client finds out eventually.",
        modifiers: { rewardDelta: 3, riskDelta: 2 },
      },
    ];
  }
  if (hasTags(payloadTags, "deception", "high-risk")) {
    return [
      {
        id: "complete-the-switch",
        label: "Complete the bait-and-switch",
        consequence: "Deliver the decoy. Retrieve the real payload from the dead drop. Maximum risk, maximum control.",
        modifiers: { riskDelta: 2, rewardDelta: 2 },
      },
      {
        id: "abort-secondary",
        label: "Abort the secondary op",
        consequence: "Deliver the real package as briefed. Safer. The dead drop stays cold.",
        modifiers: { stealthDelta: 2, riskDelta: -2 },
      },
      {
        id: "hand-off-real",
        label: "Hand off the real package to an intermediary",
        consequence: "Split the exposure. The intermediary takes the risk; you take the smaller cut.",
        modifiers: { riskDelta: 1, rewardDelta: 1 },
      },
    ];
  }
  // Default choice set — used when no payload tag matches specifically
  return [
    {
      id: "push-forward",
      label: "Push forward — execute the route",
      consequence: "Commit to the compiled approach. Standard risk profile.",
      modifiers: { speedDelta: 1 },
    },
    {
      id: "adapt-on-the-fly",
      label: "Improvise — read the district",
      consequence: "Deviate from the route as conditions dictate. Higher variance, possible bonus intel.",
      modifiers: { riskDelta: 1, rewardDelta: 1 },
    },
    {
      id: "abort-and-re-route",
      label: "Abort and re-compile",
      consequence: "Call the run off and return to the terminal. No penalty, no reward.",
      modifiers: { riskDelta: -2, rewardDelta: -2 },
    },
  ];
}

// ── Main routing function ─────────────────────────────────────────────────────

/**
 * Accepts a compiled NavDeck and returns a `StoryNode` — the Run Briefing.
 *
 * @example
 * const node = resolveRunBriefing(compiledNavDeck);
 * // → { title, eyebrow, prose: string[], choices: BriefingChoice[] }
 */
export function resolveRunBriefing(deck: CompiledNavDeck): StoryNode {
  const { archetype, district, vector, ghost, payload } = deck;

  const districtKey = district as DistrictKey;
  const openLine = DISTRICT_OPEN_LINES[districtKey]
    ?? `The district stretches out ahead of you — ${district} never sleeps.`;
  const closeLine = DISTRICT_CLOSE_LINES[districtKey]
    ?? "The window is tight. You know what needs to happen.";

  const vectorLine = getVectorProse(vector.tags);
  const ghostLine = getGhostProse(ghost.tags);
  const payloadLine = getPayloadProse(payload.tags);
  const codaLine = getArchetypeCoda(archetype);

  const prose = [
    openLine,
    `${vectorLine} ${ghost.name}: ${ghostLine}`,
    payloadLine,
    codaLine,
    closeLine,
  ];

  const eyebrow = `${vector.name} / ${ghost.name} / ${payload.name}`;

  const title = `RUN BRIEFING — ${district.toUpperCase()}`;

  const choices = getChoices(payload.tags, district);

  return { title, eyebrow, prose, choices };
}
