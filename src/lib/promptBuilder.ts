import { getForgeCoverRole } from "./factionDiscovery";
import { createSeededRandom } from "./prng";
import { PUNCH_SKATER_RARITY, type CardPrompts, type Rarity } from "./types";

// ── Lookup tables ──────────────────────────────────────────────────────────────

/**
 * Brief district description used for the **background layer** prompt only.
 *
 * District descriptions are intentionally excluded from character and skateboard
 * prompts to prevent the environment language from bleeding into those layers.
 */
const DISTRICT_DESCRIPTIONS: Record<string, string> = {
  Airaway:      "a floating sky city with clouds and levitating platforms",
  Nightshade:   "an underground network of subway tunnels, neon-lit pipes and subterranean communes",
  Batteryville: "a rugged off-grid desert settlement with solar panels and wind turbines",
  "The Grid":   "a diesel-punk industrial wasteland of defunct refineries and oil derricks controlled by rival factions",
  "Glass City": "a cyberpunk neon megalopolis of glass skyscrapers — empty streets with no cars and no people, only neon reflections and drones",
  "The Forest": "a biopunk wilderness of towering trees and bioluminescent vines reclaiming rusted megastructures, treetop settlements in misty solitude",
};

const STYLE_CLOTHING: Record<string, string> = {
  Corporate:      "a sleek corporate suit with a high-tech earpiece",
  Street:         "a street-style hoodie and cargo pants with graffiti patches",
  "Off-grid":     "rugged off-grid survivalist gear with utility belts",
  Union:          "union worker overalls covered in badge patches",
  Olympic:        "a coordinated high-end athletic ensemble — matching top and bottoms in sponsor colours, performance fabric, logo patches, and a professional snowboard warm-up suit or full snowsuit",
  Ninja:          "all-black stealthy clothing with no visible logos or markings, dark form-fitting outfit",
  "Punk Rocker":  "recycled DIY clothing with hand-sewn patches and improvised accessories",
  "Ex Military":  "tactical fatigues with cheap-looking plastic body armor and roughly assembled gear",
  Hacker:         "a dark hoodie with embedded tech and a screen-visor or goggles with small display screens",
  Chef:           "a white chef apron and tall chef hat, kitchen non-slip shoes",
  Fascist:        "rugged survivalist explorer gear with utility belts and cargo pockets",
};

const ARCHETYPE_POSES: Record<string, string> = {
  "The Knights Technarchy": "crouched in a dynamic stealthy combat stance, one hand reaching for a concealed weapon, weight shifted forward ready to spring into action, dressed in all black with no lights on the board",
  "Qu111s":                 "a defiant, heroic investigative reporter striking an exaggerated, dynamic action pose, intensely determined expression, dramatically windswept hair, riding a low tech electric skateboard with smaller all-terrain wheels",
  "Ne0n Legion":            "mid-kickflip in a flashy acrobatic trick pose, one arm raised high trailing neon light streaks, body twisted in a dynamic aerial spin with an electrifying expression",
  "Iron Curtains":          "a hyper-muscular mercenary, 90s comic book military, big muscles bodybuilder type, exaggerated pose and facial expression, riding big girthy electric skateboards on big chunky off-road wheels",
  "D4rk $pider":            "a cyber-hacker wearing mirrored wrap-around visor shades, surrounded by thick glowing neon-green fiber-optic cables, fiercely typing on a chunky retro-futuristic mechanical hacking deck, riding a high tech electric skateboard with lots of wires and antennas",
  "The Asclepians":         "striking a commanding power pose with one arm thrust forward pointing decisively, chin raised with fierce confidence, one foot planted firmly on the board, high-tech earpiece visible, corporate logo on the board",
  "The Mesopotamian Society":"defiant rock-star pose in rugged survivalist gear, all-terrain off-road mountain board style",
  "Hermes' Squirmies":      "lunging forward in a dramatic mid-delivery sprint, one arm swinging a heavy parcel overhead, body leaning hard into a sharp turn with intense determination, in union worker overalls covered in badge patches",
  "UCPS":                   "in an explosive action-hero leap over an obstacle, one arm clutching a package tight to the chest, legs kicked out in a dynamic hurdle pose, street-style hoodie and cargo pants, old-looking board with lights",
  "The Team":               "in a triumphant victory pose with both fists pumped skyward, muscles tensed, fierce competitive grin, powerful athletic stance, in a matching sponsor-logo ensemble, coordinated team colours",
};

