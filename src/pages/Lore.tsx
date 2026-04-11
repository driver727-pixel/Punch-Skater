import {
  WORLD_LORE,
  DISTRICT_LORE,
} from "../lib/lore";
import type { District } from "../lib/types";

const DISTRICT_MAP_LAYOUT: Record<District, { x: number; y: number; tone: string }> = {
  Airaway: { x: 50, y: 13, tone: "sky" },
  Electropolis: { x: 74, y: 31, tone: "signal" },
  "Glass City": { x: 79, y: 67, tone: "glass" },
  "The Grid": { x: 57, y: 44, tone: "grid" },
  Batteryville: { x: 43, y: 67, tone: "industrial" },
  "The Roads": { x: 29, y: 48, tone: "roads" },
  Nightshade: { x: 23, y: 77, tone: "underground" },
  "The Forest": { x: 13, y: 29, tone: "wild" },
};

const DISTRICT_ARTERIES: Array<{
  from: District;
  to: District;
  label: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
}> = [
  { from: "Airaway", to: "Electropolis", label: "Skybridge Run", labelOffsetX: 3, labelOffsetY: -1 },
  { from: "Airaway", to: "The Grid", label: "Mag-Rail Spine", labelOffsetX: -5, labelOffsetY: -1 },
  { from: "Electropolis", to: "Glass City", label: "Transit Loop", labelOffsetX: 2, labelOffsetY: 2 },
  { from: "Electropolis", to: "The Roads", label: "Surface Corridor", labelOffsetY: -4 },
  { from: "The Grid", to: "Glass City", label: "Data Artery", labelOffsetX: 2, labelOffsetY: 4 },
  { from: "The Grid", to: "Batteryville", label: "Power Conduit", labelOffsetX: -6, labelOffsetY: 1 },
  { from: "Batteryville", to: "The Roads", label: "Freight Artery", labelOffsetX: -1, labelOffsetY: 4 },
  { from: "The Roads", to: "Nightshade", label: "Underpass Tunnel", labelOffsetX: -5, labelOffsetY: 4 },
  { from: "The Roads", to: "The Forest", label: "Timber Route", labelOffsetX: -6, labelOffsetY: -1 },
];

export function Lore() {
  const districtEntries = DISTRICT_LORE.map((district) => ({
    ...district,
    layout: DISTRICT_MAP_LAYOUT[district.name],
    slug: district.name.toLowerCase().replace(/\s+/g, "-"),
  }));

  return (
    <div className="page lore-page">
      <h1 className="page-title">CODEX</h1>
      <p className="page-sub">The world of Punch Skater — districts, archetypes, crews, and the City that connects them.</p>

      {/* ── World Overview ──────────────────────────────────────────────── */}
      <section className="lore-section">
        <h2 className="lore-heading">The City</h2>
        <div className="lore-world-card">
          <p className="lore-body">{WORLD_LORE.summary}</p>
          <div className="lore-world-cols">
            <div>
              <h3 className="lore-subheading">Known Power Blocs</h3>
              <p className="lore-body">
                The city is crowded with corporate governments, courier unions, insurgent crews,
                and shadow actors. Specific faction dossiers now stay obscured until you uncover
                them through forging.
              </p>
            </div>
            <div>
              <h3 className="lore-subheading">The Code</h3>
              <ol className="lore-list lore-list--ordered">
                {WORLD_LORE.code.map((rule) => (
                  <li key={rule} className="lore-list-item">{rule}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="lore-section">
        <h2 className="lore-heading">City Map</h2>
        <div className="lore-world-card lore-world-card--map">
          <p className="lore-body">
            First-pass 2D district layout for the City. The highlighted arteries mark the
            main courier routes linking the districts, from Airaway&apos;s skybridges to
            Nightshade&apos;s tunnel runs.
          </p>
          <div
            className="lore-map"
            data-testid="district-map"
            role="img"
            aria-label="2D city district map showing districts connected by courier arteries"
          >
            <svg className="lore-map-routes" viewBox="0 0 100 100" aria-hidden="true">
              {DISTRICT_ARTERIES.map((artery) => {
                const start = DISTRICT_MAP_LAYOUT[artery.from];
                const end = DISTRICT_MAP_LAYOUT[artery.to];
                const labelX = (start.x + end.x) / 2 + (artery.labelOffsetX ?? 0);
                const labelY = (start.y + end.y) / 2 - 2 + (artery.labelOffsetY ?? 0);

                return (
                  <g key={`${artery.from}-${artery.to}`} className="lore-map-route">
                    <line
                      className="lore-map-line"
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                    />
                    <text className="lore-map-line-label" x={labelX} y={labelY}>
                      {artery.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {districtEntries.map((district) => (
              <article
                key={district.name}
                className={`lore-map-node lore-map-node--${district.layout.tone}`}
                style={{ left: `${district.layout.x}%`, top: `${district.layout.y}%` }}
                data-testid={`district-node-${district.slug}`}
              >
                <span className="lore-map-node-name">{district.name}</span>
                <span className="lore-map-node-meta">{district.crews[0]}</span>
              </article>
            ))}
          </div>

          <ul className="lore-map-arteries" aria-label="Arterial courier routes">
            {DISTRICT_ARTERIES.map((artery) => (
              <li key={`artery-${artery.from}-${artery.to}`} className="lore-map-artery">
                <span className="lore-map-artery-label">{artery.label}</span>
                <span className="lore-map-artery-path">{artery.from} → {artery.to}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Districts ───────────────────────────────────────────────────── */}
      <section className="lore-section">
        <h2 className="lore-heading">Districts</h2>
        <div className="lore-grid">
          {districtEntries.map((d) => (
            <div key={d.name} className="lore-card">
              <div className="lore-card-header">
                <span className="lore-card-name">{d.name}</span>
                <span className="lore-card-control">{d.controlledBy}</span>
              </div>
              <p className="lore-tagline">"{d.tagline}"</p>
              <p className="lore-body">{d.description}</p>
              <div className="lore-card-meta">
                <span className="lore-meta-label">Atmosphere</span>
                <span className="lore-meta-value">{d.atmosphere}</span>
              </div>
              <div className="lore-card-meta">
                <span className="lore-meta-label">Known Crews</span>
                <span className="lore-meta-value">{d.crews.join(", ")}</span>
              </div>
              <div className="lore-flavor-pool">
                {d.flavorTexts.map((t) => (
                  <blockquote key={t} className="lore-flavor">{t}</blockquote>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Factions / Crews ────────────────────────────────────────────── */}
      <section className="lore-section">
        <h2 className="lore-heading">Crews &amp; Factions</h2>
        <div className="lore-world-card">
          <p className="lore-body">
            Faction dossiers are now hidden behind discoveries in the Card Forge.
            When a forged combination trips a secret signal, a new entry appears in the
            Factions tab with its full lore profile.
          </p>
        </div>
      </section>
    </div>
  );
}
