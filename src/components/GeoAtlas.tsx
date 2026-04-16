import { useMemo, useState, type CSSProperties } from "react";
import type { BoardConfig } from "../lib/boardBuilder";
import { DISTRICT_LORE } from "../lib/lore";
import type { District, RoadCorridor, WorldLocation } from "../lib/types";
import { useDistrictWeather } from "../hooks/useDistrictWeather";
import {
  DISTRICT_WEATHER_LOCATIONS,
  getDistrictAccessBlockReason,
  getDistrictAccessSummary,
  hasDistrictAccessRestriction,
  isDistrictAccessibleWithBoardType,
} from "../lib/districtWeather";

export interface GeoAtlasMarker {
  id: string;
  district: District;
  label: string;
  title?: string;
  active?: boolean;
  tone?: "available" | "blocked";
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
  tone?: "available" | "blocked";
  offsetX?: number;
  offsetY?: number;
  onClick?: () => void;
}

interface GeoAtlasProps {
  compact?: boolean;
  className?: string;
  markers?: GeoAtlasMarker[];
  corridors?: GeoAtlasCorridorMarker[];
  boardConfig?: BoardConfig | null;
  selectedDistrict?: District | null;
  onDistrictSelect?: (district: District) => void;
  /** Render only one section instead of both. Omit for the full two-section atlas. */
  section?: "australia" | "neon";
  showMarkerLabels?: "all" | "active";
  focusDistricts?: WorldLocation[];
  focusCorridors?: RoadCorridor[];
  districtInteractionMode?: "hover" | "press";
}

const PLAYABLE_DISTRICTS: District[] = [
  "Airaway",
  "Batteryville",
  "The Grid",
  "Nightshade",
  "The Forest",
  "Glass City",
];

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
  color: string;
  shadowColor: string;
  /** Optional via waypoint for subway-style orthogonal routing. When set the
   *  path goes: start → via (with a rounded elbow) → end. */
  via?: { x: number; y: number };
}> = [
  {
    from: "Airaway",
    to: "The Grid",
    label: "Mag-Rail Spine",
    color: "#00ffb4",
    shadowColor: "rgba(0, 255, 180, 0.72)",
    via: { x: 70, y: 64 },
  },
  {
    from: "The Grid",
    to: "Glass City",
    label: "Data Artery",
    color: "#9a7dff",
    shadowColor: "rgba(154, 125, 255, 0.7)",
    via: { x: 25, y: 64 },
  },
  {
    from: "The Grid",
    to: "Batteryville",
    label: "Power Conduit",
    color: "#ff8b3d",
    shadowColor: "rgba(255, 139, 61, 0.72)",
    via: { x: 67, y: 36 },
  },
  {
    from: "Batteryville",
    to: "The Roads",
    label: "Freight Artery",
    color: "#7cf57d",
    shadowColor: "rgba(124, 245, 125, 0.68)",
    via: { x: 45, y: 36 },
  },
  {
    from: "The Roads",
    to: "Nightshade",
    label: "Underpass Tunnel",
    color: "#c86bff",
    shadowColor: "rgba(200, 107, 255, 0.68)",
  },
  {
    from: "The Roads",
    to: "The Forest",
    label: "Timber Route",
    color: "#8bffce",
    shadowColor: "rgba(139, 255, 206, 0.68)",
    via: { x: 45, y: 25 },
  },
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

function formatBoardConfigLabel(boardConfig: BoardConfig | null | undefined) {
  if (!boardConfig) return null;
  return [boardConfig.boardType, boardConfig.drivetrain, boardConfig.wheels, boardConfig.battery].join(" · ");
}

function getDistrictWeatherSummary(params: {
  district: District;
  weatherSummary: string | null;
  city?: string;
  state?: string;
  loading: boolean;
  error: string | null;
}) {
  const { district, weatherSummary, city, state, loading, error } = params;
  if (weatherSummary && city && state) {
    return `${weatherSummary} over ${city}, ${state}.`;
  }
  if (loading) {
    return "Delayed weather uplink is syncing.";
  }
  if (error) {
    return "Weather uplink offline. District access is staying open until fresh telemetry returns.";
  }
  return `No live weather seed is active for ${district}.`;
}

/** Lerps a single coordinate from `from` toward `to` by factor `t` (0–1). */
function interp(from: number, to: number, t: number): string {
  return (from + (to - from) * t).toFixed(2);
}

/**
 * Generates a subway-style SVG path between two points. When a `via` waypoint
 * is provided, the line travels in two straight legs (horizontal/vertical or
 * diagonal) with a smooth quadratic-bezier elbow at the turn. Without a `via`
 * point the path is a direct straight line — suitable for near-45° diagonals
 * that already read as clean subway segments.
 */
function getRoutePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  via?: { x: number; y: number },
): string {
  if (!via) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  // Place the bezier split points 30% of the way from the elbow toward each
  // terminal so the corner is sharp but not a hard kink.
  const t = 0.3;
  const p1x = interp(via.x, start.x, t);
  const p1y = interp(via.y, start.y, t);
  const p2x = interp(via.x, end.x, t);
  const p2y = interp(via.y, end.y, t);
  return `M ${start.x} ${start.y} L ${p1x} ${p1y} Q ${via.x} ${via.y} ${p2x} ${p2y} L ${end.x} ${end.y}`;
}

