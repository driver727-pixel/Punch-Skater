/**
 * boardCategoryImages.ts
 *
 * Uses the curated public asset images in `public/assets/boards/<category>/` for the
 * board preview grid.
 *
 * How to add images:
 *   1. Drop any `.png` or `.webp` file into the matching category folder:
 *        public/assets/boards/motor/        ← motor photos
 *        public/assets/boards/deck/         ← deck photos
 *        public/assets/boards/drivetrain/   ← drivetrain photos
 *        public/assets/boards/wheels/       ← wheel photos
 *        public/assets/boards/battery/      ← battery photos
 *   2. Commit the file and redeploy so browsers can fetch the refreshed assets.
 *
 * File names should contain a keyword that identifies the component they
 * represent (e.g. `street.png` for the Street deck, `5055-motor.png`
 * for the Micro motor).  `getMatchingCategoryImage` uses this naming
 * convention to return the correct image when a specific component is
 * selected on the conveyor belt.
 *
 * `getRandomCategoryImage` is kept for backward compatibility and will pick
 * any image from the folder at random.
 *
 * The preview grid now resolves directly from `public/assets/boards/` so the
 * latest uploaded transparent component images are always preferred over older bundled
 * source assets.
 */

import { withBoardComponentAssetVersion } from "./boardAssetVersion";

function createCategoryImageMap(
  category: string,
  filenames: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    filenames.map((filename) => {
      const path = `/assets/boards/${category}/${filename}`;
      return [path, withBoardComponentAssetVersion(path)];
    }),
  );
}

// ── Category image maps (path → url) ──────────────────────────────────────────

const CATEGORY_GLOBS = {
  deck: createCategoryImageMap("deck", [
    "street.png",
    "mt-board.png",
    "at-bamboo.png",
    "surf-skate.png",
  ]),
  drivetrain: createCategoryImageMap("drivetrain", [
    "gear-drive.png",
    "4wd-drive.png",
    "hub-drive.png",
    "drivetrain-dual-belt-drive.png",
  ]),
  motor: createCategoryImageMap("motor", [
    "6354-motor.png",
    "6374-motor.png",
    "5055-motor.png",
    "6396-motor.png",
  ]),
  wheels: createCategoryImageMap("wheels", [
    // The deployed pneumatic wheel asset still uses the "-new" suffix.
    "pneumatic-wheels-new.png",
    "cloud-wheels.png",
    "poly-wheels.png",
    "solid-rubber.png",
  ]),
  battery: createCategoryImageMap("battery", [
    "top-mount-battery.png",
    "double-battery.png",
    "slim-battery.png",
  ]),
} satisfies Record<string, Record<string, string>>;

export type BoardCategory = keyof typeof CATEGORY_GLOBS;

// ── Keyword map ────────────────────────────────────────────────────────────────
// Maps each component option value to the filename keywords that identify its
// image.  When a user uploads `5055-motor.png` the keyword "5055" links it to
// the "Micro" motor option; "poly" links `poly-wheels.png` to the "Urethane"
// option (polyurethane), and the matcher still accepts legacy .png/.jpg/.jpeg
// filenames for backward compatibility while the asset migration settles.

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
    "4WD": ["4wd"],
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
  const matches = getMatchingCategoryImages(category, value);
  if (matches.length > 0) {
    return matches[Math.floor(Math.random() * matches.length)];
  }

  const urls = getCategoryImages(category);
  return urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : null;
}

export function getMatchingCategoryImages(
  category: BoardCategory,
  value: string,
): readonly string[] {
  const glob = CATEGORY_GLOBS[category];
  const paths = Object.keys(glob);
  if (paths.length === 0) return [];

  const keywords =
    COMPONENT_IMAGE_KEYWORDS[category]?.[value] ??
    [value.toLowerCase()];

  const matches: string[] = [];

  for (const path of paths) {
    const filename =
      path.split("/").pop()?.replace(/\.(png|jpe?g|webp)$/i, "").toLowerCase() ?? "";
    const parts = filename.split(/[-_\s]+/);
    if (keywords.some((kw) => parts.some((part) => part === kw))) {
      matches.push(glob[path]);
    }
  }

  return matches;
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
