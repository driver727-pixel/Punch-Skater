import {
  WORLD_LORE,
  DISTRICT_LORE,
} from "../lib/lore";
import { GeoAtlas } from "../components/GeoAtlas";

export function Lore() {
  return (
    <div className="page lore-page">
      <h1 className="page-title">CODEX</h1>
      <p className="page-sub">The world of Punch Skater — districts, archetypes, crews, and the Australian setting that houses them.</p>

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
        <h2 className="lore-heading">Australia Theater Map</h2>
        <GeoAtlas />
      </section>

      {/* ── Districts / corridors ───────────────────────────────────────── */}
      <section className="lore-section">
        <h2 className="lore-heading">Districts, Corridors &amp; Reveals</h2>
        <p className="lore-body">
          The Roads operate as a separate corridor gameplay layer, while Electropolis stays a future
          playable reveal even though it already exists in the world fiction.
        </p>
        <div className="lore-grid">
          {DISTRICT_LORE.map((d) => (
            <div key={d.name} className="lore-card">
              <div className="lore-card-header">
                <span className="lore-card-name">{d.name}</span>
                <span className="lore-card-control">{d.controlledBy}</span>
              </div>
              <p className="lore-tagline">"{d.tagline}"</p>
              <p className="lore-body">{d.description}</p>
              <div className="lore-card-meta">
                <span className="lore-meta-label">Australian analogue</span>
                <span className="lore-meta-value">{d.australianAnalogue}</span>
              </div>
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