export function GeoAtlas({
  compact = false,
  className,
  markers = [],
  corridors = [],
  boardConfig,
  selectedDistrict = null,
  onDistrictSelect,
  section,
  showMarkerLabels = "all",
  focusDistricts = [],
  focusCorridors = [],
  districtInteractionMode = "hover",
}: GeoAtlasProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<WorldLocation | null>(null);
  const [inspectedDistrict, setInspectedDistrict] = useState<WorldLocation | null>(null);
  const [isAustraliaCollapsed, setIsAustraliaCollapsed] = useState(false);
  const [isNeonCollapsed, setIsNeonCollapsed] = useState(false);
  const { weather, weatherByDistrict, loading, error } = useDistrictWeather();
  const activeInteractionDistrict =
    districtInteractionMode === "hover"
      ? hoveredDistrict ?? inspectedDistrict
      : inspectedDistrict;
  const focusDistrictSet = new Set(focusDistricts);
  const focusCorridorSet = new Set(focusCorridors);
  const hasFocus = focusDistrictSet.size > 0 || focusCorridorSet.size > 0;
  const districtEntries = useMemo(
    () =>
      DISTRICT_LORE.map((entry) => ({
        ...entry,
        layout: AUSTRALIA_DISTRICT_LAYOUT[entry.name],
        slug: entry.name.toLowerCase().replace(/\s+/g, "-"),
        weather: entry.kind === "district" ? weatherByDistrict[entry.name] ?? null : null,
        location: entry.kind === "district" ? DISTRICT_WEATHER_LOCATIONS[entry.name] : null,
      })),
    [weatherByDistrict],
  );
  const { activeDistrictEntry } = useMemo(() => {
    const hoveredDistrictEntry = districtEntries.find((entry) => entry.name === activeInteractionDistrict) ?? null;
    const selectedDistrictEntry =
      districtEntries.find((entry) => entry.kind === "district" && entry.name === selectedDistrict) ?? null;
    const defaultDistrictEntry =
      districtEntries.find((entry) => entry.kind === "district" && entry.name === "Glass City") ?? null;

    return {
      activeDistrictEntry: hoveredDistrictEntry ?? selectedDistrictEntry ?? defaultDistrictEntry,
    };
  }, [activeInteractionDistrict, districtEntries, selectedDistrict]);
  const boardStatusLabel = formatBoardConfigLabel(boardConfig);
  const rideableDistrictCount = boardConfig
    ? PLAYABLE_DISTRICTS.filter((district) =>
        isDistrictAccessibleWithBoardType(
          district,
          weatherByDistrict[district] ?? null,
          boardConfig.boardType,
          boardConfig.wheels,
        ),
      ).length
    : null;
  const inspectionCopy = activeDistrictEntry
    ? activeDistrictEntry.kind === "district"
      ? {
          name: activeDistrictEntry.name,
          weatherSummary: getDistrictWeatherSummary({
            district: activeDistrictEntry.name,
            weatherSummary: activeDistrictEntry.weather?.summary ?? null,
            city: activeDistrictEntry.location?.city,
            state: activeDistrictEntry.location?.state,
            loading,
            error,
          }),
          accessSummary: getDistrictAccessSummary(activeDistrictEntry.name, activeDistrictEntry.weather),
          accessBlocked: boardConfig
            ? !isDistrictAccessibleWithBoardType(
                activeDistrictEntry.name,
                activeDistrictEntry.weather,
                boardConfig.boardType,
                boardConfig.wheels,
              )
            : false,
          accessReason: boardConfig
            ? getDistrictAccessBlockReason(
                activeDistrictEntry.name,
                activeDistrictEntry.weather,
                boardConfig.boardType,
                boardConfig.wheels,
              )
            : null,
        }
      : {
          name: activeDistrictEntry.name,
          weatherSummary: "Corridor exchange hub connecting district routes.",
          accessSummary: "road corridors",
          accessBlocked: false,
          accessReason: null,
        }
    : null;
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
              <h3 className="geo-atlas__title">The Continental Australian overmap</h3>
            </div>
            <div className="geo-atlas__panel-head-end">
              <span className="geo-atlas__badge">{weather ? weatherBadge : "coast to coast"}</span>
              <button
                type="button"
                className="geo-atlas__collapse-btn"
                onClick={() => setIsAustraliaCollapsed((value) => !value)}
                aria-expanded={!isAustraliaCollapsed}
                aria-label={isAustraliaCollapsed ? "Expand Australia overmap" : "Collapse Australia overmap"}
              >
                {isAustraliaCollapsed ? "▼" : "▲"}
              </button>
            </div>
          </div>
          {!isAustraliaCollapsed && (
            <>
              <div className="geo-atlas__callout">
                <p className="geo-atlas__callout-copy">
                  Delayed real-world weather updates control live district access, so the overmap shows which skateboard
                  setups can ride each district while the current weather seed is active.
                </p>
                <div className="geo-atlas__callout-meta">
                  <span className="geo-atlas__callout-pill">
                    {boardStatusLabel
                      ? `Selected setup · ${boardStatusLabel}`
                      : districtInteractionMode === "press"
                        ? "Tap or click a district to inspect access"
                        : "Hover a district to inspect access"}
                  </span>
                  {rideableDistrictCount !== null && (
                    <span className="geo-atlas__callout-pill">
                      {rideableDistrictCount}/{PLAYABLE_DISTRICTS.length} districts rideable now
                    </span>
                  )}
                </div>
                {inspectionCopy && (
                  <div
                    className={`geo-atlas__inspection${inspectionCopy.accessBlocked ? " geo-atlas__inspection--blocked" : ""}`}
                  >
                    <strong className="geo-atlas__inspection-title">{inspectionCopy.name}</strong>
                    <span className="geo-atlas__inspection-body">
                      {inspectionCopy.weatherSummary} Access now: {inspectionCopy.accessSummary}.
                      {activeDistrictEntry?.kind === "district" &&
                        (inspectionCopy.accessBlocked && inspectionCopy.accessReason
                          ? ` Current setup blocked: ${inspectionCopy.accessReason}`
                          : boardConfig
                            ? " Current setup can ride this district."
                            : "")}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="geo-atlas__map geo-atlas__map--australia"
                data-testid="australia-overmap"
                role="img"
                aria-label="The Continental Australian overmap showing Punch Skater district hubs and subway corridors"
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
                  {DISTRICT_ARTERIES.map((artery) => {
                    const start = AUSTRALIA_DISTRICT_LAYOUT[artery.from];
                    const end = AUSTRALIA_DISTRICT_LAYOUT[artery.to];
                    const isConnected =
                      activeInteractionDistrict === artery.from || activeInteractionDistrict === artery.to;
                    const isFocused = focusCorridorSet.has(artery.label as RoadCorridor);
                    const routeClass = [
                      "geo-atlas__route",
                      hasFocus && isFocused ? "geo-atlas__route--focus" : "",
                      activeInteractionDistrict && isConnected ? "geo-atlas__route--highlight" : "",
                      (hasFocus && !isFocused) || (activeInteractionDistrict && !isConnected) ? "geo-atlas__route--dim" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <g
                        key={`${artery.from}-${artery.to}`}
                        className={routeClass}
                        style={
                          {
                            "--route-color": artery.color,
                            "--route-shadow-color": artery.shadowColor,
                          } as CSSProperties
                        }
                      >
                        <path
                          className="geo-atlas__route-casing"
                          d={getRoutePath(start, end, artery.via)}
                        />
                        <path
                          className="geo-atlas__route-line"
                          d={getRoutePath(start, end, artery.via)}
                        />
                      </g>
                    );
                  })}
                  {districtEntries
                    .filter((d) => d.kind !== "hidden")
                    .map((district) => (
                      <circle
                        key={`station-${district.name}`}
                        className={`geo-atlas__station geo-atlas__station--${district.layout.tone}`}
                        cx={district.layout.x}
                        cy={district.layout.y}
                        r="2"
                        aria-hidden="true"
                      />
                    ))}
                </svg>

                {districtEntries.filter((district) => district.kind !== "hidden").map((district) => {
                  const accessRestricted =
                    district.kind === "district" && hasDistrictAccessRestriction(district.name, district.weather);
                  const boardAccessible =
                    boardConfig && district.kind === "district"
                      ? isDistrictAccessibleWithBoardType(
                          district.name,
                          district.weather,
                          boardConfig.boardType,
                          boardConfig.wheels,
                        )
                      : null;
                  const detailText =
                    district.kind === "district"
                      ? `${district.name}. ${getDistrictWeatherSummary({
                          district: district.name,
                          weatherSummary: district.weather?.summary ?? null,
                          city: district.location?.city,
                          state: district.location?.state,
                          loading,
                          error,
                        })} Access now: ${getDistrictAccessSummary(district.name, district.weather)}.`
                      : `${district.name}. Corridor exchange hub.`;
                  const isInspectable =
                    districtInteractionMode === "press" || (district.kind === "district" && Boolean(onDistrictSelect));
                  const nodeClassName = [
                     "geo-atlas__district",
                     `geo-atlas__district--${district.layout.tone}`,
                     district.kind === "district" && selectedDistrict === district.name ? "geo-atlas__district--selected" : "",
                     boardAccessible === true ? "geo-atlas__district--available" : "",
                     boardAccessible === false ? "geo-atlas__district--blocked" : "",
                     accessRestricted ? "geo-atlas__district--restricted" : "",
                     isInspectable ? "geo-atlas__district--inspectable" : "",
                     district.kind === "district" && onDistrictSelect ? "geo-atlas__district--selectable" : "",
                     hasFocus && !focusDistrictSet.has(district.name) ? "geo-atlas__district--dim" : "",
                   ]
                     .filter(Boolean)
                     .join(" ");
                  const inspectDistrict = () => setInspectedDistrict(district.name);
                  const commonProps = {
                     className: nodeClassName,
                     style: { left: `${district.layout.x}%`, top: `${district.layout.y}%` },
                     "data-testid": `district-node-${district.slug}`,
                     onMouseEnter:
                       districtInteractionMode === "hover" ? () => setHoveredDistrict(district.name) : undefined,
                     onMouseLeave:
                       districtInteractionMode === "hover" ? () => setHoveredDistrict(null) : undefined,
                     onFocus: inspectDistrict,
                     title: detailText,
                   };

                  if (isInspectable) {
                    return (
                      <button
                        key={district.name}
                        type="button"
                        {...commonProps}
                        onClick={() => {
                          inspectDistrict();
                          if (district.kind === "district" && onDistrictSelect) {
                            onDistrictSelect(district.name);
                          }
                        }}
                        aria-pressed={selectedDistrict === district.name || activeInteractionDistrict === district.name}
                        aria-label={detailText}
                      >
                        <span className="geo-atlas__district-dot" aria-hidden="true" />
                        <span className="geo-atlas__district-name">{district.name}</span>
                      </button>
                    );
                  }

                  return (
                    <div key={district.name} {...commonProps} aria-label={detailText}>
                      <span className="geo-atlas__district-dot" aria-hidden="true" />
                      <span className="geo-atlas__district-name">{district.name}</span>
                    </div>
                  );
                })}

                {markers.map((marker) => {
                  const layout = AUSTRALIA_DISTRICT_LAYOUT[marker.district];

                  return (
                    <button
                      key={marker.id}
                      type="button"
                      className={[
                        "geo-atlas__marker",
                        marker.active ? "geo-atlas__marker--active" : "",
                        marker.tone ? `geo-atlas__marker--${marker.tone}` : "",
                        hasFocus && !marker.active && !focusDistrictSet.has(marker.district) ? "geo-atlas__marker--dim" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        left: `calc(${layout.x}% + ${marker.offsetX ?? 0}px)`,
                        top: `calc(${layout.y}% + ${marker.offsetY ?? 0}px)`,
                      }}
                      onClick={marker.onClick}
                      aria-pressed={marker.active}
                      aria-label={marker.title ?? marker.label}
                      title={marker.title ?? marker.label}
                    >
                      <span className="geo-atlas__marker-pin" aria-hidden="true">
                        📍
                      </span>
                      {(showMarkerLabels === "all" || marker.active) && (
                        <span className="geo-atlas__marker-label">{marker.label}</span>
                      )}
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
                      className={[
                        "geo-atlas__marker",
                        marker.active ? "geo-atlas__marker--active" : "",
                        marker.tone ? `geo-atlas__marker--${marker.tone}` : "",
                        hasFocus && !marker.active && !focusCorridorSet.has(marker.corridor)
                          ? "geo-atlas__marker--dim"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        left: `calc(${left}% + ${marker.offsetX ?? 0}px)`,
                        top: `calc(${top}% + ${marker.offsetY ?? 0}px)`,
                      }}
                      onClick={marker.onClick}
                      aria-pressed={marker.active}
                      aria-label={marker.title ?? marker.label}
                      title={marker.title ?? marker.label}
                    >
                      <span className="geo-atlas__marker-pin" aria-hidden="true">
                        🛣️
                      </span>
                      {(showMarkerLabels === "all" || marker.active) && (
                        <span className="geo-atlas__marker-label">{marker.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!compact && (
                <ul className="geo-atlas__legend" aria-label="Arterial courier routes">
                  {DISTRICT_ARTERIES.map((artery) => (
                    <li key={`artery-${artery.from}-${artery.to}`} className="geo-atlas__legend-item">
                      <span
                        className="geo-atlas__legend-line"
                        style={{ "--route-color": artery.color } as CSSProperties}
                        aria-hidden="true"
                      />
                      <div className="geo-atlas__legend-copy">
                        <span className="geo-atlas__legend-label">{artery.label}</span>
                        <span className="geo-atlas__legend-path">
                          {artery.from} → {artery.to}
                        </span>
                      </div>
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
                onClick={() => setIsNeonCollapsed((value) => !value)}
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
                  A wireframe world scan establishes the larger planet while locking focus onto the Australian
                  continent as the core stage for this society.
                </p>
              )}
              <div
                className="geo-atlas__map geo-atlas__map--world"
                data-testid="world-overmap"
                role="img"
                aria-label="Wireframe neon world map with Australia highlighted"
              >
                <svg className="geo-atlas__svg" viewBox="0 0 100 60" aria-hidden="true">
                  {[12, 24, 36, 48].map((yCoord) => (
                    <line key={`lat-${yCoord}`} className="geo-atlas__world-grid" x1="2" y1={yCoord} x2="98" y2={yCoord} />
                  ))}
                  {[16, 32, 48, 64, 80].map((xCoord) => (
                    <line key={`lng-${xCoord}`} className="geo-atlas__world-grid" x1={xCoord} y1="4" x2={xCoord} y2="56" />
                  ))}
                  {WORLD_CONTINENTS.map((continent) => (
                    <g key={continent.name}>
                      <path
                        className={`geo-atlas__world-continent${
                          continent.highlight ? " geo-atlas__world-continent--highlight" : ""
                        }`}
                        d={continent.path}
                      />
                      {continent.wire.map((wire) => (
                        <path
                          key={`${continent.name}-${wire}`}
                          className={`geo-atlas__world-wire${
                            continent.highlight ? " geo-atlas__world-wire--highlight" : ""
                          }`}
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
