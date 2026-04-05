import type { CardPrompts, District, Rarity } from "./types";

// ── Lookup tables ──────────────────────────────────────────────────────────────

/**
 * Rich environment descriptions for the background layer.
 * Used by buildBackgroundPrompt – no characters in these descriptions.
 */
const DISTRICT_BACKGROUND_DESCRIPTIONS: Record<string, string> = {
  Airaway:
    "an expansive floating sky-city above the clouds, levitating platforms connected by glass sky-bridges, " +
    "cloud-towers drifting in warm sunrise light, hot-air balloons and gliders in the distance, " +
    "golden hour rays filtering through cumulus clouds, volumetric god-rays, awe-inspiring scale",
  Nightshade:
    "a neon-soaked cyberpunk megalopolis at night, rain-slicked streets reflecting towering holographic " +
    "advertisements, dense vertical cityscape packed with cascading neon signs in magenta and cyan, " +
    "flying vehicles leaving light trails, moody noir atmosphere, dramatic contrast",
  Batteryville:
    "a vast off-grid desert compound at golden hour, rows of gleaming solar-panel arrays and spinning wind " +
    "turbines against a burnt-amber sky, rugged salvaged-tech market stalls and corrugated-iron workshops, " +
    "dust devils in the distance, warm earthy tones, gritty frontier atmosphere",
};

/**
 * Brief district description used inside the combined (single-image) prompt.
 */
const DISTRICT_DESCRIPTIONS: Record<string, string> = {
  Airaway:      "a floating sky city with clouds and levitating platforms",
  Nightshade:   "a rain-drenched neon-lit cyberpunk megalopolis at night",
  Batteryville: "a rugged off-grid desert settlement with solar panels and wind turbines",
};

const STYLE_CLOTHING: Record<string, string> = {
  Corporate:  "a sleek corporate suit with a high-tech earpiece",
  Street:     "a street-style hoodie and cargo pants with graffiti patches",
  "Off-grid": "rugged off-grid survivalist gear with utility belts",
  Military:   "tactical military fatigues with body armour",
  Union:      "union worker overalls covered in badge patches",
};

const ARCHETYPE_POSES: Record<string, string> = {
  "Ninja":        "crouched in a stealthy ready stance",
  "Punk Rocker":  "striking a defiant rock-star pose with arms wide",
  "Ex Military":  "standing at confident attention with arms crossed",
  "Hacker":       "typing on a holographic keyboard, screens reflected in goggles",
  "Chef":         "brandishing a cleaver and a spray-can like weapons",
};

const VIBE_BOARD: Record<string, string> = {
  Grunge:  "a worn, weathered",
  Neon:    "a glowing neon",
  Chrome:  "a sleek chrome",
  Plastic: "a bright colourful plastic",
};

const RARITY_MOOD: Record<string, string> = {
  "Punch Skater": "gritty and low-budget",
  Apprentice:     "energetic and hopeful",
  Master:         "confident and polished",
  Rare:           "dynamic and striking",
  Legendary:      "epic, otherworldly, and awe-inspiring",
};

/**
 * Ornate border descriptions keyed by rarity tier.
 * Used by buildFramePrompt to produce a playing-card-style overlay.
 */
const RARITY_FRAME_DESCRIPTIONS: Record<string, string> = {
  "Punch Skater":
    "a simple thin border with minimal hand-drawn grunge marks and rough corner scratches",
  Apprentice:
    "a clean double-line border with small stylised leaf flourishes at each corner",
  Master:
    "an ornate border with symmetrical floral corner-pieces, intertwining vines and small blossoms",
  Rare:
    "an elaborate gilded border with detailed botanical motifs, layered petals and scrollwork along every edge",
  Legendary:
    "a spectacular gold-and-jewel border with intricate mythological floral patterns, " +
    "large jewelled corner medallions, and cascading tendrils of foliage all around the edge",
};

/**
 * District-specific bag/package descriptions for each stamina tier.
 *
 * Stamina 1–2  → tier 0 (minimal carry)
 * Stamina 3–5  → tier 1 (backpack)
 * Stamina 6–8  → tier 2 (large box/crate)
 * Stamina 9–10 → tier 3 (max-capacity duffel)
 */
const DISTRICT_BAG_DESCRIPTIONS: Record<string, string[]> = {
  Airaway: [
    "a small anti-gravity courier pouch with altitude stabilisers",
    "a levitation-stabilised cloud-pack with built-in altitude sensors and sky-city insignia",
    "a pressurised hover-cargo container with retractable grip handles",
    "a massive anti-grav freight sling bearing the Airaway Sky-Dock authority stamp",
  ],
  Nightshade: [
    "a neon-lit encrypted nano-courier bag with a blinking status LED",
    "a cyberpunk backpack with glowing circuit-trace panels and hidden data-port pockets",
    "a reinforced cargo crate plastered with holographic corporate logos and barcode stickers",
    "a bulky duffel bag with neon-stripe accents, LED combination locks, and cable management loops",
  ],
  Batteryville: [
    "a patched canvas satchel decorated with hand-sewn solar-cell strips",
    "a rugged canvas survival pack bristling with utility pouches and carabiner clips",
    "a weathered wooden crate bound with salvaged wire and rope, marked with charcoal stencils",
    "a bulging military-surplus duffel bag packed with off-grid survival supplies",
  ],
};

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Generic bag description keyed only by stamina tier.
 * Used in the character-layer prompt so that the character image is independent
 * of the district (changing district only regenerates the background layer).
 */
