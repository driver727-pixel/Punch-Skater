import type { CardPayload, Style } from "./types";
import { resolveCoverIdentityStyle } from "./coverIdentity";

const LEGACY_STYLE_REMAP: Record<string, string> = {
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
  if (style === rawStyle) return card;
  return {
    ...card,
    prompts: { ...card.prompts, style },
  };
}
