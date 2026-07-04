# AGENTS.md

## Cursor Cloud specific instructions

Punch Skater™ is a Vite + React 18 + TypeScript single-page app (the "Card Forge"
game client) backed by a small Express API proxy in `server/`. Standard commands
live in `package.json` `scripts` and `README.md` (`## Local Development` /
`## Validation`). Notes below are the non-obvious bits for running it here.

### Services

- **Vite dev client** — `npm run dev` on `http://localhost:5173`. Vite proxies
  `/api/*` to the Express server on port 3001 (see `vite.config.ts`), so start
  the API too if you exercise API-backed flows.
- **Express API proxy** — `npm start` on port 3001 (`server/index.js`). It boots
  fine with no secrets: it just logs warnings for missing `FAL_KEY`,
  `STRIPE_*`, and Firebase Admin creds, and those features degrade gracefully.

### Secrets / degraded mode (important)

- No secrets are required to run and demo the app. Without them the app runs in
  **guest mode**: Firebase auth, Fal.ai image generation, and Stripe checkout are
  unavailable but the Card Forge builder is fully interactive.
- Because there is no Firebase config, you **cannot complete a login or actually
  save a forged card**. Clicking "Forge Card" as a guest opens the "Choose your
  tier" upgrade modal instead of minting a card (this is expected, not a bug).
  To exercise auth/forge/Stripe end-to-end, provide `VITE_FIREBASE_*` client
  vars plus server secrets (`FAL_KEY`, `STRIPE_SECRET_KEY`,
  `FIREBASE_SERVICE_ACCOUNT_JSON`, etc.) documented in `.env.example`.

### Known non-blocking gotchas

- `npm run dev` prints a dependency-scan error: `phaser` and `@instantdb/core`
  "imported but could not be resolved" from `public/streets/gameScene.js` and
  `legacy-cyber-joust/gameScene.js`. These are standalone/legacy game-scene files
  that are **not** part of the main React app; the dev server still starts and
  the SPA serves normally. Ignore unless working on those specific files.
- `npm run lint` currently reports pre-existing `react-hooks/rules-of-hooks`
  errors in `src/components/LanguageProfilePanel.tsx` on a clean checkout. These
  are not caused by environment setup.
- Several Playwright `smoke.spec.ts` cases fail on a clean checkout because a
  `forge-objective-overlay` / welcome modal intercepts clicks; this is
  pre-existing test/UI drift, not an environment problem. The suite still runs.

### Testing

- Server unit tests: `npm run test:server` (Node's built-in test runner, no
  secrets needed — all pass).
- E2E: `npx playwright install chromium` once, then `npm run test:e2e`. The
  Playwright `webServer` builds and runs `npm run preview` on port 4173
  (separate from the dev server), so you don't need `npm run dev` running for it.
