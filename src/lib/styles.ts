import type { CardPayload, Style } from "./types";
import { resolveCoverIdentityStyle } from "./coverIdentity";
import { normalizeCardStats } from "./generator";

const LEGACY_STYLE_REMAP: Record<string, string> = {
  // Legacy removed styles still normalize into the current active style list so
  // old saved/imported cards keep a valid style selection.
  Chef: "Street",
  Ninja: "Ex Military",
  Hacker: "Punk Rocker",
  Military: "Ex Military",
};

export const ACTIVE_STYLES: Style[] = [
  "Corporate",
  "Punk Rocker",
  "Ex Military",
  "Fascist",
  "Street",
  "Off-grid",
  "Union",
  "Olympic",
];

const ACTIVE_STYLE_SET = new Set<string>(ACTIVE_STYLES);

export function normalizeStyle(style: unknown): Style {
  let resolved = typeof style === "string" ? style : "Street";
  const seen = new Set<string>();

  while (LEGACY_STYLE_REMAP[resolved] && !seen.has(resolved)) {
    seen.add(resolved);
    resolved = LEGACY_STYLE_REMAP[resolved];
  }

  return (ACTIVE_STYLE_SET.has(resolved) ? resolved : "Street") as Style;
}

export function resolveArchetypeStyle(archetype: unknown, style: unknown): Style {
  return resolveCoverIdentityStyle(archetype) ?? normalizeStyle(style);
}

/**
 * Applies only the first legacy hop so old style-linked gameplay/faction rules
 * can be reassigned exactly as requested before full style normalization.
 */
export function remapStyleConnection(style: unknown): string {
  const raw = typeof style === "string" ? style : "Street";
  return LEGACY_STYLE_REMAP[raw] ?? raw;
}

export function normalizeCardPayload(card: CardPayload): CardPayload {
  const rawStyle = typeof card.prompts?.style === "string" ? card.prompts.style : "Street";
  const style = resolveArchetypeStyle(card.prompts?.archetype, rawStyle);
  const normalizedStats = normalizeCardStats(card.stats);
  const hasStyleChange = style !== rawStyle;
  const hasStatChange = (Object.keys(card.stats) as Array<keyof typeof card.stats>)
    .some((key) => normalizedStats[key] !== card.stats[key]);

  if (!hasStyleChange && !hasStatChange) {
    return card;
  }

  return {
    ...card,
    stats: normalizedStats,
    prompts: {
      ...card.prompts,
      style,
    },
    tags: Array.isArray(card.tags)
      ? Array.from(new Set(card.tags.map((tag) => (tag === rawStyle ? style : tag))))
      : card.tags,
  };
}
