# Punch Skater Vision Roadmap

Punch Skater is the first playable game inside the broader Sk8r Punk universe. It began as a card creator, but the new direction is to make it a fun, rewarding, cyberpunk electric-skate card game built around creation, collection, crews, missions, trading, leaderboards, and jousting-lite encounters.

## North Star

**Punch Skater is a collectible Sk8r Punk card game where players create cyberpunk electric skateboard warriors, equip lances and shields, race through neon districts, win jousts, trade rare cards, uncover lore, and climb the underground leaderboard.**

Short version:

> Create your skater. Build your crew. Win the joust. Rule the neon streets.

## Product Role

Punch Skater should be the gateway into the Sk8r Punk IP. It should not contain every future game idea. It should prove the core fantasy and make players care about cards, crews, factions, districts, rivals, and reputation.

## Core Gameplay Loop

1. Create or earn a skater card.
2. Add it to a 6-card crew.
3. Run missions, races, battles, and joust encounters.
4. Earn XP, Ozzies, points, cards, packs, lore, and status.
5. Upgrade, trade, reroll, collect, and optimize the crew.
6. Beat rivals, unlock districts, and climb seasonal leaderboards.

Loop summary:

> Forge → Crew → Mission/Race/Joust → Reward → Upgrade/Trade → Unlock → Flex

## What Belongs in Punch Skater Now

Add jousting as a simple card-based mechanic because it gives the game a unique identity.

Include now:

- Lances
- Shields
- Jousting lore
- Jousting stats
- Joust mission encounters
- Rival joust bosses
- Card visuals for weapons and gear

Do not build full real-time jousting combat yet. Save that for a future Sk8r Punk game.

## What Should Wait

Save these for later or for other Sk8r Punk games:

- Full physics-based jousting combat
- Complex real-time action combat
- Casino/dice game as the main loop
- Deep gambling mechanics
- Tabletop-scale rules systems
- Large faction-war metagame

Punch Skater can later include a light dice side mode, but it should not become the center of the game until the core loop is fun.

## Phase Roadmap

### Phase 0 — Direction Lock

**Goal:** Align the existing app around one clear promise.

**Recommended model:** Opus 4.7

**Why:** This phase needs creative product direction, worldbuilding synthesis, and prioritization.

**Tasks:**

1. Update product copy to explain the new fantasy clearly.
2. Define Punch Skater as a Sk8r Punk card game.
3. Add the tagline: "Create your skater. Build your crew. Win the joust. Rule the neon streets."
4. Clarify that the player goal is to become a legendary underground Punch Skater.
5. Document what is in-scope and out-of-scope.

**Deliverables:**

- Updated product language
- In-app onboarding copy draft
- Clear player objective statement
- Scope boundaries

---

### Phase 1 — First 10 Minutes and Onboarding

**Goal:** Make new players understand what they are doing and why it matters.

**Recommended model:** Sonnet 4.6

**Why:** This is UI flow, copy placement, and implementation work that should be cost-effective.

**Tasks:**

1. Build or refine the first-time player journey:
   - Create first skater
   - Receive starter card or bonus Rare card
   - Assign or suggest a faction
   - Build first 6-card crew
   - Run first mission
   - Earn first reward
   - See next rival or district goal
2. Add a visible objective panel:
   - Current rank
   - Next unlock
   - Next mission
   - Crew power
3. Add tooltips for:
   - XP
   - Points
   - Deck Power
   - Ozzies
   - Rarity
   - Crew
4. Make the "why" clear on the home/dashboard screen.

**Deliverables:**

- First-time onboarding flow
- Dashboard objective panel
- Improved progression explanations

---

### Phase 2 — Card Identity and Joust Stats

**Goal:** Make every card feel like a playable entity, not just generated art.

**Recommended model:** GPT-5.4

**Why:** This touches data models, generation logic, balancing, and TypeScript implementation.

**Tasks:**

