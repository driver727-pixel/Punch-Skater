# Punch Skater™ Streets — side-scrolling beat-em-up mode

Punch Skater™ Streets is a light, contained arcade mini-mode: a horizontally
scrolling beat-em-up in the tradition of classic side-scrolling brawlers. It is
**additive** and triggered from the Missions Map, matching how Cyber Joust is
launched as a standalone Phaser game — it is **not** a rewrite of the card-game
core. (The Vision Roadmap defers full real-time action combat to a later Sk8r
Punk™ title; this mode stays a small, mission-triggered arcade loop.)

> Terminology note: throughout this doc, "card deck" means a deck of forged
> cards (the squad roster), and "skate deck / board" means the skateboard the
> character rides. Streets uses **card decks** to source fighters.

## Where it lives

The game is a self-contained static Phaser app served at `/streets/`, mirroring
the `public/cyber-joust/` pattern. It is **not** a React route and is **not**
bundled by Vite — `public/` is copied verbatim into `dist/`.

| File | Role |
| --- | --- |
| `public/streets/index.html` | HTML shell + CSP + import map (Phaser via CDN) |
| `public/streets/streetsConfig.js` | Pure config: missions, districts, objectives, stat mapping, URL parsing |
| `public/streets/main.js` | BootScene: asset loading (reuses cyber-joust audio + sprite manifest) |
| `public/streets/menuScene.js` | Mission briefing / free-play picker |
| `public/streets/gameScene.js` | The beat-em-up: scrolling stage, wave gates, combat, objectives, results |
| `public/streets/skaterFactory.js` | Shared fighter visuals (vector fallback + sprite support) |

Sprite and audio assets are **reused** from `public/cyber-joust/assets/` and the
`fighterSprites.js` helpers, so the card→sprite pipeline carries over for free.

## Cards power the fighters

Forged cards from your **card decks** (e.g. the admin "Garibaldi's Crew" deck)
supply both the player fighter and the enemy roster. `mapStatsToFighter()` in
`streetsConfig.js` maps card numbers onto gameplay knobs:

| Card stat | Gameplay effect |
| --- | --- |
| `grit` | Max HP + attack damage |
| `speed` | Move speed + acceleration |
| `joust.lance` | Attack reach (lance length) |
| `joust.shield` | Damage resistance + hit-recovery |
| `joust.hype` | Special ("nova") meter charge rate |
| `stealth` | Dash distance |
| `range` | Jump strength |

Cosmetics (`colorName`, `weapon`, `characterImageUrl`) drive the pixel sprite;
when no dedicated pixel sprite is available the factory draws a vector skater so
the mode always works. Weapons match the existing canon set (Hockey Stick,
Street Sign, Crutch Lance).

## Objectives

Three objective types (`STREETS_OBJECTIVES`):

- **fight_through** — clear every enemy wave and reach the exit.
- **retrieve** — grab a package mid-stage and carry it to the exit.
- **escape** — survive a horde and reach the exit grind-rail.

Wave "gates" lock the camera until the current wave is cleared (the classic
arcade brawler rhythm), then the camera unlocks and the stage scrolls on.

## Mission Map wiring

Streets brawls are attached to specific lore contracts via a new
`streetsEncounter` field on the mission definition (`server/lib/missions.js`),
built by `buildStreetsEncounter()` in `server/lib/missionEncounterDefinitions.js`.

- The encounter surfaces through the **existing** checkpoint encounter path
  (`pickCheckpointEncounter`) — but only for contracts that define a
  `streetsEncounter`, so the encounter distribution of every other contract is
  unchanged.
- The Missions UI (`EncounterOverlay` in `src/pages/Missions.tsx`) renders an
  **▶ Enter the Streets** launch button for `encounterType: "streets"` options.
  It opens `/streets/?...` with the chosen card's stats/cosmetics and a
  same-origin `returnTo`. When mission-world visuals are available, the launch
  also passes the fal.ai-generated map backdrop as `levelBackdrop` plus a
  deterministic `levelSeed`.
- On win/lose the game returns to `/missions?streetsResult=win|lose&...`; the
  page resolves the encounter through the standard `POST
  /api/missions/world/encounter` flow:
  - **win** → the `enter-streets` option (full XP/Ozzies reward).
  - **lose** → the hidden `streets-down` option (small consolation, no card
    fallout — failure is interesting, not punishing).
  - **skip** → the visible `skip-streets` option (route around the brawl).

No new economy is introduced; rewards flow into the existing mission rewards.

## Seeded lore missions

| Mission | District skin | Objective | Lore hook |
| --- | --- | --- | --- |
| **Nightshade Run** | Nightshade laneways | escape | "Nobody owns Nightshade." |
| **Never Open the Package** | Batteryville rail scaffolds | retrieve | The Code: "Never open the package." |
| **Broomstick First** | Airaway checkpoint | fight_through | "UCA white bikes are enemy symbols — broomstick first." (duel Mina Chrome) |
| **Transit Is a Battlefield** | The Roads straightaways | fight_through | Nullarbor-straightaway Road Runner ambush |
| **A Million Screens, Zero Witnesses** | Glass City neon | retrieve | Out-skate Nova Saint's highlight-reel ambush |

Each launch now gets a deterministic procedural stage profile from `levelSeed`.
The seed varies stage length, final-wave pressure, parallax details, signage,
rails, and foreground props. If fal.ai visuals are configured on the server, the
existing mission-world backdrop generation is reused as a stylized Streets
background layer; otherwise the Phaser scene falls back to generated vector
district art.

## Feature flag

Gated by the `STREETS` feature flag (`VITE_FF_STREETS`, default on). The Arena
page shows a Streets CTA when enabled.
