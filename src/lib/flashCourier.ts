/**
 * flashCourier.ts — Data models for the Flash Courier mechanic.
 *
 * The player compiles a "Burn Route" by slotting three Data Shards
 * (Vector, Ghost, Payload) into the Splicer Terminal before a run.
 * The resulting NavDeck state, combined with the card's Cover Identity
 * and District, drives the RunBriefing narrative engine.
 *
 * Rules (append-only contract, same as sharedTypes.ts):
 *  1. Never remove or rename an existing type.
 *  2. New fields on existing interfaces must be optional (?:).
 *  3. Add new types at the bottom of the relevant section.
 */

import type { Archetype, District } from "./types";

// ── Shard kinds ───────────────────────────────────────────────────────────────

/**
 * The three shard slot roles a player must fill to compile a Burn Route.
 * • Vector  — *how* the courier approaches the target zone.
 * • Ghost   — *how* the courier stays invisible/undetected.
 * • Payload — a wildcard modifier that bends the mission outcome.
 */
export type ShardKind = "vector" | "ghost" | "payload";

/**
 * A single Data Shard card. Shards are stateless catalogue entries; the player
 * equips them into a NavDeck for a specific run.
 */
export interface DataShard {
  /** Unique stable identifier — used as the drag-source key and Firestore doc id. */
  id: string;
  kind: ShardKind;
  name: string;
  /** One-sentence flavour description shown in the terminal slot. */
  flavour: string;
  /**
   * Modifier tags that the RunBriefing engine reads to select narrative branches.
   * e.g. "elevated", "spoofed", "economic"
   */
  tags: string[];
  /** Optional Ozzies cost to equip this shard for a single run (0 = free). */
  ozziesCost?: number;
}

// ── Player NavDeck state ──────────────────────────────────────────────────────

/**
 * The three shard slots the player must fill before compiling.
 * Stored locally while the player is configuring; persisted to Firestore
 * under `users/{uid}/navDecks/{navDeckId}` once compiled.
 */
export interface NavDeckSlots {
  vector: DataShard | null;
  ghost: DataShard | null;
  payload: DataShard | null;
}

/**
 * Full NavDeck — the compiled run configuration.
 * The RunBriefing engine receives a `CompiledNavDeck` to generate its output.
 */
export interface CompiledNavDeck {
  navDeckId: string;
  uid: string;
  /** Cover Identity archetype from the Card Forge. */
  archetype: Archetype;
  /** District the courier is operating in. */
  district: District;
  vector: DataShard;
  ghost: DataShard;
  payload: DataShard;
  compiledAt: string; // ISO 8601
}

// ── Shard catalogue (static data — no server round-trip needed) ───────────────

/** Vector shards: approach / entry method. */
export const VECTOR_SHARDS: DataShard[] = [
  {
    id: "vec-service-elevator",
    kind: "vector",
    name: "Service Elevator Override",
    flavour: "Splice the freight elevator's RFID handshake and ride it straight to the maintenance level.",
    tags: ["indoor", "vertical", "infrastructure"],
  },
  {
    id: "vec-rooftop-glider",
    kind: "vector",
    name: "Rooftop Glider Drop",
    flavour: "Deploy a collapsible wing-rig from a high-altitude transit drone. Thermal updrafts do the rest.",
    tags: ["elevated", "aerial", "silent"],
  },
  {
    id: "vec-sewer-transit",
    kind: "vector",
    name: "Sewer Transit Line",
    flavour: "Old district drainage maps show a gap in the sensor grid. Wet, but invisible.",
    tags: ["underground", "off-grid", "slow"],
  },
  {
    id: "vec-corporate-shuttle",
    kind: "vector",
    name: "Corpo Shuttle Bluff",
    flavour: "Flag down a corporate transit pod and bluff a corporate passenger manifest. Clean, fast, risky.",
    tags: ["social", "fast", "contested"],
  },
  {
    id: "vec-delivery-drone",
    kind: "vector",
    name: "Automated Delivery Drone",
    flavour: "Hitch a passive ride inside a bulk-cargo drone's payload bay. Nobody checks the crates.",
    tags: ["aerial", "concealed", "infrastructure"],
  },
  {
    id: "vec-mag-rail-surf",
    kind: "vector",
    name: "Mag-Rail Surfboard",
    flavour: "Lock a skate-deck electromagnetically to the undercarriage of a maglev car. Don't miss the dismount.",
    tags: ["fast", "elevated", "physical"],
  },
];

