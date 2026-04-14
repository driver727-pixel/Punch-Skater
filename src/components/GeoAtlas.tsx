import { useState } from "react";
import { DISTRICT_LORE } from "../lib/lore";
import type { District, RoadCorridor, WorldLocation } from "../lib/types";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import {
  DISTRICT_WEATHER_LOCATIONS,
  getDistrictAccessSummary,
  hasDistrictAccessRestriction,
} from "../lib/districtWeather";

export interface GeoAtlasMarker {
  id: string;
  district: District;
  label: string;
  title?: string;
  active?: boolean;
  offsetX?: number;
  offsetY?: number;
  onClick?: () => void;
}

export interface GeoAtlasCorridorMarker {
  id: string;
  corridor: RoadCorridor;
  label: string;
  title?: string;
  active?: boolean;
  offsetX?: number;
  offsetY?: number;
  onClick?: () => void;
}

interface GeoAtlasProps {
  compact?: boolean;
  className?: string;
  markers?: GeoAtlasMarker[];
  corridors?: GeoAtlasCorridorMarker[];
  /** Render only one section instead of both. Omit for the full two-section atlas. */
  section?: "australia" | "neon";
}

const AUSTRALIA_DISTRICT_LAYOUT: Record<WorldLocation, { x: number; y: number; tone: string }> = {
  Airaway: { x: 70, y: 58, tone: "sky" },
  Electropolis: { x: 78, y: 41, tone: "signal" },
  "Glass City": { x: 25, y: 67, tone: "glass" },
  "The Grid": { x: 67, y: 64, tone: "grid" },
  Batteryville: { x: 34, y: 36, tone: "industrial" },
  "The Roads": { x: 45, y: 57, tone: "roads" },
  Nightshade: { x: 67, y: 79, tone: "underground" },
  "The Forest": { x: 76, y: 25, tone: "wild" },
};

const DISTRICT_ARTERIES: Array<{
  from: WorldLocation;
  to: WorldLocation;
  label: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
}> = [
  { from: "Airaway", to: "Electropolis", label: "Skybridge Run", labelOffsetX: 4, labelOffsetY: -2 },
  { from: "Airaway", to: "The Grid", label: "Mag-Rail Spine", labelOffsetX: -5, labelOffsetY: -2 },
  { from: "Electropolis", to: "Glass City", label: "Transit Loop", labelOffsetX: 3, labelOffsetY: 2 },
  { from: "Electropolis", to: "The Roads", label: "Surface Corridor", labelOffsetY: -5 },
  { from: "The Grid", to: "Glass City", label: "Data Artery", labelOffsetX: 3, labelOffsetY: 4 },
  { from: "The Grid", to: "Batteryville", label: "Power Conduit", labelOffsetX: -6, labelOffsetY: 2 },
  { from: "Batteryville", to: "The Roads", label: "Freight Artery", labelOffsetX: -1, labelOffsetY: 5 },
  { from: "The Roads", to: "Nightshade", label: "Underpass Tunnel", labelOffsetX: -5, labelOffsetY: 4 },
  { from: "The Roads", to: "The Forest", label: "Timber Route", labelOffsetX: -6, labelOffsetY: -2 },
];

const WORLD_CONTINENTS = [
  {
    name: "North America",
    path: "M10 16 L15 9 L23 8 L29 12 L28 18 L25 22 L19 23 L14 27 L10 24 L8 19 Z",
    wire: ["M13 12 L24 19", "M16 9 L20 23", "M11 18 L27 14"],
  },
  {
    name: "South America",
    path: "M27 29 L32 33 L34 41 L32 51 L28 56 L25 49 L24 39 Z",
    wire: ["M29 31 L31 50", "M26 40 L33 43"],
  },
  {
    name: "Europe",
    path: "M44 11 L49 9 L54 11 L56 15 L51 18 L45 17 L42 14 Z",
    wire: ["M45 12 L54 15", "M48 9 L49 17"],
  },
  {
    name: "Africa",
    path: "M47 21 L53 23 L57 31 L55 43 L49 49 L45 41 L44 29 Z",
    wire: ["M48 23 L54 41", "M45 31 L56 30"],
  },
  {
    name: "Asia",
    path: "M56 10 L67 8 L80 13 L88 19 L84 27 L74 25 L69 30 L61 29 L56 22 Z",
    wire: ["M59 12 L80 21", "M62 28 L73 10", "M69 9 L68 29"],
  },
  {
    name: "Australia",
    path: "M75 37 L81 39 L86 43 L85 50 L79 53 L73 49 L71 43 Z",
    wire: ["M74 39 L84 47", "M77 38 L78 52", "M72 45 L85 44"],
    highlight: true,
  },
];

