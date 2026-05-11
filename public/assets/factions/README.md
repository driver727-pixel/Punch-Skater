# Faction Background Images

Place faction background images here as `<slug>.webp`.

The slug for each faction is produced by `factionSlug(faction.name)` —
lowercase with non-alphanumeric runs replaced by `_`, with the overrides
in `src/lib/factionSlug.ts` applied first (e.g. UCA → `uca`).

Registered images (place the file, it is picked up automatically):

| Faction                              | File                          |
|--------------------------------------|-------------------------------|
| D4rk $pider                          | `d4rk_pider.webp`              |
| Hermes' Squirmies                    | `hermes_squirmies.webp`        |
| Iron Curtains                        | `iron_curtains.webp`           |
| Ne0n Legion                          | `ne0n_legion.webp`             |
| Qu111s (Quills)                      | `qu111s_quills.webp`           |
| The Asclepians                       | `the_asclepians.webp`          |
| The Knights Technarchy               | `the_knights_technarchy.webp`  |
| The Mesopotamian Society             | `the_mesopotamian_society.webp`|
| The Team                             | `the_team.webp`                |
| The Wooders                          | `the_wooders.webp`             |
| United Corporate Alliance (UCA)      | `uca.webp`                     |
| UCPS Workers                         | `ucps_workers.webp`            |

Images uploaded via the Admin panel (Firebase Storage) take precedence over
these static files.