1. Add or refine card stats:
   - Speed
   - Range or Battery
   - Stealth or Reflex
   - Grit or Balance
   - Lance
   - Shield
   - Style or Hype
2. Add gear identity:
   - Board type
   - Lance type
   - Shield type
   - Armor/style tag
3. Add traits such as:
   - Boost Charge
   - Street Parry
   - Magnetic Guard
   - Heavy Lance
   - Riot Shield
   - Neon Flourish
4. Ensure generated cards store these values consistently.
5. Update card UI to display jousting-relevant stats without clutter.

**Deliverables:**

- Updated card schema
- Joust stats and traits
- Card UI stat display
- Backward compatibility notes for old cards

---

### Phase 3 — Simple Joust Encounters

**Goal:** Add jousting as a lightweight, fun mission event.

**Recommended model:** GPT-5.4 for logic, Sonnet 4.6 for UI polish

**Why:** Resolution logic should be accurate and testable; the UI can be built cost-effectively.

**Tasks:**

1. Create a simple joust encounter resolver.
2. Compare player card/crew stats against rival stats.
3. Let player choose a tactic:
   - Charge
   - Guard
   - Feint
   - Counter
   - Boost
   - Trick Strike
4. Resolve outcome using:
   - card stats
   - traits
   - faction bonuses
   - mission difficulty
   - limited randomness
5. Reward success with:
   - XP
   - Ozzies
   - points
   - card packs
   - lore unlocks
   - rival progress
6. Make failure interesting, not punishing:
   - small repair cost
   - battery damage
   - consolation XP
   - chance to discover a glitch variant

**Deliverables:**

- Joust encounter engine
- Joust UI component
- Mission integration
- Basic test coverage

---

### Phase 4 — Districts, Rivals, and Boss Jousts

**Goal:** Give progression a story spine.

**Recommended model:** Opus 4.7 for rival/lore design, GPT-5.4 for implementation

**Why:** Rivals need memorable creative design; progression systems need technical care.

**Tasks:**

1. Organize missions by district.
2. Add rival skaters for each district.
3. Give each rival:
   - name
   - faction
   - signature card
   - signature lance/shield style
   - personality
   - boss mechanic
   - unlock reward
4. Build a district progression ladder:
   - starter mission
   - race mission
   - joust encounter
   - lore mission
   - boss joust
5. Unlock codex entries through progress.

**Example rivals:**

- Jax Voltage — reckless boost-charge rider
- Mina Chrome — corporate shield specialist
- Rook Wraith — shortcut and feint master
- Vex Static — signal hacker and glitch duelist
- Nova Saint — style icon and crowd-control rider

**Deliverables:**

- District mission progression
- Rival data model
- Boss joust encounters
- Codex unlock hooks

---

### Phase 5 — Image Generation Control and Card Polish

**Goal:** Reduce frustration when generated images do not match expectations.

**Recommended model:** GPT-5.5 for prompt/control design, Sonnet 4.6 for implementation tasks

**Why:** Prompt reliability, image pipeline control, and user frustration are high-impact issues. Use the stronger model to design the system, then cheaper implementation for straightforward UI.

**Tasks:**

1. Add reroll mechanics:
   - full reroll
   - background reroll
   - character reroll
   - board reroll
   - gear reroll
2. Add prompt locks:
   - faction
   - board
   - lance
   - shield
   - outfit
   - color
   - background
3. Add "glitch variant" framing for unexpected outputs.
4. Add manual polish tools:
   - crop
   - frame selection
   - title edit
   - sticker/badge layer
   - rarity border
5. Reward players with daily reroll tokens or mission-earned rerolls.

**Deliverables:**

- Reroll token design
- Prompt lock UI
- Glitch variant rules
- Better generation feedback

---

### Phase 6 — Collection, Packs, and Rewards

**Goal:** Make collecting addictive and rewarding.

**Recommended model:** GPT-5.5 for economy/balance, Sonnet 4.6 for UI implementation