function getAtlasClassName(compact: boolean, className?: string) {
  return ["geo-atlas", compact ? "geo-atlas--compact" : "", className].filter(Boolean).join(" ");
}

function getAtlasNodeStatus(
  location: (typeof DISTRICT_LORE)[number],
  loading: boolean,
  weatherSummary: string | null,
): string {
  if (location.kind === "corridor") {
    return "Corridor event layer · route incidents resolve between hub missions.";
  }
  if (location.kind === "hidden") {
    return "Future reveal · no public mission or forge access yet.";
  }
  return weatherSummary ?? (loading ? "Syncing weather" : "Open weather");
}

export function GeoAtlas({ compact = false, className, markers = [], corridors = [], section }: GeoAtlasProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<WorldLocation | null>(null);
  const [isAustraliaCollapsed, setIsAustraliaCollapsed] = useState(false);
  const [isNeonCollapsed, setIsNeonCollapsed] = useState(false);
  const { weather, weatherByDistrict, loading, error } = useDistrictWeather();
  const districtEntries = DISTRICT_LORE.map((district) => ({
    ...district,
    layout: AUSTRALIA_DISTRICT_LAYOUT[district.name],
    slug: district.name.toLowerCase().replace(/\s+/g, "-"),
    weather: district.kind === "district" ? weatherByDistrict[district.name] : null,
    location: district.kind === "district" ? DISTRICT_WEATHER_LOCATIONS[district.name] : null,
  }));
  const weatherBadge = weather?.stale ? "weather cached" : "weather live";

  const showAustralia = !section || section === "australia";
  const showNeon = !section || section === "neon";

  return (
    <div className={getAtlasClassName(compact, className)}>
      {showAustralia && (
      <section className="geo-atlas__panel">
        <div className="geo-atlas__panel-head">
          <div>
            <p className="geo-atlas__eyebrow">continental theater</p>
            <h3 className="geo-atlas__title">Australia overmap</h3>
          </div>
          <div className="geo-atlas__panel-head-end">
            <span className="geo-atlas__badge">{weather ? weatherBadge : "coast to coast"}</span>
            <button
              type="button"
              className="geo-atlas__collapse-btn"
              onClick={() => setIsAustraliaCollapsed((v) => !v)}
              aria-expanded={!isAustraliaCollapsed}
              aria-label={isAustraliaCollapsed ? "Expand Australia overmap" : "Collapse Australia overmap"}
            >
              {isAustraliaCollapsed ? "▼" : "▲"}
            </button>
          </div>
        </div>
        {!isAustraliaCollapsed && (
          <>
        {!compact && (
          <p className="geo-atlas__body">
            Punch Skater now anchors its city-state across Australia, with districts as playable hubs,
            The Roads as corridor space, and Electropolis held back as a future reveal.
          </p>
        )}
        {!compact && (
          <p className="geo-atlas__status">
            {weather
              ? "Delayed real-world weather is seeding playable district access while corridor lines track their own hazards."
              : loading
                ? "Syncing district weather uplink."
                : error
                  ? "Weather uplink offline. Districts are staying on open access."
                  : "District weather telemetry is standing by."}
          </p>
        )}
        <div
          className="geo-atlas__map geo-atlas__map--australia"
          data-testid="australia-overmap"
          role="img"
          aria-label="Australia map showing Punch Skater district hubs and transit corridors"
        >
          <svg className="geo-atlas__svg" viewBox="0 0 100 100" aria-hidden="true">
            <path
              className="geo-atlas__continent-shape geo-atlas__continent-shape--australia"
              d="M15 27 L26 16 L43 14 L58 20 L74 24 L84 37 L86 52 L81 68 L74 83 L60 87 L47 84 L31 88 L20 79 L14 63 L12 45 Z"
            />
            <path
              className="geo-atlas__continent-shape geo-atlas__continent-shape--tasmania"
              d="M69 89 L72 91 L71 95 L67 95 L65 92 Z"
            />
            <path className="geo-atlas__mesh-line" d="M18 37 L72 29 L80 46 L74 78 L46 84 L22 72 L15 51 Z" />
            <path className="geo-atlas__mesh-line" d="M28 19 L32 56 L26 79" />
            <path className="geo-atlas__mesh-line" d="M44 15 L50 48 L47 84" />
            <path className="geo-atlas__mesh-line" d="M61 22 L60 56 L56 85" />
            <path className="geo-atlas__mesh-line" d="M20 61 L84 53" />
            <path className="geo-atlas__mesh-line" d="M24 28 L74 72" />
            <path className="geo-atlas__mesh-line" d="M73 28 L28 79" />
            {DISTRICT_ARTERIES.map((artery) => {
              const start = AUSTRALIA_DISTRICT_LAYOUT[artery.from];
              const end = AUSTRALIA_DISTRICT_LAYOUT[artery.to];
              const labelX = (start.x + end.x) / 2 + (artery.labelOffsetX ?? 0);
              const labelY = (start.y + end.y) / 2 - 2 + (artery.labelOffsetY ?? 0);

              const isConnected = hoveredDistrict === artery.from || hoveredDistrict === artery.to;
              const routeClass = [
                "geo-atlas__route",
                hoveredDistrict && isConnected ? "geo-atlas__route--highlight" : "",
                hoveredDistrict && !isConnected ? "geo-atlas__route--dim" : "",
              ].filter(Boolean).join(" ");

              return (
                <g key={`${artery.from}-${artery.to}`} className={routeClass}>
                  <line className="geo-atlas__route-line" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                  <text className="geo-atlas__route-label" x={labelX} y={labelY}>
                    {artery.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {districtEntries.map((district) => {
            const accessRestricted =
              district.kind === "district" && hasDistrictAccessRestriction(district.name, district.weather);
            const status =
              district.kind === "district"
                ? `${getAtlasNodeStatus(district, loading, district.weather?.summary ?? null)} · ${getDistrictAccessSummary(district.name, district.weather)}`
                : getAtlasNodeStatus(district, loading, null);

            return (
              <article
                key={district.name}
                className={`geo-atlas__district geo-atlas__district--${district.layout.tone}`}
                style={{ left: `${district.layout.x}%`, top: `${district.layout.y}%` }}
                data-testid={`district-node-${district.slug}`}
                onMouseEnter={() => setHoveredDistrict(district.name)}
                onMouseLeave={() => setHoveredDistrict(null)}
              >
                <span className="geo-atlas__district-name">{district.name}</span>
                <span className="geo-atlas__district-meta">
                  {district.crews[0]}{district.location ? ` · ${district.location.city}` : ""}
                </span>
                <span
                  className={`geo-atlas__district-weather${accessRestricted ? " geo-atlas__district-weather--restricted" : ""}`}
                >
                  {status}
                </span>
              </article>
            );
          })}

          {markers.map((marker) => {
            const layout = AUSTRALIA_DISTRICT_LAYOUT[marker.district];

            return (
              <button
                key={marker.id}
                type="button"
                className={`geo-atlas__marker${marker.active ? " geo-atlas__marker--active" : ""}`}
                style={{
                  left: `calc(${layout.x}% + ${marker.offsetX ?? 0}px)`,
                  top: `calc(${layout.y}% + ${marker.offsetY ?? 0}px)`,
                }}
                onClick={marker.onClick}
                aria-pressed={marker.active}
                title={marker.title ?? marker.label}
              >
                <span className="geo-atlas__marker-pin" aria-hidden="true">
                  📍
                </span>
                <span className="geo-atlas__marker-label">{marker.label}</span>
              </button>
            );
          })}

          {corridors.map((marker) => {
            const artery = DISTRICT_ARTERIES.find((route) => route.label === marker.corridor);
            if (!artery) {
              console.warn(
                `[GeoAtlas] Unknown corridor marker route: ${marker.corridor}. Add it to DISTRICT_ARTERIES or check the corridor ID for typos.`,
              );
              return null;
            }
            const start = AUSTRALIA_DISTRICT_LAYOUT[artery.from];
            const end = AUSTRALIA_DISTRICT_LAYOUT[artery.to];
            const left = (start.x + end.x) / 2;
            const top = (start.y + end.y) / 2;

            return (
              <button
                key={marker.id}
                type="button"
                className={`geo-atlas__marker${marker.active ? " geo-atlas__marker--active" : ""}`}
                style={{
                  left: `calc(${left}% + ${marker.offsetX ?? 0}px)`,
                  top: `calc(${top}% + ${marker.offsetY ?? 0}px)`,
                }}
                onClick={marker.onClick}
                aria-pressed={marker.active}
                title={marker.title ?? marker.label}
              >
                <span className="geo-atlas__marker-pin" aria-hidden="true">
                  🛣️
                </span>
                <span className="geo-atlas__marker-label">{marker.label}</span>
              </button>
            );
          })}
        </div>

        {!compact && (
          <ul className="geo-atlas__legend" aria-label="Arterial courier routes">
            {DISTRICT_ARTERIES.map((artery) => (
              <li key={`artery-${artery.from}-${artery.to}`} className="geo-atlas__legend-item">
                <span className="geo-atlas__legend-label">{artery.label}</span>
                <span className="geo-atlas__legend-path">{artery.from} → {artery.to}</span>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </section>
      )}

      {showNeon && (
      <section className="geo-atlas__panel">
        <div className="geo-atlas__panel-head">
          <div>
            <p className="geo-atlas__eyebrow">global frame</p>
            <h3 className="geo-atlas__title">Neon world map</h3>
          </div>
          <div className="geo-atlas__panel-head-end">
            <span className="geo-atlas__badge">Australia highlighted</span>
            <button
              type="button"
              className="geo-atlas__collapse-btn"
              onClick={() => setIsNeonCollapsed((v) => !v)}
              aria-expanded={!isNeonCollapsed}
              aria-label={isNeonCollapsed ? "Expand Neon world map" : "Collapse Neon world map"}
            >
              {isNeonCollapsed ? "▼" : "▲"}
            </button>
          </div>
        </div>
        {!isNeonCollapsed && (
          <>
        {!compact && (
          <p className="geo-atlas__body">
            A wireframe world scan establishes the larger planet while locking focus onto the
            Australian continent as the core stage for this society.
          </p>
        )}
        <div
          className="geo-atlas__map geo-atlas__map--world"
          data-testid="world-overmap"
          role="img"
          aria-label="Wireframe neon world map with Australia highlighted"
        >
          <svg className="geo-atlas__svg" viewBox="0 0 100 60" aria-hidden="true">
            {[12, 24, 36, 48].map((y) => (
              <line key={`lat-${y}`} className="geo-atlas__world-grid" x1="2" y1={y} x2="98" y2={y} />
            ))}
            {[16, 32, 48, 64, 80].map((x) => (
              <line key={`lng-${x}`} className="geo-atlas__world-grid" x1={x} y1="4" x2={x} y2="56" />
            ))}
            {WORLD_CONTINENTS.map((continent) => (
              <g key={continent.name}>
                <path
                  className={`geo-atlas__world-continent${continent.highlight ? " geo-atlas__world-continent--highlight" : ""}`}
                  d={continent.path}
                />
                {continent.wire.map((wire) => (
                  <path
                    key={`${continent.name}-${wire}`}
                    className={`geo-atlas__world-wire${continent.highlight ? " geo-atlas__world-wire--highlight" : ""}`}
                    d={wire}
                  />
                ))}
              </g>
            ))}
            <circle className="geo-atlas__world-target" cx="79" cy="45" r="7" />
            <circle className="geo-atlas__world-target" cx="79" cy="45" r="12" />
            <path className="geo-atlas__world-scan" d="M5 30 H95" />
          </svg>
          <div className="geo-atlas__world-callout">
            <span className="geo-atlas__world-callout-label">Primary zone</span>
            <strong className="geo-atlas__world-callout-title">Australia</strong>
          </div>
        </div>
          </>
        )}
      </section>
      )}
    </div>
  );
}
