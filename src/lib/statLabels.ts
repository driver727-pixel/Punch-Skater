// ── Centralised stat display labels & tooltips ──────────────────────────────
// Every UI surface that shows a stat abbreviation should pull from here so that
// labels stay consistent and users always see the same tooltip descriptions.

/** Forged card stats (canonical model) */
export const CARD_STAT_LABELS = {
  speed:   { label: "Speed",   tooltip: "Movement speed and evasion ability" },
  range:   { label: "Range",   tooltip: "Battery range and sustained run distance" },
  rangeNm: { label: "NM",      tooltip: "Estimated range in nautical miles" },
  stealth: { label: "Stealth", tooltip: "Ability to avoid detection and move unseen" },
  grit:    { label: "Grit",    tooltip: "Toughness, resilience, and raw endurance" },
} as const;
