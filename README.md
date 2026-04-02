# Skater Punk Deck Builder

A cyberpunk-themed card deck builder game built with React, TypeScript, and Vite.

## Features

- **Card Forge** — Generate unique courier cards by selecting archetype, rarity, style vibe, district, and accent color. Cards are deterministically generated using a seeded PRNG (Mulberry32), so the same prompt always produces the same card.
- **Collection** — Browse your saved cards in a grid view, inspect individual card details, and export your entire collection as JSON.
- **Deck Builder** — Create, rename, and delete decks. Add cards from your collection and export decks as JSON.

## Card Attributes

Each generated card includes:
- **Identity**: Name, crew, manufacturer, serial number
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

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
