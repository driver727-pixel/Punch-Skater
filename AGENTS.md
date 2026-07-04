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

- The app runs with **no secrets** in **guest mode**: Firebase auth, Fal.ai image
  generation, and Stripe checkout are unavailable but the Card Forge builder is
  fully interactive. As a guest, clicking "Forge Card" opens the "Choose your
  tier" upgrade modal instead of minting a card (expected, not a bug).
- When the documented secrets are present (see `.env.example`) the server reads
  them straight from `process.env` and Vite exposes the `VITE_*` ones, so **no
  `.env` file is required** — a session where the secrets are injected as real
  environment variables just works. The server startup warnings about missing
  `FAL_KEY` / `STRIPE_*` / Firebase Admin disappear when they are set.
- Non-secret client gate: **in-app image generation only turns on when
  `VITE_IMAGE_API_URL=/api/generate-image` is set** (see `README.md` local-dev
  section and `src/services/imageGen.ts` `isImageGenConfigured`). This is config,
  not a secret, so it is NOT auto-injected — set it (e.g. in a local `.env`) if
  you need the forge to render AI art. Vite proxies `/api/*` to the server.
- `FIREBASE_SERVICE_ACCOUNT_JSON` is multi-line JSON. If you put it in a local
  `.env` (which the server's `dotenv` reads), base64-encode it onto one line —
  the loader in `server/lib/firebaseAdmin.js` accepts base64. Injected env vars
  don't have this problem.
- Verified end-to-end with real secrets: Email/Password sign-in, forging a card,
  and Fal image generation (which uploads the result to Firebase Storage) all
  work. Note: **saving a forged card to the Collection is gated behind a paid
  tier** — a free-tier signed-in user can forge but sees an "upgrade to save"
  paywall. That is product behavior, not a setup problem.

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