const COVER_IDENTITY_POSES: Record<string, string> = {
  "The Knights Technarchy": "holding a stealthy low-profile courier stance with precise balance, covert focus, and controlled movement",
  Qu111s: "striking a focused investigative action pose with determined eye contact, messenger bag secured for a fast scoop",
  "Ne0n Legion": "throwing a flashy high-energy stunt pose with bold confidence and showy athletic control",
  "Iron Curtains": "leaning into a forceful action stance with tough kitchen-worker swagger and a heavy-duty delivery loadout",
  "D4rk $pider": "locked into a sharp hacker courier pose with compact tech gear, fast hands, and high-alert focus",
  "The Asclepians": "in a decisive emergency-response stance, ready to deliver urgent aid supplies without breaking stride",
  "The Mesopotamian Society": "balancing confidently in an adventurous field-research pose with treasure-hunter swagger",
  "Hermes' Squirmies": "driving forward in a hard-working delivery pose with practical momentum and union-job grit",
  UCPS: "in a disciplined postal-delivery action pose with a secure parcel, practical utility gear, and efficient movement",
  "The Team": "holding a polished elite-athlete stance with disciplined posture, balance, and coordinated confidence",
};

const RARITY_MOOD: Record<string, string> = {
  "Punch Skater": "gritty and low-budget",
  Apprentice:     "energetic and hopeful",
  Master:         "confident and polished",
  Rare:           "dynamic and striking",
  Legendary:      "epic, otherworldly, and awe-inspiring",
};

const RARITY_FRAME_DESCRIPTIONS: Record<string, string> = {
  "Punch Skater":
    "an edge-to-edge frame that looks like a real poker card literally wrapped in oversized beige Band-Aid strips and adhesive bandages. " +
    "Perforated adhesive rails run up the full left and right edges with evenly spaced punch holes. " +
    "Chunky fabric bandage pads bunch up and fold over multiple corners like a slapped-together first-aid wrap. " +
    "Muted tan cloth, off-white gauze, dusty pink padding, and a few dark-red medicine-stain splatters near the corners only. " +
    "Asymmetric, grimy street-clinic aesthetic.",
  Apprentice:
    "a clean double-line border with small stylised leaf flourishes at each corner",
  Master:
    "an ornate border with symmetrical floral corner-pieces, intertwining vines and small blossoms",
  Rare:
    "an elaborate gilded border with detailed botanical motifs, layered petals and scrollwork along every edge",
  Legendary:
    "a cyberpunk neon-tube border — electric cyan glowing tubes along the outer edge with hot-pink inner accent lines, " +
    "corner circuit-board junction plates with small magenta indicator nodes, " +
    "irregular circuit-trace tick marks along each side, and scattered neon glow dots. " +
    "Dark background. Hard sci-fi, no fantasy, no gold, no foliage.",
};

const CORE_COMIC_BOOK_STYLE =
  "Comic-book illustration for a premium trading card: crisp detail, grounded faces, and strong silhouette readability. ";

const ELECTRIC_SKATEBOARD_REQUIREMENT =
  "Vehicle: an electric skateboard only — a single board deck under the rider's feet with exactly four skateboard wheels. " +
  "The wheels are mounted in two aligned pairs on front and rear trucks with visible axles parallel to the deck width. " +
  "All four wheels point in the same riding direction as the board, never sideways or perpendicular to the deck, and they do not pivot like caster wheels. " +
  "No handlebars, no seat, no extra chassis. ";

export const ELECTRIC_SKATEBOARD_EXCLUSIONS =
  "Never depict a scooter, mobility chair, roller skates, inline skates, children’s hoverboard, self-balancing board, segway, caster wheels, sideways wheels, perpendicular wheels, swivel wheels, or any other device underfoot. ";

function joinPromptBlocks(...blocks: Array<string | undefined>): string {
  return blocks
    .filter((block): block is string => Boolean(block?.trim()))
    .join(" ");
}

function buildCoverIdentityRole(archetype: string): string {
  return getForgeCoverRole(archetype as CardPrompts["archetype"]);
}

function buildCoverIdentityPose(archetype: string): string {
  return COVER_IDENTITY_POSES[archetype]
    ?? ARCHETYPE_POSES[archetype]
    ?? "striking a dramatic comic book action pose, dynamic and powerful";
}

