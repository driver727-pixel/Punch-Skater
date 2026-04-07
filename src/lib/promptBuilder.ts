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
    "an underground society of perpetual subway lines, buried stations and giant industrial pipework, " +
    "some areas are virtual cities submerged in total darkness except for the glow of neon skateboards and neon lights, " +
    "long tunnels and side trails, literal massive pipes you can skate through, " +
    "weird hippie communes with glowing mushroom farms, strange subterranean cult shrines, " +
    "intense neon lighting and blacklight murals, 1990s Ninja Turtles meets Mario Bros aesthetic, " +
    "vivid purples and greens with glowing graffiti",
  Batteryville:
    "a vast off-grid desert compound at golden hour, rows of gleaming solar-panel arrays and spinning wind " +
    "turbines against a burnt-amber sky, rugged salvaged-tech market stalls and corrugated-iron workshops, " +
    "dust devils in the distance, warm earthy tones, gritty frontier atmosphere",
  "The Grid":
    "an industrial wasteland of old refineries, rusting oil derricks and coal pits beyond the city limits, " +
    "defunct corporate conglomerate megastructures now controlled by rival Marxist union gangs and international " +
    "Communist factions, red banners and propaganda murals on crumbling concrete, diesel smoke and fire, " +
    "diesel-punk aesthetic with heavy machinery and riveted ironwork, dramatic orange flare stacks at night",
  "Glass City":
    "a cyberpunk neon megalopolis of towering glass skyscrapers packed with holographic advertisements, " +
    "empty decayed and cracked roads with no cars, no bicycles, and no people anywhere — a hauntingly deserted urban canyon, " +
    "autonomous delivery drones hovering silently overhead, " +
    "neon reflections on rain-soaked pavement, dense vertical cityscape lit by a thousand screens, " +
    "high-tech sensor gear and floating holo-signs everywhere, dramatic cyberpunk atmosphere, no humans, no figures",
};

/**
 * Brief district description used inside the combined (single-image) prompt.
 */
const DISTRICT_DESCRIPTIONS: Record<string, string> = {
  Airaway:      "a floating sky city with clouds and levitating platforms",
  Nightshade:   "an underground network of subway tunnels, neon-lit pipes and subterranean communes",
  Batteryville: "a rugged off-grid desert settlement with solar panels and wind turbines",
  "The Grid":   "a diesel-punk industrial wasteland of defunct refineries and oil derricks controlled by rival factions",
  "Glass City": "a cyberpunk neon megalopolis of glass skyscrapers — empty streets with no cars and no people, only neon reflections and drones",
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
  "Chef":         "wearing a white chef apron and tall chef hat, carrying a pot or pan, wearing kitchen non-slip shoes",
  "Olympic":      "in a dynamic athletic stance, wearing coordinated high-performance team apparel with sponsor patches",
  "Fash":         "standing upright in a sharp pressed uniform with necktie, jacket, lapels and coat-of-arms insignia",
};