const STAMINA_BAG_DESCRIPTIONS: string[] = [
  "a small courier pouch",
  "a standard backpack",
  "a large cargo box",
  "a heavy duffel bag",
];

function characterBagDescription(stamina: number): string {
  const tier = stamina <= 2 ? 0 : stamina <= 5 ? 1 : stamina <= 8 ? 2 : 3;
  return STAMINA_BAG_DESCRIPTIONS[tier];
}

/** District-specific bag used by the legacy single-image prompt only. */
function bagDescription(district: string, stamina: number): string {
  const tier = stamina <= 2 ? 0 : stamina <= 5 ? 1 : stamina <= 8 ? 2 : 3;
  const list: string[] | undefined = DISTRICT_BAG_DESCRIPTIONS[district];
  return list ? list[tier] : STAMINA_BAG_DESCRIPTIONS[tier];
}

function staminaState(stamina: number): string {
  if (stamina <= 3) return "visibly tired, carrying minimal gear";
  if (stamina >= 8) return "fully loaded, carrying bulky cargo";
  return "alert and ready, mid-weight gear";
}

// ── Layer prompt builders ──────────────────────────────────────────────────────

/**
 * Builds a prompt for the **background layer** of a card.
 *
 * The result focuses entirely on the district environment — no characters,
 * no people, no text — making it suitable for use as a compositable backdrop.
 * Changing the district regenerates only this prompt (and its layer image).
 */
export function buildBackgroundPrompt(district: District): string {
  const bg = DISTRICT_BACKGROUND_DESCRIPTIONS[district] ?? district;
  return (
    `Environment scene: ${bg}. ` +
    `Wide establishing shot, cinematic composition, absolutely no people, no characters, no text. ` +
    `Minimal Trading card art in the style of 1995 Fleer Ultra X-Men, fantastic realism, airbrushed gouache texture, ` +
    `vibrant and saturated 90s digital colors, dramatic rim lighting. Hyper-Realistic sci-fi setting. ` +
    `SFW, family friendly, PG rated, LGBTQIA+.`
  );
}

/**
 * Builds a prompt for the **character layer** of a card.
 *
 * The character is rendered against a plain white background so it can be
 * composited over the background layer using CSS mix-blend-mode: multiply.
 * The bag/package description is based on stamina alone — it does NOT depend
 * on the district, so the character layer is only regenerated when archetype,
 * style, vibe, or stamina changes (matching the `characterSeed` cache key).
 * Changing district or rarity leaves this layer untouched.
 */
export function buildCharacterPrompt(prompts: CardPrompts): string {
  const clothing  = STYLE_CLOTHING[prompts.style]    ?? prompts.style;
  const pose      = ARCHETYPE_POSES[prompts.archetype] ?? prompts.archetype;
  const board     = VIBE_BOARD[prompts.vibe]          ?? prompts.vibe;
  const mood      = RARITY_MOOD[prompts.rarity]       ?? "bold";
  const bagDesc   = characterBagDescription(prompts.stamina);
  const state     = staminaState(prompts.stamina);

  return (
    `Full-body portrait of a ${prompts.archetype} skater courier, ` +
    `wearing ${clothing}, ${pose}, ` +
    `carrying ${bagDesc}, riding ${board} skateboard. ` +
    `Character is ${state}. ` +
    `Mood: ${mood}. ` +
    `Isolated on a plain white background, full figure visible from head to toe, centred. ` +
    `Minimal Trading card art in the style of 1995 Fleer Ultra X-Men, fantastic realism, airbrushed gouache texture, ` +
    `vibrant and saturated 90s digital colors, dramatic rim lighting, realistic anatomy, chromium finish, ` +
    `epic action pose, 90s Marvel aesthetic. No kids. No teens. Adults aged 18-99 only. ` +
    `SFW, family friendly, PG rated, LGBTQIA+.`
  );
}

/**
 * Builds a prompt for the **frame layer** of a card.
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
  return (
    `A playing card border frame: ${border}. ` +
    `Gold, silver, titanium foil, decorative, accents. ` +
    `The interior of the frame is completely flat black — only the border decoration is coloured. ` +
    `Symmetrical layout, top-down flat graphic illustration style, isolated on black background, no characters, no text. ` +
    `Clean vector-art look, high contrast, 4K. ` +
    `SFW, family friendly, PG rated, LGBTQIA+.`
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
  const pose     = ARCHETYPE_POSES[prompts.archetype] ?? prompts.archetype;
  const district = DISTRICT_DESCRIPTIONS[prompts.district] ?? prompts.district;
  const board    = VIBE_BOARD[prompts.vibe]          ?? prompts.vibe;
  const mood     = RARITY_MOOD[prompts.rarity]       ?? "bold";
  const bag      = bagDescription(prompts.district, prompts.stamina);
  const state    = staminaState(prompts.stamina);

  return (
    `A hyper-realistic 3D cartoon-style portrait of a ${prompts.archetype} skater courier ` +
    `wearing ${clothing}, ${pose}, ` +
    `carrying ${bag}, riding ${board} skateboard. ` +
    `The background is ${district}. ` +
    `Character is ${state}. ` +
    `Mood: ${mood}. Stamina ${prompts.stamina}/10. ` +
    `Rendered in Unreal Engine, vibrant colours, octane render, cinematic lighting, 4K. ` +
    `SFW, Family Friendly, PG rated, LGBTQIA+.`
  );
}
