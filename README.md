# Skater Punk Deck Builder

A cyberpunk-themed card deck builder game built with React, TypeScript, and Vite.

## Features

- **Card Forge** — Generate unique courier cards by selecting archetype, rarity, style vibe, district, and accent color. Cards are deterministically generated using a seeded PRNG (Mulberry32), so the same prompt always produces the same card.
- **Collection** — Browse your saved cards in a grid view, inspect individual card details, and export your entire collection as JSON.
- **Deck Builder** — Create, rename, and delete decks. Add cards from your collection and export decks as JSON.

## Card Attributes

Each generated card includes:
- **Identity**: Name, crew, serial number
- **Stats**: Speed, Stealth, Tech, Grit, Rep (influenced by archetype and rarity)
- **Traits**: Passive trait and active ability
- **Visuals**: SVG card art with district-colored cityscape, skater courier figure, and rarity stars
- **Flavor text** and personality tags

## Tech Stack

- React 19 + TypeScript
- Vite 8
- React Router DOM v7
- LocalStorage for persistence
- No external UI libraries — pure CSS dark theme

## API Key Security — Server-Side Proxy

All AI image generation goes through a **server-side proxy** (`server/index.js`) so the
Fal.ai API key (`FAL_KEY`) is **never exposed to the browser**.

```
Browser  →  POST /api/generate-image    →  proxy (adds Authorization: Key <FAL_KEY>)  →  fal.run
Browser  →  POST /api/remove-background →  proxy (adds Authorization header)           →  fal.run
```

The proxy also enforces:
- **Rate limiting** — 20 image requests per IP per minute (prevents credit drain)
- **CORS** — restricted to the production domain and localhost

### Environment variables

Copy `.env.example` to `.env` and fill in the non-secret `VITE_*` client variables:

```bash
cp .env.example .env
```

| Variable | Where set | Purpose |
|---|---|---|
| `VITE_FIREBASE_*` | `.env` (client) | Firebase project config (public) |
| `VITE_IMAGE_API_URL` | `.env` (client) | URL of the `/api/generate-image` proxy endpoint |
| `VITE_CHECKOUT_API_URL` | `.env` (client) | URL of the `/api/create-checkout-session` endpoint |
| `FAL_KEY` | Server env only | Fal.ai secret key — **never in `.env`** |
| `STRIPE_SECRET_KEY` | Server env only | Stripe secret key — **never in `.env`** |

> **Important:** `.env` is safe for `VITE_*` prefixed variables (bundled into the client
> build and therefore public). **Secret server-side keys** (`FAL_KEY`, `STRIPE_SECRET_KEY`)
> must be set directly as environment variables on the server host (e.g. Render dashboard)
> and must **never** appear in `.env` or any committed file.

## Development

```bash
npm install

# Terminal 1 — start the proxy (requires FAL_KEY in your shell env)
FAL_KEY=your_fal_ai_key_here npm start

# Terminal 2 — start the Vite dev server (proxies /api/* to localhost:3001)
npm run dev
```

## Build

```bash
npm run build
```
