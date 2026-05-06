# Jousting Lite — Design

> Punch Skater jousting design — the authoritative reference for the
> **lance-and-shield, card-based, cyberpunk Australian** joust mechanic.
>
> Companion to: `PUNCH_SKATER_VISION_ROADMAP.md` (Phases 2–4) and
> `docs/PROGRESSION.md` (XP, Points, Ozzies, Deck Power, missions).

---

## Design Pillars

Jousting Lite is the unique identity hook for Punch Skater. It must stay
**simple, card-based, cyberpunk, Australian, lance-and-shield focused, and
expandable** — and it must **not** become full real-time combat in this game.

| Pillar | What it means | What it forbids |
|---|---|---|
| Simple | A joust resolves in a handful of clicks: pick crew, pick tactic, see outcome. | Multi-screen ceremonies, deep stat math the player has to do in their head. |
| Card-based | Every input is a card or a card stat — skater cards, lance cards, shield cards, tactic cards. | Twitch inputs, aim mechanics, hitboxes. |
| Cyberpunk | Neon, glitch, signal jamming, corp logos, underground feel. | Sci-fi space opera, generic medieval fantasy. |
| Australian | Outback-cyberpunk slang, dust-and-neon districts, larrikin rivals, Aussie place-name flavour. | American mall-skater tone, UK grime tone, generic English. |
| Lance & shield | The two signature weapon stats. Every joust is read as **Lance vs Shield**. | Guns, magic, vehicles-as-weapons. |
| Expandable | Engine, data shapes, and UI leave room for rivals, bosses, async PvP, packs. | Hard-coding outcomes; one-off rival logic. |
| Not real-time | All resolution is turn-based card maths. | Physics rigs, real-time collisions, controller input loops. |

If a future change breaks one of these pillars, it belongs in a different
Sk8r Punk game, not in Punch Skater.

---

## Vocabulary

| Term | Meaning |
|---|---|
| **Joust** | A single lance-and-shield encounter resolved in one round. |
| **Joust Encounter** | A joust embedded in a mission, race, or rival ladder step. |
| **Lance** | The card's offensive stat (and its associated weapon gear/art). |
| **Shield** | The card's defensive stat (and its associated guard gear/art). |
| **Tactic** | The player's chosen approach for the round (Charge, Guard, Feint, Counter, Boost, Trick Strike). |
| **Rival** | A named NPC skater that owns a joust ladder in a district. |
| **Boss Joust** | The capstone joust at the end of a district ladder. |
| **Strike** | The numeric result of a single joust round. Positive = player wins, negative = rival wins. |

---

## Where Jousting Lives in the Loop

```
Forge → Crew → Mission/Race/Joust → Reward → Upgrade/Trade → Unlock → Flex
                          ▲
                          └── Joust Encounters slot in here, never replace the loop
```

A joust is **always entered from a mission, race, or rival ladder** — never as a
standalone always-on PvP arena (that is reserved for a later phase). This keeps
jousting in service of the existing Crew + Mission progression in
`docs/PROGRESSION.md`, rather than forking the game.

---

## Card Inputs

A joust reads only data already present (or planned in Phase 2) on the card.

### Skater card stats used by a joust

| Stat | Role in joust | Source |
|---|---|---|
| Lance | Primary attack value | Card stat |
| Shield | Primary defence value | Card stat |
| Speed | Initiative; tie-breaks ties; unlocks Boost tactic | Existing stat |
| Grit | Soak; reduces incoming Strike damage | Existing stat |
| Stealth | Enables Feint tactic; modifier on counter rolls | Existing stat |
| Range | Determines if a joust can even occur in a given district | Existing stat |
| Style / Hype | Multiplies Ozzy reward on flashy wins | Phase 2 stat |

### Gear identity (visual + small modifier)

