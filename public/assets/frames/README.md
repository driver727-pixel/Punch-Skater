# Card Frame / Border Assets

Place rarity-tier border frame images here only if you need the legacy raster
frame fallback for older saved cards.

The live app now renders built-in procedural frames for Punch Skater,
Apprentice, Master, Rare, and Legendary by default. These files are no longer
part of the normal forge path.

## Filename Convention

| Rarity        | Filename                |
|---------------|-------------------------|
| Punch Skater  | `punch-skater.webp`      |
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

## When to Keep These Files

Keep the raster files only while you still need backward compatibility for
cards that already saved `frameImageUrl` values pointing at them.

Once you have migrated or retired those records, you can remove both the files
and their registrations in `/home/runner/work/Punch-Skater/Punch-Skater/src/services/staticAssets.ts`.

## How to Get Images

1. **Older saved cards already depend on them:** Keep the existing registered
   files in place until those cards have been migrated.

2. **Manual legacy fallback:** If you intentionally want a raster fallback for a
   rarity, design or export the border art as WebP (preferred) or PNG/JPG and
   name it per the table above.

## Activating a File

After placing the file, open
`/home/runner/work/Punch-Skater/Punch-Skater/src/services/staticAssets.ts` and
add the corresponding entry in `FRAME_ASSETS`:

```ts
const FRAME_ASSETS: Partial<Record<Rarity, string>> = {
  Apprentice:     { url: "/assets/frames/apprentice.webp" },
  Master:         { url: "/assets/frames/master.webp" },
  Rare:           { url: "/assets/frames/rare.webp" },
  Legendary:      { url: "/assets/frames/legendary.webp" },
  "Punch Skater": { url: "/assets/frames/punch-skater.webp" },
};
```

Registering a file does not make it the primary render path. It only keeps the
legacy raster fallback available for cards that already store that frame URL.