/** Ghost shards: camouflage / identity spoofing. */
export const GHOST_SHARDS: DataShard[] = [
  {
    id: "gho-spoofed-id",
    kind: "ghost",
    name: "Spoofed Corpo ID",
    flavour: "A cloned badge and a forged biometric pulse. Security panels see exactly what they're told to see.",
    tags: ["spoofed", "social", "fragile"],
  },
  {
    id: "gho-kinematic-emp",
    kind: "ghost",
    name: "Kinematic EMP",
    flavour: "A localised pulse that wipes camera buffers in a 30-metre cone without tripping hard-line alarms.",
    tags: ["electronic", "aoe", "timed"],
  },
  {
    id: "gho-thermal-cloak",
    kind: "ghost",
    name: "Thermal Cloak Wrap",
    flavour: "Mylar-wrapped courier suit that masks heat signature. Only useful if they're not scanning visually.",
    tags: ["stealth", "physical", "limited"],
  },
  {
    id: "gho-crowd-weave",
    kind: "ghost",
    name: "Crowd Weave Protocol",
    flavour: "Move within tightly tracked civilian foot traffic. Pattern-matching AI loses the thread in high density.",
    tags: ["social", "urban", "passive"],
  },
  {
    id: "gho-signal-jammer",
    kind: "ghost",
    name: "Signal Jammer Wristband",
    flavour: "Blanket RF suppression. Kills comms in a block radius — including yours. Commit once.",
    tags: ["electronic", "aggressive", "committed"],
  },
  {
    id: "gho-maintenance-disguise",
    kind: "ghost",
    name: "Maintenance Crew Disguise",
    flavour: "Hard-hat, reflective vest, tool belt. Nobody stops someone who looks like they belong.",
    tags: ["social", "slow", "reliable"],
  },
];

/** Payload shards: wildcard modifiers that warp the mission's outcome space. */
export const PAYLOAD_SHARDS: DataShard[] = [
  {
    id: "pay-skim-credits",
    kind: "payload",
    name: "Skimming Extra Credits",
    flavour: "The packet's encrypted but you can see the weight. There's more in here than the client admitted.",
    tags: ["economic", "risk", "greed"],
    ozziesCost: 0,
  },
  {
    id: "pay-eavesdrop",
    kind: "payload",
    name: "Eavesdropping — Secure Channel",
    flavour: "Tap the encrypted relay and let the run pay twice: once for the client, once for the intel.",
    tags: ["intel", "passive", "deniable"],
    ozziesCost: 0,
  },
  {
    id: "pay-plant-tracker",
    kind: "payload",
    name: "Plant a Tracker",
    flavour: "Slip a dust-sized locator into the delivery. The receiving party won't know they're being watched.",
    tags: ["intel", "delayed", "deniable"],
    ozziesCost: 0,
  },
  {
    id: "pay-swap-payload",
    kind: "payload",
    name: "Bait-and-Switch Package",
    flavour: "Deliver a convincing decoy. The real cargo goes somewhere else entirely. Burn the manifest.",
    tags: ["deception", "high-risk", "contested"],
    ozziesCost: 10,
  },
  {
    id: "pay-document-run",
    kind: "payload",
    name: "Document the Run",
    flavour: "Record everything — feeds, encounters, routes. This footage has value to the right journalist.",
    tags: ["intel", "evidence", "slow"],
    ozziesCost: 0,
  },
  {
    id: "pay-ghost-exit",
    kind: "payload",
    name: "Ghost Exit Protocol",
    flavour: "No paper trail, no biometric ping at the drop. You were never there. The mission never happened.",
    tags: ["stealth", "clean", "professional"],
    ozziesCost: 5,
  },
];

/** All shards indexed by kind — convenience for the Splicer Terminal UI. */
export const ALL_SHARDS: Record<ShardKind, DataShard[]> = {
  vector: VECTOR_SHARDS,
  ghost: GHOST_SHARDS,
  payload: PAYLOAD_SHARDS,
};

/** Human-readable labels for each slot kind. */
export const SHARD_KIND_LABELS: Record<ShardKind, string> = {
  vector: "VECTOR — Approach",
  ghost: "GHOST — Camouflage",
  payload: "PAYLOAD — Wild Card",
};

/** Accent colours for each slot kind (matches existing theme variables). */
export const SHARD_KIND_COLORS: Record<ShardKind, string> = {
  vector: "#00ccff",
  ghost: "#cc44ff",
  payload: "#00ff88",
};

/** Glyphs used as decorative prefixes in the terminal UI. */
export const SHARD_KIND_GLYPHS: Record<ShardKind, string> = {
  vector: "◈",
  ghost: "◎",
  payload: "⚡",
};
