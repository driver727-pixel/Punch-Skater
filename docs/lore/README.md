# Punch Skater — Lore & World Bible

This directory contains the canonical lore reference for the Punch Skater universe.
Writers, designers, and developers should treat these documents as the authoritative
source of truth for all narrative and worldbuilding decisions.

## Contents

| File | Description |
|------|-------------|
| [world-overview.md](./world-overview.md) | The City, the Corps, the Courier Network, and how it all started |
| [districts.md](./districts.md) | Per-district geography, atmosphere, and faction control |
| [archetypes.md](./archetypes.md) | Courier archetypes — origins, culture, and play style |
| [factions.md](./factions.md) | Crews, corporations, and underground collectives |

## How This Lore Feeds Into the Game

All narrative content in these files is mirrored in `src/lib/lore.ts`, which exports
structured data arrays consumed by:

- **`src/lib/generator.ts`** — flavor texts, crew names, passive traits, active abilities,
  and manufacturer names are pulled from `lore.ts` so generated cards always have
  lore-accurate content.
- **`src/pages/Lore.tsx`** — the in-app Codex page renders district, archetype, and
  faction entries directly from `lore.ts`.

When you update lore content, update **both** the Markdown files (for human reference)
and the matching entries in `src/lib/lore.ts` (so the app reflects the changes).
