# Player Progression Model

> Punch Skater progression design — the authoritative reference for XP, Points,
> Deck Power, Ozzies, upgrade tiers, missions, and leaderboard scoring.
>
> Code references: `src/lib/progression.ts` (client) · `server/lib/progression.js` (server)

---

## Core Design Principle

> XP shows what you have done.
> Points show what your cards can do.
> Deck Power shows how strong your Crew is.
> Ozzies show how valuable and respected your collection is.

No pay-to-win. Progression comes from play.

---

## The Crew

A player's active **Crew** is exactly **6 Punch Skater cards** chosen from their
collection and given a player-defined name.

- The deck IS the Crew — the terms are interchangeable in code; "Crew" is the
  preferred player-facing term.
- A player builds a collection first, then selects their best 6 for the active Crew.
- On signup, the player receives **one bonus Rare card** to start their collection
  (`SIGNUP_BONUS_RARITY = "Rare"` in `progression.ts`).

### How cards are collected

| Source | Notes |
|---|---|
| Signup bonus | 1 × Rare card on account creation |
| Daily login streak | Escalating rewards via the streak system |
| Missions | Complete district contracts to earn cards |
| Trades | Peer-to-peer offers and Community Market |
| Battles | Win arena battles to boost stats |
| Leaderboard rewards | Top accounts receive bonus cards / Ozzies |

---

## XP

XP measures experience earned by a card through gameplay.

- Belongs to individual cards (and summarised across the Crew as **Crew XP**).
- Starts at `0`.
- Maximum: **100,000,000** per card (`MAX_CARD_XP`).
- Earned from: missions, battles, login streaks, and events.
- XP represents what a card has _done_, not raw stat strength.

```
Card XP: 24,500 — completing several missions.
Crew XP: 87,200 — combined XP across the active 6-card Crew.
```

---

## Points

Points are the individual **stat numbers** on each card.

Current stat dimensions:

| Stat | Meaning |
|---|---|
| Speed | Escape, race, delivery, and chase missions |
| Range | Battery range, travel distance, district access |
| Stealth | Avoiding detection, covert routes |
| Grit | Toughness, endurance, component survival |

Points can go **up or down** through:
- Upgrades and rarity class advancement
- Mission rewards (stat increases for success)
- Mission penalties (stat damage on failure — e.g. -10 Range for a Roads failure)
- Battle wagers (both sides stake points; the winner claims both wagers)
- Board component bonuses

---

## Deck Power

Deck Power is the **combined Points of all stats on all 6 Crew cards**.

```
Deck Power = sum of all stat values across all 6 active Crew cards
```

Example with current 1–10 stat scale:

```
Card 1: Speed 8 + Range 6 + Stealth 7 + Grit 5 = 26
Card 2: Speed 7 + Range 8 + Stealth 6 + Grit 6 = 27
...
Deck Power = sum of all six cards
```

### Deck Power cap

| Target | Value | Notes |
|---|---|---|
| Long-term design target | 10,000 | `MAX_DECK_POWER_TARGET` — aspirational, for future stat scaling |
| Current architectural max | 240 | 6 cards × 4 stats × max 10 — with the 1–10 stat scale |

The 10,000 target is the balancing cap referenced in docs and UI copy. It will
apply when the stat ceiling is raised in a future sprint. It does **not**
hard-break existing cards.

### Upgrade thresholds (Deck Power)

Once the active Crew reaches a Deck Power threshold, the corresponding forge
rarity tier becomes available:

| Tier | Deck Power Required | Notes |
|---|---:|---|
| Apprentice | 1,000 | Early progression |
| Master | 2,500 | Mid-game |
| Rare | 5,000 | Serious commitment |
| Legendary eligibility | 8,500+ | Cannot forge directly — earn only |

> **Legendary cannot be forged.** It can only be earned through gameplay,
> special missions, achievements, events, or leaderboard rewards.

Thresholds also unlock via mission XP and Ozzies (see `FORGE_CLASS_RULES` in
`cardClassProgression.ts`). A player meets the requirement for a tier by
satisfying **any one** of the three criteria.

---

## Ozzies

Ozzies represent the **earned cultural and world value** of a player's
collection and Crew in Sk8rpunk.

### Card Ozzies

Each card is assigned a **randomly seeded base Ozzy value** at forge time,
determined by rarity:

| Rarity | Ozzy Range |
|---|---|
| Punch Skater | 5 – 50 |
| Apprentice | 25 – 100 |
| Master | 75 – 200 |
| Rare | 150 – 500 |
| Legendary | 500 – 2,000 |

