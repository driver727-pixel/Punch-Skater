# Faction Background Images

Place faction background images here as `<slug>.jpg`.

The slug for each faction is produced by `factionSlug(faction.name)` —
lowercase with non-alphanumeric runs replaced by `_`, with the overrides
in `src/lib/factionSlug.ts` applied first (e.g. UCA → `uca`).

Registered images (place the file, it is picked up automatically):

| Faction                              | File                          |
|--------------------------------------|-------------------------------|
| Qu111s (Quills)                      | `qu111s_quills.jpg`           |
| The Asclepians                       | `the_asclepians.jpg`          |
| The Knights Technarchy               | `the_knights_technarchy.jpg`  |
| The Mesopotamian Society             | `the_mesopotamian_society.jpg`|
| The Team                             | `the_team.jpg`                |
| The Wooders                          | `the_wooders.jpg`             |
| United Corporations of America (UCA) | `uca.jpg`                     |
| UCPS Workers                         | `ucps_workers.jpg`            |

Images uploaded via the Admin panel (Firebase Storage) take precedence over
these static files.
