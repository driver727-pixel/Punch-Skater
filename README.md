# Punch Skater

A cyberpunk electric-skate card game built with React, TypeScript, Vite, Firebase, and a small Express proxy for paid APIs.

## Welcome to Punch Skater

Create your skater. Build your crew. Win the joust. Rule the neon streets.

Punch Skater is a collectible card game set in the Sk8r Punk universe, built around forging cyberpunk electric-skate warriors, assembling a 6-card Crew, winning mission jousts, beating district rivals, and climbing seasonal neon leaderboards.

- **What** — Forge skater cards with joust-ready identities, grow your collection, and choose your best 6 cards as your active **Crew**.
- **How** — Start with a bonus Rare card on signup, then earn more through missions, joust encounters, battles, trades, daily rewards, weekly heat, and seasonal progression.
- **Why** — Build Deck Power, chase Ozzies and XP, outplay named rivals, unlock cosmetic/status rewards, and prove your Crew belongs at the top of the underground ladder.

### Core game loop

> Forge → Crew → Mission / Race / Joust → Reward → Upgrade / Trade → Unlock → Flex

### Progression at a glance

| Axis | What it means |
|---|---|
| **XP** | What your cards have done — earned through missions, battles, and streaks |
| **Points** | What your cards can do — individual stat numbers (Speed, Range, Stealth, Grit) |
| **Deck Power** | How strong your Crew is — sum of all stat Points across all 6 active cards |
| **Ozzies** | How valuable and respected your collection is — earned Ozzy value per card |

No pay-to-win. Legendary status cannot be forged — only earned through gameplay, missions, achievements, battle pass progress, or leaderboard rewards.

See [`docs/PROGRESSION.md`](docs/PROGRESSION.md) for the full progression model.

## Current Stack

- React 18
- TypeScript 5
- Vite 6
- React Router 7
- Firebase Auth + Firestore
- Express proxy for Fal.ai, Stripe, admin, weather, and battle endpoints
- Playwright for end-to-end coverage

## Core Game Systems

- **Card Forge** — deterministic card generation, layered art, factions, charge-up access, and joust-ready card identity including lance, shield, hype, gear, and traits
- **Collection** — saved cards in Firestore for signed-in users, local storage for guests, collection rewards, and a bonus Rare card on signup
- **Crew / Deck Builder** — choose 6 cards as your active Crew, name it, optimize Deck Power, and prep it for missions, jousts, battles, and seasonal submissions
- **Missions + Joust Encounters** — server-authored district contracts, live encounter runs, counter choices, tactic-driven rival jousts, and risk/reward stat changes
- **Rivals + District Progression** — named district rivals, boss-tier rival snapshots, codex unlocks, and reputation hooks woven into mission outcomes
- **Trades + Ranked Seasons** — direct offers, market listings, lifetime Crew rankings, and a seasonal leaderboard that ranks verified 6-card Crews on submitted Deck Power
- **Battle Pass + Daily Progression** — daily login streaks, daily missions, weekly heat, and a 6-week seasonal battle pass with free and premium reward tracks
- **Battle Arena** — public scouting summaries, real opponent deck snapshots, persistent results, and stat resolution syncing for both players
- **CraftLingua Codex** — district language library, account-linked share codes, forge profile uploads, and Rare/Legendary conlang flavor text

## Environment

Copy `.env.example` to `.env` for local client config.

### Client variables

- `VITE_FIREBASE_*`
- `VITE_IMAGE_API_URL`
- `VITE_CHECKOUT_API_URL`
- `VITE_AUTH_SYNC_API_URL`
- `VITE_ADMIN_API_URL`
- `VITE_BATTLE_API_URL`
- `VITE_DISTRICT_WEATHER_API_URL`
- `VITE_CRAFTLINGUA_DISTRICTS_API_URL`
- `VITE_CRAFTLINGUA_TRANSLATE_API_URL`
- `VITE_CRAFTLINGUA_RESOLVE_API_URL`

### Server-only variables