Missions, special events, and achievements can reward additional Ozzies to
specific cards.

### Account and Crew Ozzies

```
Account Ozzies = sum of Ozzy values across ALL cards in the collection
Crew Ozzies    = sum of Ozzy values across the active 6-card Crew
```

Both values are computed on the client; no separate Firestore document is
needed — they are derived from card data.

---

## Missions and Districts

Missions are district-based contracts that Crews run for risk/reward.

### Rewards (on success)

- XP — added to participating Crew cards
- Stat increase — Points added to specific stats
- Ozzies — added to card/Crew/account value
- Cards — new cards added to collection
- Components — board part rewards
- District reputation / standing

### Risks (on failure)

- Stat damage — e.g. `-10 Range` on 1–2 Crew cards for a Roads failure
- Component damage — requires repair cooldown
- Card lockout — temporary card unavailability
- Jail time — district-specific narrative lockout
- Event lockout — timed lockout from specific events

### District profiles

| District | Primary Stat | Theme | Example Risk |
|---|---|---|---|
| Airaway | Stealth | Aerial routes, hidden paths | Fall damage → Speed reduction |
| Batteryville | Grit | Tech, batteries, energy | Component burnout → repair cooldown |
| The Roads | Range | Street travel, territory | -10 Range on mission failure |
| Nightshade | Stealth | Shadow routes, covert ops | Card impound event |
| The Grid | Speed | Surveillance, tech | Trace event → lockout |
| The Forest | Grit | Rough terrain, salvage | Grit damage from rough routes |

Full district risk/reward profiles are defined in `DISTRICT_RISK_REWARD_PROFILES`
in `progression.ts`.

---

## Component Upgrade Rules

Board components can only be **upgraded within their rarity class**.

```
✅ Common Battery → Common Battery +1 → Common Battery +2
❌ Common Battery → Rare Battery  (not allowed via upgrade)
```

To obtain a higher-class component, it must be **earned, traded, or rewarded**.

This rule prevents infinite power escalation and is defined in
`COMPONENT_UPGRADE_RULES` in `progression.ts`.

---

## Leaderboard

The leaderboard ranks players' active Crews on a **combined score**:

```
Leaderboard Score = Deck Power + Crew Ozzies + (Crew XP / 10,000) + district reputation
```

Crew XP is divided by 10,000 so a fully maxed card (100,000,000 XP) contributes
only 10,000 to the score — preventing XP from dominating.

### Leaderboard categories

| Category | Field | Description |
|---|---|---|
| Combined | `leaderboardScore` | Weighted composite (primary ranking) |
| Deck Power | `deckPower` | Raw Crew stat strength |
| Crew Ozzies | `crewOzzies` | Total Ozzy value of the active 6-card Crew |
| Crew XP | `crewXp` | Total XP earned by all Crew cards |
| Legacy worth | `ozzies` | Backward-compatible stat-based worth |

### Leaderboard rewards

Top accounts on the leaderboard receive bonus cards, Ozzies, and special
rewards — further incentivising competitive play.

---

## Collection Acquisition Summary

| Activity | XP | Points | Ozzies | Cards |
|---|---|---|---|---|
| Signup | — | — | — | +1 Rare |
| Daily login streak | ✅ | — | ✅ | Milestones |
| Mission success | ✅ | ✅ | ✅ | Occasionally |
| Mission failure | — | ⬇️ risk | — | — |
| Battle win | ✅ | ✅ | — | — |
| Battle loss | ✅ small | ⬇️ wager | — | — |
| Trade | — | — | Transferred | ✅ |
| Leaderboard reward | ✅ | — | ✅ | ✅ |

---

## Code Locations

| Concern | File |
|---|---|
| All progression constants + helpers | `src/lib/progression.ts` |
| Server-side progression helpers | `server/lib/progression.js` |
| Forge unlock rules (Deck Power thresholds) | `src/lib/cardClassProgression.ts` |
| Card XP + Ozzies fields | `src/lib/types.ts` (`CardPayload`) |
| Leaderboard entry fields | `src/lib/types.ts` (`LeaderboardEntry`) |
| Deck stats UI (Crew Ozzies, Crew XP) | `src/components/DeckStatsPanel.tsx` |
| Leaderboard upload | `src/hooks/useLeaderboard.ts` |
| Mission risk/reward types | `src/lib/sharedTypes.ts` |
| Mission templates | `src/lib/missions.ts` |
| Progression server tests | `server/test/progression.test.js` |
