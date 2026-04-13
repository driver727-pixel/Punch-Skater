# District Background Assets

Place district background images here to skip AI generation and save fal.ai credits.

## Two Sizes

| Size | Folder | Dimensions | Use |
|------|--------|------------|-----|
| **Print / full quality** | `public/assets/backgrounds/` | 1500 × 2100 px | Print modal, JPEG download |
| **Screen / standard quality** | `public/assets/backgrounds/small/` | 750 × 1050 px | Live card preview, collection thumbnails |

Upload **both** files with the same filename.  The app automatically serves the
small version to the browser (fast load) and switches to the large version when
the user prints or downloads the card.

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
   - Print-quality (this folder): **1500 × 2100 px**
   - Screen-quality (`small/` subfolder): **750 × 1050 px** at 72–96 DPI

## Activating Files

After placing the files, open `src/services/staticAssets.ts` and add (or uncomment) the
corresponding entry in **both** `BACKGROUND_ASSETS` (print) and `BACKGROUND_ASSETS_SMALL`
(screen):

```ts
const BACKGROUND_ASSETS: Partial<Record<District, string>> = {
  Airaway: "/assets/backgrounds/airaway.jpg",       // print quality
};

const BACKGROUND_ASSETS_SMALL: Partial<Record<District, string>> = {
  Airaway: "/assets/backgrounds/small/airaway.jpg", // screen quality
};
```

The app checks this registry before querying Firestore or calling fal.ai, so the static
file is always used and zero credits are consumed for that district.
