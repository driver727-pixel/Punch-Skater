# District Background Assets — Screen / Standard Quality

Place **screen-resolution** district background images here.  These are served to
the browser for the live card preview and collection thumbnails, keeping page-load
fast.  The larger print-quality originals live one level up in
`public/assets/backgrounds/`.

## Filename Convention

Use the **same filename** as the corresponding print-quality file:

| District      | Filename              |
|---------------|-----------------------|
| Airaway       | `airaway.jpg`         |
| Nightshade    | `nightshade.jpg`      |
| Batteryville  | `batteryville.jpg`    |
| The Grid      | `the-grid.jpg`        |
| The Forest    | `the-forest.jpg`      |
| Glass City    | `glass-city.jpg`      |

## Recommended Dimensions

**750 × 1050 px** at 72–96 DPI (portrait 5:7 aspect ratio).

The full-size equivalents in the parent folder should be **1500 × 2100 px** and are
only fetched during print / download.

## Activating Files

After placing a file here, open `src/services/staticAssets.ts` and add (or
uncomment) the corresponding entry in `BACKGROUND_ASSETS_SMALL`:

```ts
const BACKGROUND_ASSETS_SMALL: Partial<Record<District, string>> = {
  Airaway: "/assets/backgrounds/small/airaway.jpg",
  // ... add other districts as you add files
};
```

The app automatically uses these small files for the card preview and saves them
to the collection, while switching to the full-size files from the parent folder
when the user prints or downloads the card.
