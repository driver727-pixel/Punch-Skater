# Joustur Skatur — MVP Technical Spec

> Async Royal Game of Ur-inspired board mode for Punch Skater.
> Last updated: 2026-05-20

## Summary

Joustur Skatur is an async board game mode where two players race their rider
crews across a shared track.  Each player selects **6 rider cards + 1 support
card**.  Riders move by rolling 4 USB Shards (0–4 total steps).  Stealth
Alcoves are safe zones that also grant an extra turn.  The first player to
score all 6 riders wins.

---

## Faction mapping

| Punch Skater crew       | Joustur faction    |
|-------------------------|--------------------|
| Punch Skaters           | Rust Kids          |
| Ne0n Legion             | Neon Saints        |
| Qu111s (Quills)         | Signal Ghosts      |
| The Team                | Chrome Syndicate   |
| Iron Curtains           | Voltage Vultures   |
| The Asclepians          | Alley Wraiths      |
| _all other crews_       | Rust Kids (default)|

Faction is determined by the **support card's crew** for the player's overall
faction identity; each rider's individual faction is derived from its own crew.

---

## Board layout

```
Each player traverses their own ordered path of 14 tiles (1-based path index).
Path index 0 = off-board (not yet entered / bumped)
Path index 15 = exited / scored

Player 1 (challenger) tile path: 4, 3, 2, 1, 7, 8, 9, 10, 11, 12, 13, 14, 6, 5
Player 2 (defender) tile path:   18, 17, 16, 15, 7, 8, 9, 10, 11, 12, 13, 14, 20, 19

Path indices 1–4   : private entry    [private — no clashes here]
Path indices 5–12  : shared lane      [shared — joust clashes apply, tiles 7–14]
Path indices 13–14 : private exit     [private — no clashes here]
```

**Total on-board positions:** 14 (path indices 1–14).
**Total board tiles:** 20 (tiles 1–20).
Shared tiles (7–14) are traversed by both players.

### Stealth Alcoves — path indices 4, 6, 8, 12, 14

| Path Index | Zone              | Effect                              |
|------------|-------------------|-------------------------------------|
| 4          | Private entry     | Extra turn (not capturable anyway)  |
| 6          | Shared lane       | Safe from clashes + extra turn      |
| 8          | Shared lane       | Safe from clashes + extra turn      |
| 12         | Shared lane       | Safe from clashes + extra turn      |
| 14         | Private exit      | Extra turn (not capturable anyway)  |

---

## USB Shard roll

Four binary dice (each 0 or 1) are summed → **0–4**.  The server generates the
roll deterministically using a seeded PRNG keyed to
`matchId + "::" + turn + "::" + timestamp`.  The roll is stored in the match
document before being returned to the active player.

---

## Turn flow (two-step, server-authoritative)

1. **Roll** — active player calls `POST /api/joustur/match/:id/roll`.
   Server generates USB Shard result, stores it in the match, and returns it
   along with the list of legal moves.
2. **Move** — active player calls `POST /api/joustur/match/:id/move` with a
   chosen rider (or support activation).  Server validates and applies the
   move server-side, then returns the updated match state.

---

## Gameplay rules

- Exactly 6 rider cards + 1 support card per lineup.
- No duplicate card IDs within a lineup (support cannot duplicate a rider).
- Joust clashes only happen in the shared lane (path indices 5–12, tiles 7–14).
- Landing on an occupied shared tile starts a hidden **Joust Clash** instead of
  immediately bumping the opponent.
- Both riders secretly choose one stance: **charge**, **guard**, or **feint**.
- Stance triangle: **charge > feint**, **guard > charge**, **feint > guard**.
- A rider gains **+1 clash score** when they pick the stance favoured by their
  Joustur trait (`boost/strike/surge → charge`, `guard/anchor → guard`,
  `feint/slip/echo → feint`).
- Higher clash score wins the tile; ties favour the defender already occupying
  the tile.
- Clash loser is bumped to path index 0 and marked captured.
- Private lanes (indices 1–4 and 13–14) are always safe.
- A rider on a Stealth Alcove **cannot be challenged** (shared-zone alcoves).
- **Exact roll required to exit** — a rider must land on path index 15 exactly
  (overshoot = illegal).
- Roll 0 = forced pass (no legal moves).
- **Support card** may be activated **once per match**, as the player's sole
  action for that turn.
- Turns are strictly sequential — one player moves, then the other.

---

## Rider traits

Resolved deterministically per rider card via:
1. Exact trait-name lookup
2. Keyword scan of the trait name (case-insensitive substring match)
3. Default: **boost**

`boost | guard | feint | anchor | strike | slip | surge | echo`

---

## Faction passives

| Faction           | Passive key      |
|-------------------|------------------|
| Rust Kids         | patchworkRush    |
| Neon Saints       | crowdHalo        |
| Signal Ghosts     | ghostRoute       |
| Chrome Syndicate  | precisionCast    |
| Voltage Vultures  | surgeTrigger     |
| Alley Wraiths     | cutline          |

---

## Support effects (activated once per match)

| Faction           | Effect key    | Behaviour (MVP)                                                |
|-------------------|---------------|----------------------------------------------------------------|
| Rust Kids         | recoveryPing  | Recover first bumped rider from pos 0 → pos 1                 |
| Neon Saints       | crowdRoar     | Grant an extra turn (same player moves again)                  |
| Signal Ghosts     | smokeScreen   | Own riders cannot be challenged for opponent's next turn       |
| Chrome Syndicate  | reroll        | Regenerate USB Shards; extra turn to act on the new roll       |
| Voltage Vultures  | overclock     | +1 to current roll (may reach 5 for an exit); extra turn       |
| Alley Wraiths     | sideRoute     | Teleport one entry-zone rider (pos 1–4) directly to pos 13     |

---

## Rewards

| Condition                          | XP  | Ozzies |
|------------------------------------|-----|--------|
| Participation (any result)         | +50 | +10    |
| Win bonus                          | +100| +25    |
| `strike` trait present in lineup   | +15 | —      |
| `echo` trait present in lineup     | +10 | —      |
| `crowdHalo` faction passive        | +10 | —      |
| `crowdRoar` support activated      | +10 | —      |

Rewards are calculated and applied server-side after match completion and are
guarded by the `rewardsGranted` flag for idempotency.

---

## Data model

Firestore collections:

| Collection                               | Purpose                          |
|------------------------------------------|----------------------------------|
| `jousturLineups/{uid}`                   | Saved lineup (card IDs only)     |
| `jousturChallenges/{id}`                 | Friend challenges                |
| `jousturMatches/{id}`                    | Match state                      |
| `jousturMatches/{id}/turns/{turnId}`     | Turn-by-turn log                 |
| `jousturQueue/{uid}`                     | Casual matchmaking queue         |

See `src/lib/jousturTypes.ts` for complete type definitions.

---

## Security requirements

- **Server-authoritative** — all move validation and state mutation happens on
  the server; clients never write match documents directly.
- Only the **active player** may call `/roll` or `/move`.
- Card ownership is verified before match creation.
- Reward grants are **idempotent** (guarded by `rewardsGranted`).
- Completed matches reject further turn actions.
