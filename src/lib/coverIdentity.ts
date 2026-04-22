import type { Archetype, Style } from "./types";

export interface CoverIdentityProfile {
  label: string;
  coverRole: string;
  style: Style;
  lookPrompt: string;
  posePrompt: string;
}

export const COVER_IDENTITY_PROFILES: Record<Archetype, CoverIdentityProfile> = {
  "The Knights Technarchy": {
    label: "Science Lab Technician",
    coverRole: "science lab technician courier",
    style: "Corporate",
    lookPrompt: "clean science-lab workwear: a fitted lab coat or technical coveralls over practical courier layers, clipped ID badge, sealed sample satchel, protective gloves, and precise sterile tech details",
    posePrompt: "holding a precise lab-run courier stance with measured balance, analytical focus, and careful handling of fragile cargo",
  },
  Qu111s: {
    label: "Journalist",
    coverRole: "journalist courier",
    style: "Street",
    lookPrompt: "field-journalist gear: weatherproof street clothes, press pass, cross-body messenger bag, compact recorder, notebook, and camera-ready practical layers",
    posePrompt: "striking a focused investigative action pose with determined eye contact, quick-note reflexes, and a bag secured for a fast scoop",
  },
  "Ne0n Legion": {
    label: "Security Guard",
    coverRole: "security guard courier",
    style: "Ex Military",
    lookPrompt: "private-security duty wear: armored work vest, radio earpiece, utility belt, sturdy patrol boots, gloves, and a practical professional uniform built for fast response",
    posePrompt: "leaning into an alert protective stance with disciplined footing, scanning focus, and controlled ready-to-react movement",
  },
  "Iron Curtains": {
    label: "Chef",
    coverRole: "chef courier",
    style: "Street",
    lookPrompt: "working-chef delivery gear: stained apron over rolled-sleeve kitchen clothes, service towel, heat-worn gloves, non-slip shoes, and practical food-run accessories",
    posePrompt: "driving forward in a kitchen-rush delivery stance with tough service-worker swagger, fast hands, and a heavy-duty food-run loadout",
  },
  "D4rk $pider": {
    label: "Coder",
    coverRole: "coder courier",
    style: "Punk Rocker",
    lookPrompt: "coder courier gear: dark layered hoodie, modular sling bag, wearable screens, cable loops, patched techwear, and improvised hardware clipped to the outfit",
    posePrompt: "locked into a sharp hacker-courier pose with compact tech gear, fast hands, and high-alert focus",
  },
  "The Asclepians": {
    label: "Humanitarian",
    coverRole: "humanitarian courier",
    style: "Union",
    lookPrompt: "humanitarian relief gear: practical field jacket, aid-vest pockets, medical pouch, durable gloves, supply straps, and hard-worn emergency-response layers",
    posePrompt: "in a decisive emergency-response stance, ready to deliver urgent aid supplies without breaking stride",
  },
  "The Mesopotamian Society": {
    label: "Archaeologist",
    coverRole: "archaeologist courier",
    style: "Off-grid",
    lookPrompt: "field-archaeologist expedition wear: dust-worn utility jacket, layered trail clothes, survey satchel, notebook straps, and rugged discovery-kit details",
    posePrompt: "balancing confidently in an adventurous field-research pose with treasure-hunter swagger and expedition momentum",
  },
  "Hermes' Squirmies": {
    label: "Blue collar worker",
    coverRole: "blue collar worker courier",
    style: "Union",
    lookPrompt: "hard-working blue-collar gear: durable workwear, tool-belt attachments, scuffed boots, gloves, reinforced layers, and practical job-site utility details",
    posePrompt: "driving forward in a hard-working delivery pose with practical momentum, job-site grit, and a body used to heavy lifting",
  },
  UCPS: {
    label: "Postal worker",
    coverRole: "postal worker courier",
    style: "Union",
    lookPrompt: "postal-route uniform: mail jacket, cross-body satchel, parcel straps, organized tag bundles, practical utility layers, and efficient route-runner gear",
    posePrompt: "in a disciplined postal-delivery action pose with a secure parcel, efficient movement, and practiced route-running balance",
  },
  "The Team": {
    label: "Bartender",
    coverRole: "bartender courier",
    style: "Street",
    lookPrompt: "bartender off-shift workwear: service vest or apron, rolled sleeves, bar rag or opener clipped at the waist, nightlife-ready layers, and confident hospitality swagger",
    posePrompt: "holding a smooth nightlife-service stance with quick balance, relaxed confidence, and the ready motion of someone weaving through a crowded bar",
  },
};

export const FORGE_ARCHETYPE_OPTIONS = Object.entries(COVER_IDENTITY_PROFILES).map(([value, profile]) => ({
  value: value as Archetype,
  label: profile.label,
  coverRole: profile.coverRole,
}));

const COVER_IDENTITY_PROFILE_MAP = new Map<Archetype, CoverIdentityProfile>(
  Object.entries(COVER_IDENTITY_PROFILES).map(([value, profile]) => [value as Archetype, profile]),
);

export function getCoverIdentityProfile(archetype: unknown): CoverIdentityProfile | null {
  if (typeof archetype !== "string") return null;
  return COVER_IDENTITY_PROFILE_MAP.get(archetype as Archetype) ?? null;
}

export function getForgeArchetypeLabel(archetype: Archetype): string {
  return getCoverIdentityProfile(archetype)?.label ?? archetype;
}

export function getForgeCoverRole(archetype: Archetype): string {
  return getCoverIdentityProfile(archetype)?.coverRole ?? `${getForgeArchetypeLabel(archetype).toLowerCase()} courier`;
}

export function resolveCoverIdentityStyle(archetype: unknown): Style | null {
  return getCoverIdentityProfile(archetype)?.style ?? null;
}
