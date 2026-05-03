# Punch Skater — Lore & World Bible

This directory is the human-readable companion to the live Codex data in
`/home/runner/work/Punch-Skater/Punch-Skater/src/lib/lore.ts`.
Writers, designers, and developers should keep these files aligned with the app so the
site, design docs, and future content all speak with one voice.

## Contents

| File | Description |
|------|-------------|
| [world-overview.md](./world-overview.md) | Macro setting, transit rules, courier code, and current world state |
| [districts.md](./districts.md) | District dossiers, corridor framing, and classified reveal notes |
| [archetypes.md](./archetypes.md) | The ten live courier archetypes used by the forge |
| [factions.md](./factions.md) | Public faction canon and the discovery-driven dossier model |
| [CHANGELOG.md](./CHANGELOG.md) | Short log of lore revisions that should be mirrored in the Codex |

## Canonical Sources

- **Structured app data:** `/home/runner/work/Punch-Skater/Punch-Skater/src/lib/lore.ts`
- **In-app Codex:** `/home/runner/work/Punch-Skater/Punch-Skater/src/pages/Lore.tsx`
- **Discovery-gated faction dossiers:** `/home/runner/work/Punch-Skater/Punch-Skater/src/pages/Factions.tsx`
- **Faction discovery persistence:** `/home/runner/work/Punch-Skater/Punch-Skater/src/hooks/useFactionDiscovery.ts`

## Update Workflow

When lore changes, update all three layers together:

1. **`src/lib/lore.ts`** for the canonical structured data used by the app and generators.
2. **`docs/lore/*.md`** for the readable world bible.
3. **`docs/lore/CHANGELOG.md`** plus the `LORE_UPDATES` export in `src/lib/lore.ts` so recent
   revisions remain visible and traceable.

If a change alters how the Codex presents information, also update
`/home/runner/work/Punch-Skater/Punch-Skater/src/pages/Lore.tsx`.
