# Card Frame / Border Assets

Place rarity-tier border frame images here for the legacy raster frame fallback.

The live app now prefers the built-in SVG cable borders for Punch Skater™, Apprentice,
Master, Rare, and Legendary. These files are only used when older saved cards still
reference the registered PNG overlay paths.

## Filename Convention

| Rarity        | Filename                |
|---------------|-------------------------|
| Punch Skater™  | `punch-skater.webp`      |
| Apprentice    | `apprentice.webp`        |
| Master        | `master.webp`            |
| Rare          | `rare.webp`              |
| Legendary     | `legendary.webp`         |

## Accepted Formats

`.jpg`, `.jpeg`, `.png`, or `.webp` — use the exact filename shown above.

## Notes on Format

Registered static frame images are treated as **true transparent overlays** by default.
This means:
- The border art should already include a transparent centre.
- The app composites the frame with normal alpha blending instead of legacy screen blending.

For best results the frame image should have:
- A **transparent interior**.
- Bright, high-contrast border artwork (gold, silver, jewel tones work well).
- Recommended size: **750 × 1050 px** (portrait 5:7).

Legacy AI-generated frames with a black interior still work. Those continue to use
screen blending automatically when they are not one of the registered static assets.

## How to Get Images

1. **AI-generated (first time):** Click "FORGE COURIER CARD" with the desired rarity. The
   generated URL is logged to the browser console as
   `[StaticAsset] Generated frame for <Rarity>: <URL>`. Download and save it here, then
   register it in `src/services/staticAssets.ts`.

2. **Custom artwork:** Design your own border in any image editor. Export as WebP (preferred)
   or PNG/JPG, named per the table above.

## Activating a File

After placing the file, open `src/services/staticAssets.ts` and uncomment (or add) the
corresponding entry in `FRAME_ASSETS`:

```ts
const FRAME_ASSETS: Partial<Record<Rarity, string>> = {
  Apprentice:     { url: "/assets/frames/apprentice.webp" },
  Master:         { url: "/assets/frames/master.webp" },
  Rare:           { url: "/assets/frames/rare.webp" },
  Legendary:      { url: "/assets/frames/legendary.webp" },
  "Punch Skater™": { url: "/assets/frames/punch-skater.webp" },
};
```

Once registered, zero fal.ai credits are consumed for that rarity tier's frame.