const VIBE_BOARD: Record<string, string> = {
  Grunge:   "a worn, weathered",
  Neon:     "a glowing neon",
  Chrome:   "a sleek chrome",
  Plastic:  "a bright colourful plastic",
  Recycled: "a tattered DIY junk-built",
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
    "a tattered border made of dirty gauze bandages wrapped around the card edges, stained dark red with dried blood, fraying loose ends at the corners, rough textile texture, gritty street-medicine aesthetic",
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
    "a small glow-stick-lit satchel patched with neon tape",
    "a backpack covered in neon stickers and blinking LED strips",
    "a large crate spray-painted with blacklight-reactive graffiti",
    "a bulky duffel bag strung with glowsticks and neon cable ties",
  ],
  Batteryville: [
    "a patched canvas satchel decorated with hand-sewn solar-cell strips",
    "a rugged canvas survival pack bristling with utility pouches and carabiner clips",
    "a weathered wooden crate bound with salvaged wire and rope, marked with charcoal stencils",
    "a bulging military-surplus duffel bag packed with off-grid survival supplies",
  ],
  "The Grid": [
    "a small riveted metal canister stencilled with union insignia",
    "a heavy canvas pack with red faction patches and ration pouches",
    "a rusted iron cargo box stamped with industrial union seals",
    "a massive diesel-punk duffel bag bristling with tools and red armbands",
  ],
  "Glass City": [
    "a compact high-tech courier pod with LED status indicators",
    "a sleek tech backpack with solar-charging panels and sensor arrays",
    "a reinforced delivery crate with QR code seals and neon tape",
    "a heavy-duty cargo pack loaded with courier tech and neon signage",
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

/** Shared age-restriction phrase appended to all character prompts. */
const AGE_RESTRICTION = "No kids. No teens. Adults aged 18-99 only. ";

/**
 * Builds a prompt for the **background layer** of a card.
 *
 * The result focuses entirely on the district environment — no characters,
 * no people, no text — making it suitable for use as a compositable backdrop.
 * Changing the district regenerates only this prompt (and its layer image).
 */
export function buildBackgroundPrompt(district: District, graffitiWords?: string[]): string {
  const bg = DISTRICT_BACKGROUND_DESCRIPTIONS[district] ?? district;
  const graffitiLine = graffitiWords?.length
    ? `Graffiti tags on the walls and surfaces read '${graffitiWords.join("' and '")}' in bold spray paint. `
    : "";
  return (
    `Environment scene: ${bg}. ` +
    graffitiLine +
    `Wide establishing shot, cinematic composition, absolutely no people, no characters, no text. ` +
    `Trading card art in the style of 1995 Fleer Ultra X-Men, fantastic realism, airbrushed gouache texture, ` +
    `vibrant and saturated 90s digital colors, dramatic rim lighting. Hyper-Realistic sci-fi setting. ` +
    `SFW, family friendly, PG rated, LGBTQIA+.`
  );
}

/**
 * Builds a prompt for the **character layer** of a card.
 *
 * The character is rendered against a plain white background, which is then
 * stripped by the birefnet background-removal model to produce a transparent PNG
 * that composites cleanly over the background layer using CSS mix-blend-mode: normal.
 * The bag/package description is based on stamina alone — it does NOT depend
 * on the district, so the character layer is only regenerated when archetype,
 * style, vibe, or stamina changes (matching the `characterSeed` cache key).
 * Changing district or rarity leaves this layer untouched.
 */
export function buildCharacterPrompt(prompts: CardPrompts, graffitiWords?: string[]): string {
  const clothing  = STYLE_CLOTHING[prompts.style]    ?? prompts.style;
  const pose      = ARCHETYPE_POSES[prompts.archetype] ?? prompts.archetype;
  const board     = VIBE_BOARD[prompts.vibe]          ?? prompts.vibe;
  const mood      = RARITY_MOOD[prompts.rarity]       ?? "bold";
  const bagDesc   = characterBagDescription(prompts.stamina);
  const state     = staminaState(prompts.stamina);
  const graffitiLine = graffitiWords?.length
    ? `The skateboard deck and wheels feature graffiti tags or brand logos reading '${graffitiWords.join("' and '")}'. `
    : "";

  const genderDesc =
    prompts.gender === "Woman" ? "a woman" :
    prompts.gender === "Man"   ? "a man" :
    /* Non-binary */             "a non-binary person";

  const genderLine = `Character is ${genderDesc}. `;

  return (
    `Full-body portrait of a ${prompts.archetype} skater courier, ` +
    `facing directly toward the viewer, front-facing, looking at the camera, ` +
    `wearing ${clothing}, ${pose}, ` +
    `carrying ${bagDesc}, riding ${board} all-terrain electric skateboard with big off-road wheels, lights and gear. ` +
    graffitiLine +
    `Character is ${state}. ` +
    `Mood: ${mood}. ` +
    genderLine +
    AGE_RESTRICTION +
    `Isolated on a plain white background, full figure visible from head to toe, centred. ` +
    `Trading card art in the style of 1995 Fleer Ultra X-Men, fantastic realism, airbrushed gouache texture, ` +
    `vibrant and saturated 90s digital colors, dramatic rim lighting, realistic anatomy, chromium finish, ` +
    `epic action pose, 90s Marvel aesthetic, sharp focus, crisp details, high resolution. ` +
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
  const genderDesc =
    prompts.gender === "Woman" ? "a woman" :
    prompts.gender === "Man"   ? "a man" :
    /* Non-binary */             "a non-binary person";

  return (
    `A hyper-realistic 3D cartoon-style portrait of a ${prompts.archetype} skater courier ` +
    `facing directly toward the viewer, front-facing, looking at the camera, ` +
    `wearing ${clothing}, ${pose}, ` +
    `carrying ${bag}, riding ${board} all-terrain electric skateboard with big off-road wheels, lights and gear. ` +
    `The background is ${district}. ` +
    `Character is ${state}. Character is ${genderDesc}. ` +
    `Mood: ${mood}. Stamina ${prompts.stamina}/10. ` +
    AGE_RESTRICTION +
    `Rendered in Unreal Engine, vibrant colours, octane render, cinematic lighting, 4K. ` +
    `SFW, Family Friendly, PG rated, LGBTQIA+.`
  );
}
