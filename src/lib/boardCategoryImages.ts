/**
 * boardCategoryImages.ts
 *
 * Discovers all PNG images committed to the per-category board asset folders
 * under `src/assets/boards/` at build time via Vite's `import.meta.glob`.
 *
 * How to add images:
 *   1. Drop any `.png` file into the matching category folder:
 *        src/assets/boards/motor/        ← motor photos
 *        src/assets/boards/deck/         ← deck photos
 *        src/assets/boards/drivetrain/   ← drivetrain photos
 *        src/assets/boards/wheels/       ← wheel photos
 *        src/assets/boards/battery/      ← battery photos
 *   2. Commit the file and rebuild — Vite will automatically pick it up.
 *
 * File names should contain a keyword that identifies the component they
 * represent (e.g. `carbon-fiber.png` for the Street deck, `5055-motor.png`
 * for the Micro motor).  `getMatchingCategoryImage` uses this naming
 * convention to return the correct image when a specific component is
 * selected on the conveyor belt.
 *
 * `getRandomCategoryImage` is kept for backward compatibility and will pick
 * any image from the folder at random.
 *
 * Note: Files placed in `public/assets/boards/<category>/` with names that
 * exactly match the option value (e.g. `Standard.png`) are served directly
 * by the browser and will be shown by the Tile component as a first-choice
 * URL.  The glob-based selection from `src/assets/boards/` takes priority
 * and acts as the discovery layer for files with keyword-based names.
 */

// ── Build-time image discovery (Vite import.meta.glob) ────────────────────────
// Each glob returns Record<filePath, defaultExport> where the default export
// for a PNG is the hashed public URL produced by Vite.
// The file path key is used for keyword matching; the value is the URL.

const deckGlob = import.meta.glob<string>(
  "../assets/boards/deck/*.png",
  { eager: true, import: "default" },
);

const drivetrainGlob = import.meta.glob<string>(
  "../assets/boards/drivetrain/*.png",
  { eager: true, import: "default" },
);

const motorGlob = import.meta.glob<string>(
  "../assets/boards/motor/*.png",
  { eager: true, import: "default" },
);

const wheelsGlob = import.meta.glob<string>(
  "../assets/boards/wheels/*.png",
  { eager: true, import: "default" },
);

const batteryGlob = import.meta.glob<string>(
  "../assets/boards/battery/*.png",
  { eager: true, import: "default" },
);

// ── Category glob maps (path → url) ───────────────────────────────────────────

const CATEGORY_GLOBS = {
  deck:       deckGlob,
  drivetrain: drivetrainGlob,
  motor:      motorGlob,
  wheels:     wheelsGlob,
  battery:    batteryGlob,
} satisfies Record<string, Record<string, string>>;

export type BoardCategory = keyof typeof CATEGORY_GLOBS;

// ── Keyword map ────────────────────────────────────────────────────────────────
// Maps each component option value to the filename keywords that identify its
// image.  When a user uploads `5055-motor.png` the keyword "5055" links it to
// the "Micro" motor option; "poly" links `poly-wheels.png` to the "Urethane"
// option (polyurethane), and so on.

const COMPONENT_IMAGE_KEYWORDS: Record<BoardCategory, Record<string, readonly string[]>> = {
  deck: {
    Street:   ["street", "carbon"],
    AT:       ["at", "bamboo", "terrain"],
    Mountain: ["mountain", "mt"],
    Surf:     ["surf"],
    Slider:   ["slider"],
  },
  drivetrain: {
    Belt: ["belt", "dual"],
    Hub:  ["hub"],
    Gear: ["gear"],
    AWD:  ["awd"],
  },
  motor: {
    Micro:     ["micro", "5055"],
    Standard:  ["standard", "6354"],
    Torque:    ["torque", "6374"],
    Outrunner: ["outrunner", "6396"],
  },
  wheels: {
    Urethane:  ["urethane", "poly"],
    Pneumatic: ["pneumatic"],
    Rubber:    ["rubber", "solid"],
    Cloud:     ["cloud"],
  },
  battery: {
    SlimStealth: ["slim", "stealth"],
    DoubleStack: ["double", "stack", "brick"],
    TopPeli:     ["peli", "top"],
  },
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns all discovered image URLs for the given board component category.
 * Returns an empty array when no images have been uploaded to that folder yet.
 */
export function getCategoryImages(category: BoardCategory): readonly string[] {
  return Object.values(CATEGORY_GLOBS[category]);
}

/**
 * Returns the URL of a randomly selected image in the given category folder
 * whose filename matches the selected component value.
 *
 * Matching works by splitting the filename on `-` / `_` / spaces and checking
 * whether any segment equals or contains a keyword from `COMPONENT_IMAGE_KEYWORDS`.
 * When multiple files match, one of the matching files is picked at random.
 * Falls back to a random image in the category when no keyword match is found,
 * and returns `null` when the folder contains no images.
 */
export function getMatchingCategoryImage(
  category: BoardCategory,
  value: string,
): string | null {
  const glob = CATEGORY_GLOBS[category];
  const paths = Object.keys(glob);
  if (paths.length === 0) return null;

  const keywords =
    COMPONENT_IMAGE_KEYWORDS[category]?.[value] ??
    [value.toLowerCase()];

  const matches: string[] = [];

  for (const path of paths) {
    const filename =
      path.split("/").pop()?.replace(/\.png$/i, "").toLowerCase() ?? "";
    const parts = filename.split(/[-_\s]+/);
    if (keywords.some((kw) => parts.some((part) => part === kw))) {
      matches.push(glob[path]);
    }
  }

  if (matches.length > 0) {
    return matches[Math.floor(Math.random() * matches.length)];
  }

  // No keyword match — return a random URL from the category as a fallback.
  const urls = Object.values(glob);
  return urls[Math.floor(Math.random() * urls.length)];
}

/**
 * Picks a random image URL from the given board component category.
 * Returns `null` when the folder contains no images.
 */
export function getRandomCategoryImage(category: BoardCategory): string | null {
  const urls = Object.values(CATEGORY_GLOBS[category]);
  if (urls.length === 0) return null;
  return urls[Math.floor(Math.random() * urls.length)];
}