- **Lance type** — heavy, kinetic, glitch, signal, neon, bone-blade.
- **Shield type** — riot, magnetic, mirror, scrap, banner, holo.
- **Board type** — already on card; can grant joust-relevant traits (e.g. a
  surf-skate's tighter turning helps Feint).
- **Armor / style tag** — purely flavour + small Style/Hype contribution.

### Traits (sample, not exhaustive)

`Boost Charge`, `Street Parry`, `Magnetic Guard`, `Heavy Lance`, `Riot Shield`,
`Neon Flourish`. Each trait grants **one** small, named modifier in a joust
(e.g. `Heavy Lance: +2 Lance, -1 Speed on Charge`). Traits stack additively.

**Rule:** every trait must fit on one line of card text. If it needs a
paragraph, it is too complex for Jousting Lite.

---

## The Round

A joust is one round, resolved in this order:

1. **Match-up** — system picks one Crew card to ride this round (player choice
   when entering a joust encounter; defaults to the highest-Lance card).
2. **Tactic select** — player picks one of six tactics (see below).
3. **Rival reveal** — rival's tactic is shown.
4. **Resolve** — Strike value is computed.
5. **Outcome** — narrative line + reward/penalty applied.

Multi-round duels are an **expansion hook**, not part of the lite spec. See
"Expansion Hooks" below.

### Tactics

The six tactics map cleanly to a rock-paper-scissors-plus-stat read so the
player has both a *gut* call and a *stat* call.

| Tactic | Beats | Loses to | Stat lean |
|---|---|---|---|
| **Charge** | Feint | Counter | Lance + Speed |
| **Guard** | Charge | Trick Strike | Shield + Grit |
| **Feint** | Counter, Guard | Charge | Stealth + Speed |
| **Counter** | Charge, Boost | Feint | Shield + Lance |
| **Boost** | Guard | Counter | Speed |
| **Trick Strike** | Guard, Boost | Counter | Style/Hype + Lance |

Notes:
- Only one tactic is chosen per joust.
- "Beats" applies a **+2 advantage** to Strike. "Loses to" applies **-2**.
- Mirror match (same tactic on both sides) is neutral; resolve on raw stats.

### Strike formula

```
strike = (playerLance + tacticLanceMod + traitMods)
       - (rivalShield  + rivalTacticShieldMod)
       + advantage     // +2, 0, or -2 from the tactic table
       + speedTieBreak // +1 if player Speed > rival Speed
       + rng(-1..+1)   // limited randomness; never the deciding factor alone
```

- `strike > 0` — player wins the joust.
- `strike == 0` — draw; resolve as a small consolation reward, no penalty.
- `strike < 0` — rival wins the joust.

The randomness window is intentionally **±1** so a well-built crew with a
matched tactic almost always wins, but a slightly weaker crew can still steal
a joust on a good read. This is what keeps it card-based, not coin-flip.

### Difficulty bands

Each joust encounter has a **difficulty** (`easy`, `standard`, `hard`,
`boss`) which adjusts rival Lance/Shield baselines and tactic AI. Boss
jousts also get one signature trait (e.g. Mina Chrome's `Magnetic Guard`).

---

## Rewards and Failure

Aligned with `docs/PROGRESSION.md` so jousts feed the same XP/Points/Ozzies/
Deck Power economy.

### On win

- **XP** to the riding card (and a smaller share to the Crew).
- **Points** — small stat increase, biased toward the tactic used (e.g. a
  Charge win nudges Lance).
- **Ozzies** scaled by Style/Hype and difficulty.
- **Card pack chance** on hard and boss jousts.
- **Lore unlock** — codex entry for the rival or district.
- **Rival ladder progress** — one step closer to the boss joust.

### On loss

Failure is **interesting, not punishing** (per Phase 3 of the roadmap).

- Small **repair cost** on the lance or shield gear (cooldown, not deletion).
- **Battery damage** — temporary Range reduction on the riding card.
- **Consolation XP** so a loss still teaches.
- Small chance to **discover a glitch variant** — a flavoured re-roll seed
  that can be used in the forge later.

No card destruction, no permanent stat loss, no Ozzy theft. Punch Skater is
collection-positive.

### On draw

Tiny XP, no penalty, no progress. Encourages the player to commit to a tactic
next time.

---

## Cyberpunk Australian Voice

This is the flavour layer. It is mandatory — without it, the joust is generic.

- Districts read as **outback-cyberpunk**: rusted solar farms, neon roadhouses,
  servo signs glitched into corp ads, dust storms over Brisbane-equivalents.
- Rival names lean **larrikin** and **scene**: Jax Voltage, Mina Chrome, Rook
  Wraith, Vex Static, Nova Saint (already in the roadmap).
- Tactic flavour text uses Aussie cadence:
  - Charge — *"Send it."*
  - Guard — *"Hold the line, mate."*
  - Feint — *"Dodgy as."*
  - Counter — *"Have a crack."*
  - Boost — *"Full noise."*
  - Trick Strike — *"Showpony."*
- Win/loss lines are short, punchy, and never mean-spirited. No slurs, no
  bogan punching-down humour.
- Place-name and faction flavour stays consistent with `src/lib/lore.ts` and
  district docs; do not invent parallel canon inside the joust UI.

---

## Mission Integration

Joust encounters are added as a **step type** inside the existing mission
structure (`src/lib/missions.ts` / `server/lib/missions.js`).

- A mission template can declare one or more `joust` steps.
- A joust step references a `rivalId` (from the rival catalogue) and a
  difficulty band.
- The mission run (already persisted via `mission.activeRun`) records the
  joust outcome alongside the existing step outcomes.
- Counter-option resolution (`selectedCounterOptionId`) is reused for the
  tactic selection so we don't fork the run state machine.

District ladders (Phase 4) are just ordered lists of missions whose final
step is a `boss` joust against the district rival.

---

## Data Shapes (sketch only)

These are **conceptual** — concrete TypeScript and Firestore shapes land in
the implementation phase and must be mirrored across `src/lib/` and
`server/lib/` per existing repo conventions.

### Card additions

```
{
  lance:  number,        // 0..10 in current scale
  shield: number,        // 0..10
  lanceType:  string,    // "heavy" | "kinetic" | "glitch" | ...
  shieldType: string,    // "riot"  | "magnetic" | "mirror" | ...
  traits: string[]       // small named modifiers
}
```

### Rival entry

```
{
  id: string,
  name: string,
  district: string,
  faction: string,
  signatureCardId: string,
  lanceType: string,
  shieldType: string,
  signatureTrait: string,
  difficulty: "easy" | "standard" | "hard" | "boss",
  unlockReward: { xp?, points?, ozzies?, cardId?, packId? }
}
```

### Joust encounter result

```
{
  encounterId: string,
  rivalId: string,
  riderCardId: string,
  tactic: "charge" | "guard" | "feint" | "counter" | "boost" | "trickStrike",
  rivalTactic: "...",
  strike: number,
  outcome: "win" | "loss" | "draw",
  rewards: { ... },
  penalties: { ... },
  lore: string[]      // unlocked codex IDs
}
```

---

## What This Spec Does **Not** Cover (yet)

These are explicit non-goals for the lite scope. They live in later phases or
in different Sk8r Punk games.

- Real-time, physics-based jousting combat.
- Aim, timing, or input-skill mechanics.
- Full PvP arena with matchmaking (async challenges arrive in Phase 7).
- Wagering Ozzies or cards on a joust outcome.
- Joust-only economies, joust-only currencies, joust-only leaderboards.
- Faction wars, alliances, or guild jousts.
- Lance/shield durability that can permanently destroy gear.

If a feature request reads as "let's make jousting deeper," check this list
first. Most "deeper" requests belong in a sibling Sk8r Punk product.

---

## Expansion Hooks

The lite design leaves clean seams to grow into without rework.

| Hook | How the lite design supports it |
|---|---|
| Multi-round duels | Strike formula already returns a number; sum across N rounds. |
| Crew-vs-Crew jousts | Riding card is already a per-round selection; iterate over a sub-Crew. |
| Async PvP (Phase 7) | Encounter result shape is self-contained; persist and replay. |
| Rival catalogue | Rival entry shape is data-driven; new rivals = new rows. |
| Boss mechanics | `signatureTrait` field is the single extension point per boss. |
| Joust packs | Reward shape already supports `packId`. |
| Codex / lore | `lore: string[]` field on results, populated from rival/district data. |
| Tactic expansion | Tactic table is data; adding tactics needs only a new row + relations. |
| Style/Hype scoring | Already factored into Strike and Ozzy reward; can grow into a separate "Crowd" meter. |

---

## Open Questions

Capture and defer — do not block the lite implementation on these.

- Should `Lance` and `Shield` be derived from gear cards (separate sub-cards)
  or live as numbers on the skater card? Current lean: **on the skater card
  for Phase 2**, with optional gear card overlays in a later phase.
- How visible should the `±1` randomness be to the player? Current lean:
  hidden, but the result line hints at it ("knife-edge", "clean read").
- Do districts modify tactic effectiveness (e.g. Nightshade boosts Feint)?
  Current lean: **yes, small ±1 district modifiers**, defined in the same
  district profiles as in `docs/PROGRESSION.md`.

---

## Code Locations (anticipated)

These files will own the implementation when Phase 3 starts. Listed here so
future work knows where to land changes; nothing is required to exist yet.

| Concern | File |
|---|---|
| Joust resolver (client) | `src/lib/joust.ts` |
| Joust resolver (server) | `server/lib/joust.js` |
| Rival catalogue | `src/lib/rivals.ts` / `server/lib/rivals.js` |
| Mission integration | `src/lib/missions.ts` / `server/lib/missions.js` |
| Joust UI component | `src/components/JoustPanel.tsx` |
| Tests | `server/test/joust.test.js` |

Per existing repo conventions, any logic added to a `src/lib/*.ts` file with a
`server/lib/*.js` mirror **must be kept in sync**, with regression tests under
`server/test/`.
