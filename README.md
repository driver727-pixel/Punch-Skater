# Punch Skater

A dense cyberpunk courier card game built with React, TypeScript, Vite, Firebase, and a small Express proxy for paid APIs.

## Current Stack

- React 18
- TypeScript 5
- Vite 6
- React Router 7
- Firebase Auth + Firestore
- Express proxy for Fal.ai, Stripe, admin, and weather endpoints
- Playwright for end-to-end coverage

## Core Game Systems

- **Card Forge** — deterministic card generation, layered art, factions, referrals, and monetized forge access
- **Collection** — saved cards in Firestore for signed-in users, local storage for guests
- **Deck Builder** — up to 6 cards per deck with persistent deck sync
- **Missions** — district map, mission branches, and live weather restrictions
- **Trades + Leaderboard** — direct offers, market listings, and public deck rankings
- **Battle Arena** — public scouting summaries, real opponent deck snapshots, persistent results, and stat resolution syncing for both players

## Environment

Copy `.env.example` to `.env` for local client config.

### Client variables

- `VITE_FIREBASE_*`
- `VITE_IMAGE_API_URL`
- `VITE_CHECKOUT_API_URL`
- `VITE_ADMIN_API_URL`
- `VITE_DISTRICT_WEATHER_API_URL`

### Server-only variables

- `FAL_KEY`
- `FAL_IMAGE_MODEL_URL` (optional; defaults to `https://fal.run/fal-ai/flux-lora`)
- `FAL_LORA_PATH` (optional; server-side default LoRA path)
- `FAL_LORA_SCALE` (optional; server-side default LoRA scale)
- `STRIPE_SECRET_KEY`
- `FIREBASE_API_KEY`
- `ADMIN_EMAILS`

Do not commit server secrets.

## Local Development

```bash
cd /path/to/Punch-Skater
npm install

# terminal 1
FAL_KEY=your_key_here npm start

# terminal 2
npm run dev
```

## Validation

```bash
cd /path/to/Punch-Skater
npm install
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

## Launch Asset Checklist

### Required before launch

- [ ] Upload and register all rarity frame files in `/home/runner/work/Punch-Skater/Punch-Skater/public/assets/frames/`
- [ ] Audit district backgrounds so each live forge district has both print and small variants
- [ ] Review card/share/download flows and replace remaining generated stable layers with static assets where possible

### Future content decisions already locked

- [ ] Keep Electropolis as a lore/mission reveal only until its later playable rollout
- [ ] Treat The Roads as a corridor gameplay layer where route events spawn, not as a forgeable district or standalone mission

### Nice-to-have immersion uploads

- [ ] District ambience loops
- [ ] Mission success / failure / fork-choice audio
- [ ] Battle queue / draw / result audio
- [ ] Trade sent / accepted / declined audio
- [ ] Launch promo / social share art

## Known Follow-Ups

- The retired BoardComposite pipeline should stay out of the live card flow unless it is deliberately rebuilt from scratch later.
- Electropolis stays non-forgeable for now, while The Roads remain a separate route-event layer rather than a district selector.