function buildCharacterVisualSeed(prompts: CardPrompts): string {
  return [
    prompts.archetype,
    prompts.style,
    prompts.gender,
    prompts.ageGroup,
    prompts.bodyType,
    prompts.hairLength ?? "",
    prompts.accentColor ?? "",
    prompts.skinTone ?? "",
    prompts.faceCharacter ?? "",
  ].join("|");
}

function buildDynamicComposition(prompts: CardPrompts): string {
  const rng = createSeededRandom(buildCharacterVisualSeed(prompts));
  const cameraAngle = rng.pick([
    "dramatic three-quarter camera angle",
    "cinematic low-angle action shot",
    "dynamic side-angle tracking view",
    "off-center full-body hero framing",
    "slightly worm's-eye comic-book perspective",
  ]);
  const motionLine = rng.pick([
    "captured mid-carve with the rider leaning hard into momentum",
    "caught in a fast push forward with one shoulder leading the motion",
    "shown bracing through a sharp turn with the body counterbalancing the deck",
    "posed as if popping over rough ground with the board alive underfoot",
    "framed in a hard-driving glide with the deck cutting diagonally through the scene",
  ]);
  const gazeLine = rng.pick([
    "eyes focused down the route instead of staring blankly at the camera",
    "attention locked on the next obstacle or delivery line",
    "expression alert and reactive, like the rider is already making the next move",
    "gaze aimed just past the viewer with a sense of forward intent",
  ]);

  return `${cameraAngle}, ${motionLine}, ${gazeLine}`;
}

// ── Appearance helpers ──────────────────────────────────────────────────────────

function describeAccentColor(accentColor?: string): string {
  const hex = accentColor?.trim();
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) return "bright unnatural colour";
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta < 0.08) return "bright silver-gray";

  let hue = 0;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  if (hue < 15 || hue >= 345) return "vivid red";   // 345°–15°
  if (hue < 40) return "bright orange";             // 15°–39°
  if (hue < 70) return "electric yellow";           // 40°–69°
  if (hue < 160) return "neon green";               // 70°–159°
  if (hue < 200) return "electric cyan";            // 160°–199°
  if (hue < 255) return "electric blue";            // 200°–254°
  if (hue < 290) return "electric violet";          // 255°–289°
  return "hot pink";
}

function buildHairDescription(hairLength?: string, accentColor?: string): string {
  if (!hairLength) return "";
  if (hairLength === "Bald") return "Completely bald, clean-shaven head, no hair at all. ";
  const length =
    hairLength === "Buzzcut"   ? "very short buzzcut" :
    hairLength === "Short"     ? "short-cropped hair" :
    hairLength === "Medium"    ? "medium-length hair" :
    hairLength === "Long"      ? "long hair past the shoulders" :
    hairLength === "Very Long" ? "very long flowing hair reaching the waist" :
    /* fallback */               "hair";
  return `${length} dyed in a ${describeAccentColor(accentColor)} tone matching the selected accent color. `;
}

function buildFacialHairDescription(prompts: CardPrompts): string {
  if (prompts.gender === "Woman") return "";

  const facialHairRng = createSeededRandom([
    prompts.archetype,
    prompts.style,
    prompts.gender,
    prompts.ageGroup,
    prompts.bodyType,
    prompts.hairLength ?? "",
    prompts.skinTone ?? "",
    prompts.faceCharacter ?? "",
  ].join("|"));

  if (facialHairRng.next() < 0.5) {
    return "";
  }

  const facialHairStyle = facialHairRng.pick([
    "short beard",
    "trimmed mustache and goatee",
    "close-cropped beard",
    "neatly shaped mustache",
  ]);

  return `${facialHairStyle} dyed in a ${describeAccentColor(prompts.accentColor)} tone matching the selected accent color. `;
}

function buildSkinDescription(skinTone?: string): string {
  if (!skinTone) return "";
  const desc =
    skinTone === "Very Light"   ? "very light / pale ivory skin" :
    skinTone === "Light"        ? "light / fair skin" :
    skinTone === "Medium Light" ? "medium-light / olive skin" :
    skinTone === "Medium"       ? "medium / warm brown skin" :
    skinTone === "Medium Dark"  ? "medium-dark / rich brown skin" :
    skinTone === "Dark"         ? "dark / deep brown skin" :
    /* Very Dark */               "very dark / deep ebony skin";
  return `Skin tone: ${desc}. `;
}