- `FAL_KEY`
- `FAL_IMAGE_MODEL_URL` (optional; defaults to `https://fal.run/fal-ai/flux-lora`)
- `FAL_CONFIG_URL` (optional; remote JSON defaults for Fal image requests)
- `FAL_LORA_PATH` (optional; server-side default LoRA path)
- `FAL_LORA_SCALE` (optional; server-side default LoRA scale)
- `FAL_CHARACTER_IMAGE_MODEL_URL` (optional; defaults to `https://fal.run/fal-ai/flux-2/lora`)
- `FAL_CHARACTER_CONFIG_URL` (optional; remote JSON defaults for character image requests)
- `FAL_CHARACTER_LORA_PATH` (optional; server-side default character LoRA path)
- `FAL_CHARACTER_LORA_SCALE` (optional; server-side default character LoRA scale)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_EMAILS`
- `APP_ORIGINS` (optional; extra CORS / checkout redirect origins)
- `REDIS_URL` (optional; enables shared Redis-backed rate limiting)
- `PUNCHSKATER_PARTNER_KEY` (reserved for CraftLingua partner integrations; keep server-only)
- `FIREBASE_SERVICE_ACCOUNT_JSON` or (`FIREBASE_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`), or platform-provided application default credentials

Do not commit server secrets.

## Local Development

```bash
cd /path/to/Punch-Skater
npm install

# terminal 1
FAL_KEY=your_key_here STRIPE_WEBHOOK_SECRET=whsec_... npm start

# terminal 2
npm run dev
```

## Validation

```bash
cd /path/to/Punch-Skater
npm install
npm run lint
npm run build
WEBP_QUALITY=72 npm run optimize:assets   # optional: generate .webp siblings for public/assets
npx playwright install chromium
npm run test:e2e
```

## Security Notes

- The Express API is intentionally hardened for API-only hosting. If you ever serve the SPA from the same origin, expand the CSP `connectSrc` allow-list first so Firebase, Stripe, and Fal requests continue to work.
- Fal image-generation, board-generation, and background-removal routes now require an authenticated Firebase user plus Firebase Admin credentials on the server.
- Stripe checkout redirects are restricted to approved app origins, and webhook delivery should be configured for `/api/stripe/webhook`.
- Admin access is now enforced via Firebase custom claims, with `userLookup` providing the minimal public directory used for trade lookups.

## Prompt Surface Inventory

### Current image-prompt map

- `src/pages/CardForge.tsx`
  - Orchestrates the live forge
  - Builds the background, character, frame, and board prompt strings
- `src/lib/promptBuilder.ts`
  - Owns `buildCharacterPrompt`, `buildBackgroundPrompt`, `buildFramePrompt`
  - Also retains `buildCardBackPrompt` and `buildImagePrompt` as dormant legacy/fallback builders
- `src/lib/boardBuilder.ts`
  - Owns `buildBoardImagePrompt`
- `src/services/imageGen.ts`
  - Appends the mandatory positive suffix and negative prompt to every generated image request
- `src/services/staticAssets.ts`
  - Short-circuits district backgrounds and rarity frames to uploaded files before Firestore cache or fal.ai generation is attempted

### Prompt set that matters in normal runtime

- Active prompts
  - Character prompt
  - Board prompt
  - Global mandatory safety suffix / negative prompt
- Fallback-only prompts for the current shipped catalog
  - District / background prompt
  - Border / frame prompt
- Dormant legacy prompts
  - Combined card prompt
  - Card-back prompt

### District and frame prompt status

All current forge districts and all current rarity tiers are registered to static assets, so the live forge does not normally need district or frame prompts anymore. Those prompt builders remain in the codebase only as fallback support for missing assets, future districts / rarities, or emergency regeneration.

## Launch Asset Checklist

### Required before launch

- [ ] Upload and register all rarity frame files in `/home/runner/work/Punch-Skater/Punch-Skater/public/assets/frames/`
- [ ] Audit district backgrounds so each live forge district has both print and small variants
- [ ] Review card/share/download flows and replace remaining generated stable layers with static assets where possible

### Future content decisions already locked

- [ ] Treat The Roads as a corridor gameplay layer where route events spawn, not as a forgeable district or standalone mission

### Nice-to-have immersion uploads

- [ ] District ambience loops
- [ ] Mission success / failure / fork-choice audio
- [ ] Battle queue / draw / result audio
- [ ] Trade sent / accepted / declined audio
- [ ] Launch promo / social share art

## Known Follow-Ups

- The retired BoardComposite pipeline should stay out of the live card flow unless it is deliberately rebuilt from scratch later.
- The Roads remain a separate route-event layer rather than a district selector.
