# District Background Assets

Place district background images here to skip AI generation and save fal.ai credits.

## Filename Convention

| District      | Filename              |
|---------------|-----------------------|
| Airaway       | `airaway.jpg`         |
| Nightshade    | `nightshade.jpg`      |
| Batteryville  | `batteryville.jpg`    |
| The Grid      | `the-grid.jpg`        |
| The Forest    | `the-forest.jpg`      |
| Glass City    | `glass-city.jpg`      |

## Accepted Formats

`.jpg`, `.jpeg`, `.png`, or `.webp` — use the exact filename shown above (no spaces).

## How to Get Images

1. **AI-generated (first time):** Click "FORGE COURIER CARD" in the app. The generated URL is
   logged to the browser console as `[StaticAsset] Generated background for <District>: <URL>`.
   Download that image and save it here with the correct filename, then register it in
   `src/services/staticAssets.ts`.

2. **Custom artwork:** Drop in your own JPG/PNG that matches the desired district mood.
   Recommended size: **768 × 1024 px** (portrait 3:4) at 72–96 DPI for screen, or
   **1536 × 2048 px** for print quality.

## Activating a File

After placing the file, open `src/services/staticAssets.ts` and uncomment (or add) the
corresponding entry in `BACKGROUND_ASSETS`:

```ts
const BACKGROUND_ASSETS: Partial<Record<District, string>> = {
  Airaway: "/assets/backgrounds/airaway.jpg",
  // ... add other districts as you add files
};
```

The app checks this registry before querying Firestore or calling fal.ai, so the static
file is always used and zero credits are consumed for that district.