function buildFaceDescription(faceCharacter?: string): string {
  if (!faceCharacter || faceCharacter === "Conventional") return "";
  const desc =
    faceCharacter === "Attractive"   ? "Attractive facial features, balanced symmetry, clear skin, expressive eyes, flattering jawline, and an appealing adult face — handsome or beautiful in a grounded realistic way" :
    faceCharacter === "Weathered"   ? "Weathered, lived-in face with deep expression lines, sun damage, and rough uneven skin texture — NOT attractive, NOT pretty" :
    faceCharacter === "Scarred"     ? "Facial scars, healed cuts, a crooked nose from past breaks — battle-worn face, NOT conventionally attractive" :
    faceCharacter === "Asymmetric"  ? "Noticeably asymmetric face, one eye slightly smaller, crooked jaw, uneven features — distinctively unconventional" :
    faceCharacter === "Rugged"      ? "Extremely rugged face, heavy brow, thick nose, strong jaw, coarse skin — tough and imposing, NOT model-like" :
    faceCharacter === "Baby-faced"  ? "Baby-faced adult with soft rounded cheeks, a small chin, and wide-set eyes — fresh-faced but unmistakably grown" :
    faceCharacter === "Gaunt"       ? "Gaunt hollow-cheeked face, sharp cheekbones, sunken eyes, thin lips — emaciated and intense" :
    /* Round-faced */                 "Full round face, plump cheeks, double chin, small eyes — soft and wide features";
  return `${desc}. `;
}

function buildAgeDescription(ageGroup: string): string {
  return ageGroup === "Young Adult" ? "adult looking 21-31 years of age, fresh-faced with youthful energy but unmistakably grown" :
    ageGroup === "Adult"            ? "adult in their 30s, mature features with slight lines around the eyes" :
    ageGroup === "Middle-aged"      ? "middle-aged adult in their late 40s to 50s, prominent crow's feet, forehead wrinkles, visible laugh lines, slightly sagging jawline, greying at the temples" :
    /* Senior */                      "senior adult in their late 60s or older, deep wrinkles, age spots, thinning eyebrows, weathered leathery skin, sagging jowls";
}

function buildBodyDescription(bodyType: string): string {
  return bodyType === "Slim"            ? "slim narrow-shouldered build, thin arms and legs" :
    bodyType === "Athletic"             ? "athletic build" :
    bodyType === "Average"              ? "average unremarkable build, soft midsection, not muscular" :
    bodyType === "Stocky"               ? "stocky short-limbed build, thick neck, wide torso" :
    bodyType === "Heavy"                ? "heavy overweight build, large belly, double chin, thick limbs" :
    bodyType === "Wiry"                 ? "wiry sinewy build, lean muscles, prominent veins, no bulk" :
    bodyType === "Pear-shaped"          ? "pear-shaped build, narrow shoulders, wide hips, heavier lower body" :
    bodyType === "Lanky"                ? "lanky tall and gangly build, long limbs" :
    /* Barrel-chested */                  "barrel-chested build, deep round ribcage, thick waist, powerful but not lean";
}

/**
 * Builds a prompt for the **character layer** of a card.
 *
 * The character is rendered against a plain neutral studio background, which is then
 * stripped by the birefnet background-removal model to produce a transparent PNG
 * that composites cleanly over the background layer using CSS mix-blend-mode: normal.
 * The character layer is only regenerated when archetype, style, gender,
 * ageGroup, bodyType, hairLength, accentColor, skinTone, or faceCharacter changes
 * (matching the character-image cache key). Changing district or rarity leaves
 * this layer untouched.
 */
