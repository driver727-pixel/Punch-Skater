# Arcade Racer character sprite sheets

This folder holds the **pre-baked**, committed character sprite sheets used by the
Classic Race arcade racer, plus the `manifest.json` that describes them.

## How sprites are produced

1. Open the admin **Image Assets** page → **🏁 Arcade Sprites** tab.
2. The tool loads the admin **card decks**. For a chosen card it takes the clean
   character layer (background, frame, weapon, and skateboard **deck** removed) as
   a reference image.
3. That reference is sent to fal.ai **`nano-banana-2`**, which renders an isometric
   2D **animated sprite sheet** of the same character. The sheet is then run
   through background removal.
4. Click **Export Manifest + PNGs** to download `manifest.json` and the
   `racer-<slug>.png` sheets.

## Committing for production

Drop the exported files into this folder (overwriting `manifest.json`) and commit
them. Production loads these static files only — it never calls fal.ai at runtime.

## Sheet layout

Each sheet is a single transparent PNG laid out as a strict grid (see
`grid` in `manifest.json`): `columns` × `rows` equally sized cells forming one
looping animation cycle. The in-game loader slices each sheet using
`frameWidth` × `frameHeight` and plays the frames at `fps`.

The grid layout is defined once in `src/lib/arcadeRacerSprites.ts`; keep the
committed `manifest.json` `grid` block in sync with it.
