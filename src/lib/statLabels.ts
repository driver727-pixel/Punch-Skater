// ── Centralised stat display labels & tooltips ──────────────────────────────
// Every UI surface that shows a stat abbreviation should pull from here so that
// labels stay consistent and users always see the same tooltip descriptions.

/** Character card stats */
export const CARD_STAT_LABELS = {
  speed:   { label: "Speed",   tooltip: "Movement speed and evasion ability" },
  stealth: { label: "Stealth", tooltip: "Ability to avoid detection and move unseen" },
  tech:    { label: "Tech",    tooltip: "Technical skill, hacking, and gadget proficiency" },
  grit:    { label: "Grit",    tooltip: "Toughness, resilience, and raw endurance" },
  rep:     { label: "Rep",     tooltip: "Street reputation and social influence" },
} as const;

/** Board / skateboard loadout stats */
export const BOARD_STAT_LABELS = {
  speed:        { label: "Speed",        tooltip: "Board top speed" },
  acceleration: { label: "Accel",        tooltip: "How quickly the board reaches top speed" },
  range:        { label: "Range",        tooltip: "Battery range before recharge is needed" },
} as const;

/** Mission-specific stat labels (combines card + board concepts) */
export const MISSION_STAT_LABELS = {
  speed:            { label: "Speed",        tooltip: "Combined movement speed for this mission" },
  acceleration:     { label: "Accel",        tooltip: "How quickly the runner accelerates" },
  stealth:          { label: "Stealth",      tooltip: "Ability to avoid detection during the mission" },
  batteryRemaining: { label: "Range",        tooltip: "Remaining battery range" },
  health:           { label: "Health",       tooltip: "Hit points remaining" },
} as const;