export function buildCharacterPrompt(prompts: CardPrompts, graffitiWords?: string[]): string {
  const clothing  = STYLE_CLOTHING[prompts.style]    ?? prompts.style;
  const pose      = buildCoverIdentityPose(prompts.archetype);
  const composition = buildDynamicComposition(prompts);
  const coverRole = buildCoverIdentityRole(prompts.archetype);
  const mood      = RARITY_MOOD[prompts.rarity]       ?? "bold";
  const graffitiLine = graffitiWords?.length
    ? `The skateboard deck and wheels feature graffiti tags or brand logos reading '${graffitiWords.join("' and '")}'. `
    : "";

  const genderDesc =
    prompts.gender === "Woman" ? "a woman" :
    prompts.gender === "Man"   ? "a man" :
    /* Non-binary */             "a non-binary person";

  const ageDesc = buildAgeDescription(prompts.ageGroup);
  const bodyDesc = buildBodyDescription(prompts.bodyType);

  const hairDesc = buildHairDescription(prompts.hairLength, prompts.accentColor);
  const facialHairDesc = buildFacialHairDescription(prompts);
  const skinDesc = buildSkinDescription(prompts.skinTone);
  const faceDesc = buildFaceDescription(prompts.faceCharacter);

  const characterDesc = `Character is ${genderDesc}, ${ageDesc}, with ${bodyDesc}. ${hairDesc}${facialHairDesc}${skinDesc}${faceDesc}`;

  return joinPromptBlocks(
    CORE_COMIC_BOOK_STYLE,
    `Full-body comic-book portrait of an adult ${coverRole}, wearing ${clothing}, ${pose}, riding an electric skateboard, ${composition}.`,
    ELECTRIC_SKATEBOARD_REQUIREMENT,
    characterDesc,
    graffitiLine,
    `Mood: ${mood}.`,
    `Background: solid neutral medium-gray studio, full figure head-to-toe, centered.`,
    `Adult subject (21+), fully clothed, SFW, LGBTQIA+ inclusive.`,
  );
}

/**
 * Builds a prompt for the **frame layer** of a card.
 *
 * Fallback-only for the current shipped catalog: all live rarity tiers are
 * registered to uploaded static frame assets in `src/services/staticAssets.ts`,
 * so the live forge normally never calls fal.ai for this layer. This prompt is
 * retained for missing assets, future rarities, or emergency regeneration.
 *
 * Generates an ornate playing-card-style border whose complexity and style
 * scales with the rarity tier.  The centre of the frame image is flat black
 * so that when composited on top of background+character via
 * mix-blend-mode: screen, the black interior becomes transparent and only
 * the coloured gold/silver/foil border remains visible.
 * Changing rarity regenerates only this layer.
 */
export function buildFramePrompt(rarity: Rarity): string {
  const border = RARITY_FRAME_DESCRIPTIONS[rarity] ?? "a plain decorative border";
  const isPunchSkater = rarity === PUNCH_SKATER_RARITY;
  const isLegendary   = rarity === "Legendary";
  const accentPalette = isPunchSkater
    ? "Aged beige adhesive cloth, tan canvas, off-white gauze, dusty pink padding, dried dark-red stains."
    : isLegendary
      ? "Electric cyan, hot pink, magenta neon."
      : "Gold, silver, titanium foil, decorative accents.";
  const layoutHint = isPunchSkater
    ? "Asymmetric, organic, irregular placement — deliberately not mirrored,"
    : "Symmetrical layout,";
  const punchSkaterBandAidHint = isPunchSkater
    ? "It must read instantly as a trading card wrapped in rough Band-Aids, not as a fantasy border or ornate frame. " +
      "Show perforated adhesive strips on the side rails and folded cloth bandage pads hugging the corners. "
    : "";
  return (
    `A playing card border frame: ${border}. ` +
    `${accentPalette} ` +
    `The interior of the frame is completely flat black — only the border decoration is coloured. ` +
    `The border artwork must touch or slightly crop against all four image edges with zero outer margin, zero inset, and zero black padding around the outside. ` +
    punchSkaterBandAidHint +
    `${layoutHint} top-down flat graphic illustration style, isolated on black background, no characters, no text. ` +
    `Clean vector-art look, high contrast, 4K. ` +
    `SFW, family friendly, PG rated, LGBTQIA+.`
  );
}

/** Standard poker card print dimensions (width × height, no bleed). */
const PRINT_CARD_SIZE = "2.5×3.5 inch";
/** Bleed allowance added to all four edges for print-safe cutting. */
const PRINT_BLEED    = "0.125-inch";

/**
 * Builds a prompt for the **card back** layer.
 *
 * The back design uses the same rarity-based seed as the frame so it only
 * regenerates when the rarity tier changes.  The pattern is point-symmetric
 * (180° rotational symmetry) so the card looks identical when rotated during
 * gameplay — a standard requirement for reversible playing cards.
 *
 * Style targets: flat, clean vector-style artwork intended for 300 DPI
 * print output on a standard 2.5 × 3.5 inch poker card (with 0.125-inch bleed).
 */
