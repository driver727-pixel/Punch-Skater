# Card Frame / Border Assets

Place rarity-tier border frame images here to skip AI generation and save fal.ai credits.

## Filename Convention

| Rarity        | Filename                |
|---------------|-------------------------|
| Punch Skater  | `punch-skater.jpg`      |
| Apprentice    | `apprentice.jpg`        |
| Master        | `master.jpg`            |
| Rare          | `rare.jpg`              |
| Legendary     | `legendary.jpg`         |

## Accepted Formats

`.jpg`, `.jpeg`, `.png`, or `.webp` — use the exact filename shown above.

## Notes on Format

Frame images use **`mix-blend-mode: screen`** when composited over the card.
This means:
- The **black interior** of the frame becomes transparent at render time — the district
  background and character layer show through the centre.
- Only the **coloured/gold/silver border decoration** remains visible.

For best results the frame image should have:
- A **flat black interior** (not grey or near-black — pure #000000).
- Bright, high-contrast border artwork (gold, silver, jewel tones work well).
- Recommended size: **750 × 1050 px** (portrait 5:7).

## How to Get Images

1. **AI-generated (first time):** Click "FORGE COURIER CARD" with the desired rarity. The
   generated URL is logged to the browser console as
   `[StaticAsset] Generated frame for <Rarity>: <URL>`. Download and save it here, then
   register it in `src/services/staticAssets.ts`.

2. **Custom artwork:** Design your own border in any image editor. Export as PNG (preserves
   transparency better) or JPG, named per the table above.

## Activating a File

After placing the file, open `src/services/staticAssets.ts` and uncomment (or add) the
corresponding entry in `FRAME_ASSETS`:

```ts
const FRAME_ASSETS: Partial<Record<Rarity, string>> = {
  Apprentice:    "/assets/frames/apprentice.jpg",
  Master:        "/assets/frames/master.jpg",
  Rare:          "/assets/frames/rare.jpg",
  Legendary:     "/assets/frames/legendary.jpg",
  "Punch Skater": "/assets/frames/punch-skater.jpg",
};
```

Once registered, zero fal.ai credits are consumed for that rarity tier's frame.
