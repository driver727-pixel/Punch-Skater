import { useState } from "react";
import { generateImage, removeBackground } from "../services/imageGen";
import { BOARD_COMPONENT_CATALOG } from "../lib/boardBuilder";

// ── Download helper ────────────────────────────────────────────────────────────

/** Delay in ms before revoking a blob object URL after triggering a download. */
const OBJECT_URL_REVOKE_DELAY_MS = 15_000;

async function downloadAssetImage(imageUrl: string, seedKey: string): Promise<void> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${seedKey}.png`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
}

// ── Prompt template ────────────────────────────────────────────────────────────

const ASSET_COMPONENT_DESCRIPTIONS: Record<string, string> = {
  "front-truck":
    "A standalone electric skateboard front truck: anodized aluminum hanger and baseplate, precision kingpin and bushings, no motors or belts, clean machined finish.",
  "deck-carbon-street-drop-through":
    "A matte black carbon fiber street deck, showing subtle woven texture. Top-mount profile with standard mounting holes. High-detail finish.",
  "deck-bamboo-at-top-mount":
    "A light-grain bamboo all-terrain deck, showing clear wood grain texture and light grip tape. High concave shape for stability.",
  "deck-off-grid-mountain-board":
    "A rugged, thick composite mountainboard deck with aggressive concave. Foot straps visible. Textured grip.",
  "deck-swallowtail-surf-skate":
    "A wide, bamboo surf-skate deck with a distinctive notched swallowtail design. Single-fin graphical detail (e.g., stylized wave). Clear grip tape showing wood.",
  "wheel-100mm-urethane-street":
    "A set of four 100mm solid black polyurethane street wheels. Precision-machined metal core/hub visible. 80A durometer texture.",
  "wheel-175mm-pneumatic-at":
    "A set of four 175mm rugged pneumatic all-terrain rubber wheels, each with a deep knobby tread pattern and a 5-spoke black plastic hub.",
  "wheel-120mm-cloud-sliders":
    "A set of four 120mm translucent blue specialized 'cloud' wheels with an integrated honeycomb suspension pattern visible in the sidewall.",
  "drivetrain-dual-belt-drive":
    "A full rear-drive truck assembly: 300mm aluminum trucks, two large black electric motors (6374 size), dual timing belts, and motor mounts. Raw metal finish.",
  "drivetrain-sealed-gear-drive":
    "A high-performance rear-drive system: 300mm CNC-machined aluminum trucks with two large, fully enclosed matte black sealed gearboxes.",
  "drivetrain-stealth-hub-motors":
    "A rear-drive system: 300mm matte black street trucks where the electric motors are completely integrated and sealed inside the wheel cores (no visible gears/belts).",
  "battery-slim-stealth-pack":
    "A long, flat, ultra-low profile lithium-ion battery pack enclosure made of textured black plastic. Integrated charging port and power switch visible.",
  "battery-double-stack-brick":
    "A massive, thick, dual-layered (double-stack) block-style battery enclosure for high range. Rugged aluminum heat-sink fins visible on the surface.",
  "battery-top-mounted-peli-case":
    "A specific, yellow 'Pelican' case style (Peli-Case) top-mounted battery enclosure. Heavy-duty construction, rugged latches, and handle visible.",
  "motor-micro-5055":
    "A small 5055-class brushless outrunner motor for electric skateboards. Compact cylindrical form, exposed stator windings, 8mm shaft, lightweight anodized aluminum housing.",
  "motor-standard-6354":
    "A mid-range 6354-class brushless motor for electric skateboards. Black anodized cylindrical body, visible sensor wires, balanced size for commuter boards.",
  "motor-torque-6374":
    "A large 6374-class high-torque brushless motor. Chunky cylindrical housing, heavy gauge phase wires, brass bullet connectors, industrial finish.",
  "motor-outrunner-6396":
    "An oversized 6396-class outrunner brushless motor with cooling fins. Massive cylindrical housing, thick phase wires, race-grade engineering.",
};

function buildAssetPrompt(seedKey: string, fallbackDescription: string): string {
  const componentDescription = ASSET_COMPONENT_DESCRIPTIONS[seedKey] ?? fallbackDescription;
  return (
    `A high-fidelity product photograph of ${componentDescription} on a transparent background. ` +
    `PERSPECTIVE: Isometric 45-degree downward camera angle (3/4 top-down view). ` +
    `ORIENTATION: Object centered in frame, rotated exactly 45 degrees around the Y-axis, pointing toward the upper-right corner. ` +
    `LIGHTING: Consistent soft studio lighting from the top-right, creating a subtle rim light and a soft contact shadow beneath the object. ` +
    `STYLE: Realistic textures (metal, wood, rubber), sharp focus, no text or watermarks. No brand logo.`
  );
}

// ── Data model rows ────────────────────────────────────────────────────────────

interface AssetItem {
  category: string;
  label: string;
  seedKey: string;
  prompt: string;
}

function buildAssetItems(): AssetItem[] {
  return BOARD_COMPONENT_CATALOG.map((model) => ({
    category: model.category,
    label: `${model.icon} ${model.name}`,
    seedKey: model.seedKey,
    prompt: buildAssetPrompt(model.seedKey, model.description),
  }));
}

const ALL_ITEMS = buildAssetItems();

const IRREGULAR_PLURALS: Record<string, string> = {
  Battery: "Batteries",
};

function pluralizeCategory(cat: string): string {
  return IRREGULAR_PLURALS[cat] ?? (cat.endsWith("s") ? cat : `${cat}s`);
}

// ── Component state ────────────────────────────────────────────────────────────

type ItemStatus = "idle" | "generating" | "removing-bg" | "done" | "error";

interface ItemState {
  status: ItemStatus;
  imageUrl?: string;
  error?: string;
}

export function AssetGenerator() {
  const [states, setStates] = useState<Record<string, ItemState>>(
    Object.fromEntries(ALL_ITEMS.map((i) => [i.seedKey, { status: "idle" }]))
  );
  const [runningAll, setRunningAll] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  function setItemState(seedKey: string, patch: Partial<ItemState>) {
    setStates((prev) => ({
      ...prev,
      [seedKey]: { ...prev[seedKey], ...patch },
    }));
  }

  async function generateOne(item: AssetItem) {
    setItemState(item.seedKey, { status: "generating", imageUrl: undefined, error: undefined });
    try {
      const raw = await generateImage(item.prompt, item.seedKey, {
        imageSize: "square_hd",
        loras: [],
      });
      setItemState(item.seedKey, { status: "removing-bg" });
      const transparent = await removeBackground(raw.imageUrl);
      setItemState(item.seedKey, { status: "done", imageUrl: transparent.imageUrl });
    } catch (err) {
      setItemState(item.seedKey, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function generateAll() {
    setRunningAll(true);
    for (const item of ALL_ITEMS) {
      await generateOne(item);
    }
    setRunningAll(false);
  }

  async function downloadOne(item: AssetItem) {
    const url = states[item.seedKey]?.imageUrl;
    if (!url) return;
    setDownloading((prev) => ({ ...prev, [item.seedKey]: true }));
    try {
      await downloadAssetImage(url, item.seedKey);
    } finally {
      setDownloading((prev) => ({ ...prev, [item.seedKey]: false }));
    }
  }

  async function downloadAll() {
    const doneItems = ALL_ITEMS.filter((i) => states[i.seedKey]?.status === "done");
    for (const item of doneItems) {
      await downloadOne(item);
    }
  }

  const doneCount = ALL_ITEMS.filter((i) => states[i.seedKey]?.status === "done").length;
  const loadingCount = ALL_ITEMS.filter(
    (i) => states[i.seedKey]?.status === "generating" || states[i.seedKey]?.status === "removing-bg",
  ).length;

  const categories = Array.from(new Set(ALL_ITEMS.map((i) => i.category)));

  return (
    <div className="page asset-gen-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎨 Asset Generator</h1>
          <p className="page-sub">
            Dev tool — generates green-screen board component images via fal.ai.
            Click <strong>⬇ Download</strong> on any image to save it to{" "}
            <code>public/assets/boards/</code> with the correct filename.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="asset-gen-counter">
            {doneCount} / {ALL_ITEMS.length} done
          </span>
          {doneCount > 0 && (
            <button
              className="btn-outline"
              onClick={downloadAll}
              disabled={runningAll || loadingCount > 0}
            >
              ⬇ Download All
            </button>
          )}
          <button
            className="btn-primary"
            onClick={generateAll}
            disabled={runningAll || loadingCount > 0}
          >
            {runningAll ? "⏳ Generating…" : "⚡ Generate All"}
          </button>
        </div>
      </div>

      {categories.map((cat) => {
        const catItems = ALL_ITEMS.filter((i) => i.category === cat);
        return (
          <section key={cat} className="asset-gen-section">
            <h2 className="asset-gen-section-title">{pluralizeCategory(cat)}</h2>
            <div className="asset-gen-grid">
              {catItems.map((item) => {
                const state = states[item.seedKey];
                return (
                  <div key={item.seedKey} className="asset-gen-card">
                    <div className="asset-gen-card-label">{item.label}</div>

                    <div className="asset-gen-preview">
                      {state.status === "idle" && (
                        <span className="asset-gen-placeholder">No image yet</span>
                      )}
                      {state.status === "generating" && (
                        <span className="asset-gen-spinner">⏳ Generating…</span>
                      )}
                      {state.status === "removing-bg" && (
                        <span className="asset-gen-spinner">✂️ Removing background…</span>
                      )}
                      {state.status === "done" && state.imageUrl && (
                        <img
                          src={state.imageUrl}
                          alt={item.label}
                          className="asset-gen-img"
                          title={`${item.seedKey}.png`}
                        />
                      )}
                      {state.status === "error" && (
                        <span className="asset-gen-error" title={state.error}>
                          ✗ Error
                        </span>
                      )}
                    </div>

                    <div className="asset-gen-card-actions">
                      <button
                        className="btn-outline"
                        onClick={() => generateOne(item)}
                        disabled={state.status === "generating" || state.status === "removing-bg" || runningAll}
                        title={item.prompt}
                      >
                        {state.status === "generating"
                          ? "⏳ Generating…"
                          : state.status === "removing-bg"
                          ? "✂️ Removing BG…"
                          : state.status === "done"
                          ? "↺ Regenerate"
                          : "▶ Generate"}
                      </button>
                      {state.status === "done" && state.imageUrl && (
                        <button
                          className="btn-primary"
                          onClick={() => downloadOne(item)}
                          disabled={!!downloading[item.seedKey]}
                          title={`Save as ${item.seedKey}.png`}
                        >
                          {downloading[item.seedKey] ? "⏳ Saving…" : "⬇ Download"}
                        </button>
                      )}
                      {state.status === "error" && (
                        <span className="asset-gen-error-msg">{state.error}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