export function buildCardBackPrompt(rarity: Rarity): string {
  const border = RARITY_FRAME_DESCRIPTIONS[rarity] ?? "a plain decorative border";
  return (
    `A print-ready playing card back design: ${border}. ` +
    `Perfect 180-degree point-symmetrical pattern — the artwork is identical when the card is rotated 180 degrees. ` +
    `Flat, clean vector-style graphic with bold geometric and ornamental shapes, no gradients or photographic elements. ` +
    `Centered medallion motif with symmetrical radiating border elements covering the full card face edge-to-edge. ` +
    `No characters, no people, no text, no numerals. ` +
    `High-quality 300 DPI print-ready artwork sized for a ${PRINT_CARD_SIZE} poker card with ${PRINT_BLEED} bleed. ` +
    `Isolated on a solid dark background, strong contrast, clean bold lines. ` +
    `SFW, family friendly, PG rated, LGBTQIA+.`
  );
}

// ── Background layer prompt ─────────────────────────────────────────────────────

/**
 * Builds a prompt for the **background layer** of a card.
 *
 * Fallback-only for the current shipped catalog: all live forge districts are
 * registered to uploaded static background assets in
 * `src/services/staticAssets.ts`, so the live forge normally never calls
 * fal.ai for this layer. This prompt is retained for missing assets, future
 * districts, or emergency regeneration.
 *
 * District descriptions are applied here — and **only** here — so that
 * environment language never leaks into character or skateboard prompts.
 * The background layer is keyed by district, so changing district
 * regenerates only this layer.
 */
export function buildBackgroundPrompt(district: string): string {
  const desc = DISTRICT_DESCRIPTIONS[district] ?? district;
  return joinPromptBlocks(
    CORE_COMIC_BOOK_STYLE,
    `Scene: a wide establishing shot of ${desc}.`,
    `No people, no characters, no text, no logos.`,
    `Mood: atmospheric, immersive, cinematic depth of field.`,
    `Render goals: rich environmental detail, dramatic lighting, and splash-page clarity.`,
    `SFW, family friendly, PG rated, LGBTQIA+.`,
  );
}

// ── Combined (single-image) prompt builder ─────────────────────────────────────

/**
 * Converts a set of card prompts into a single descriptive text prompt.
 *
 * Used as a backward-compatible fallback when layered generation is not in use.
 * The same card prompts always produce exactly the same string, so
 * reproducibility is maintained when paired with the hashed integer seed from
 * `hashSeedToInt(masterSeed)`.
 */
export function buildImagePrompt(prompts: CardPrompts): string {
  const clothing = STYLE_CLOTHING[prompts.style]    ?? prompts.style;
  const pose     = buildCoverIdentityPose(prompts.archetype);
  const composition = buildDynamicComposition(prompts);
  const coverRole = buildCoverIdentityRole(prompts.archetype);
  const mood     = RARITY_MOOD[prompts.rarity]       ?? "bold";
  const genderDesc =
    prompts.gender === "Woman" ? "a woman" :
    prompts.gender === "Man"   ? "a man" :
    /* Non-binary */             "a non-binary person";

  const ageDesc = buildAgeDescription(prompts.ageGroup);
  const bodyDesc = buildBodyDescription(prompts.bodyType);

  const hairDesc = buildHairDescription(prompts.hairLength, prompts.accentColor);
  const facialHairDesc = buildFacialHairDescription(prompts);
  const skinDesc = buildSkinDescription(prompts.skinTone);
  const faceDesc = buildFaceDescription(prompts.faceCharacter);

  const characterDesc = `Character is ${genderDesc}, ${ageDesc}, with ${bodyDesc}. ${hairDesc}${facialHairDesc}${skinDesc}${faceDesc}`;

  return joinPromptBlocks(
    CORE_COMIC_BOOK_STYLE,
    `Full-body comic-book portrait of an adult ${coverRole}, wearing ${clothing}, ${pose}, riding an electric skateboard, ${composition}.`,
    ELECTRIC_SKATEBOARD_REQUIREMENT,
    characterDesc,
    `Mood: ${mood}.`,
    `Adult subject (21+), fully clothed, SFW, LGBTQIA+ inclusive.`,
  );
}