**Why:** Reward economies can break games if poorly balanced. Use the most careful model for reward design.

**Tasks:**

1. Add clear collection goals:
   - collect all cards from a faction
   - collect all cards from a district
   - collect rival cards
   - collect lance/shield sets
   - collect glitch variants
2. Add pack types:
   - Street Pack
   - Neon Pack
   - Faction Pack
   - Joust Pack
   - Rival Pack
   - Seasonal Pack
3. Define fair rarity odds.
4. Avoid pay-to-win.
5. Reward completion with:
   - titles
   - frames
   - badges
   - profile cosmetics
   - lore entries
   - reroll tokens

**Deliverables:**

- Collection achievements
- Pack reward structure
- Rarity/economy documentation
- UI for collection progress

---

### Phase 7 — Seasonal Leaderboards and Multiplayer Jousts

**Goal:** Make the game feel alive and competitive without making new players feel hopeless.

**Recommended model:** GPT-5.5

**Why:** Multiplayer, ranking, seasons, anti-abuse, and economy rewards are high-risk systems.

**Tasks:**

1. Add seasonal leaderboards.
2. Keep permanent lifetime stats separate from seasonal rankings.
3. Add leaderboard categories:
   - Crew Power
   - Crew XP
   - Crew Ozzies
   - Joust wins
   - Style/Hype score
   - Collection completion
4. Add asynchronous joust challenges.
5. Reward seasons with cosmetics, not overwhelming power.
6. Add anti-abuse checks around trading and leaderboard manipulation.

**Deliverables:**

- Seasonal leaderboard rules
- Reward table
- Async joust challenge flow
- Anti-abuse notes

---

### Phase 8 — Dice / Six-Card Crew Side Mode

**Goal:** Test the dice idea without replacing the core game.

**Recommended model:** Opus 4.7 for game design, GPT-5.4 for prototype implementation

**Why:** The mechanic needs creative restraint and then accurate implementation.

**Tasks:**

1. Create a side mode called something like:
   - Six Side Crew
   - Roll Pit
   - Neon Dice Trial
2. Player chooses 6 cards.
3. A roll chooses the active card for an encounter.
4. Let players influence randomness through crew construction or weighted sides.
5. Keep rewards limited until balance is proven.
6. If it is fun, preserve it as a future Sk8r Punk casino game candidate.

**Deliverables:**

- Dice side-mode prototype
- Balance notes
- Player feedback notes
- Decision: keep in Punch Skater or spin off later

## Agent Assignment Rules

| Task Type | Recommended Agent | Reason |
|---|---|---|
| Simple UI, CSS, copy placement, small React components | Sonnet 4.6 | Saves money and is suitable for routine implementation |
| Lore, rival concepts, faction identity, worldbuilding | Opus 4.7 | Best for creative synthesis and narrative direction |
| TypeScript models, schemas, resolver logic, integrations | GPT-5.4 | Strong accuracy for implementation and data consistency |
| Economy, security, multiplayer, leaderboards, image-prompt control | GPT-5.5 | Use for highest-risk systems where mistakes are expensive |

## Recommended Build Order

1. Direction lock and onboarding.
2. Card stat identity with lance/shield support.
3. Simple joust encounters inside missions.
4. District rival progression.
5. Image generation controls and rerolls.
6. Collection goals and pack rewards.
7. Seasonal leaderboard and async multiplayer jousts.
8. Dice side mode only after the core loop is fun.

## Design Warnings

- Do not make the player lose because of random generation failure.
- Do not make rarity automatically beat strategy.
- Do not make the permanent leaderboard the only goal.
- Do not overbuild full jousting combat inside Punch Skater.
- Do not make dice gambling the main game until the core identity is proven.
- Do not add more features until the first 10 minutes are understandable and fun.

## Guiding Principle

Punch Skater should make players feel like they are building their own underground neon skating legend.

The game wins when players think:

> I want one more card, one more mission, one more joust, one more trade, one more shot at becoming a legend.
