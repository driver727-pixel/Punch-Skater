# Lore Changelog

Track narrative-facing changes here whenever canon, localization, or Codex presentation shifts.
Mirror each entry in `LORE_UPDATES` inside `src/lib/lore.ts` so the in-app Codex stays in sync.

## 2026-05

### Lore bible visibility tags introduced
- Reframed the lore docs as an internal story Bible instead of a purely public-facing packet.
- Added explicit **Public / Internal / Reveal** labels to hidden truths, plot pressure, and geography notes.
- Made **The Team** explicit in bloc-level references, removed remaining **Bezos** naming, and kept artifact-run details out of plain public canon.

### First wave of named district rivals
- Introduced the first five named district rivals: Jax Voltage (Batteryville),
  Mina Chrome (Airaway), Rook Wraith (Nightshade), Vex Static (The Grid),
  and Nova Saint (Glass City).
- Catalogued each rival's faction, personality, signature joust tactic,
  card reward, and Codex unlock under `docs/lore/rivals.md` and the
  structured catalogue in `src/lib/rivals.ts` / `server/lib/rivals.js`.
- Held The Forest as a future rival slot for the Wooders.

## 2026-04

### Australian theatre dossiers consolidated
- Locked the live districts to explicit Australian analogues.
- Clarified that **The Roads** are a route-event corridor layer, not a forge district.
- Kept **Electropolis** in the canon as a classified future reveal tied to the Fuzz.

### Faction intel moved behind discoveries
- Kept the world-level list of power blocs public in the Codex.
- Moved full faction dossiers to the discovery-gated **Factions** page.
- Framed forged combinations as the trigger for unlocking deeper crew intel.

### Courier schools aligned with live forge archetypes
- Replaced the outdated archetype bible with the ten active forge archetypes.
- Synced archetype writeups with Skids, the artifact run, and the current faction web.
- Added the refreshed archetype section to the in-app Codex.
