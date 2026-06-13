import { useState } from "react";
import {
  WORLD_LORE,
  DISTRICT_LORE,
  ARCHETYPE_LORE,
  LORE_UPDATES,
} from "../lib/lore";
import { GeoAtlas } from "../components/GeoAtlas";
import { DistrictBadge } from "../components/DistrictBadge";
import { CODEX_CIPHER_CHALLENGE, CRAFTLINGUA_ENABLED } from "../lib/craftlingua";

export function Lore() {
  const [cipherGuess, setCipherGuess] = useState("");
  const [cipherSolved, setCipherSolved] = useState(false);

  return (
    <div className="page lore-page">
      <h1 className="page-title">CODEX</h1>
      <p className="page-sub">The world of Punch Skater™ — districts, archetypes, crews, and the Australian setting that houses them.</p>

      {/* ── World Overview ──────────────────────────────────────────────── */}
      <section className="lore-section">
        <h2 className="lore-heading">The City</h2>
        <div className="lore-world-card">
          <p className="lore-body">{WORLD_LORE.summary}</p>
          <div className="lore-world-cols">
            <div>
              <h3 className="lore-subheading">Known Power Blocs</h3>
              <ul className="lore-list">
                {WORLD_LORE.factions.map((faction) => (
                  <li key={faction} className="lore-list-item">{faction}</li>
                ))}
              </ul>
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
        <GeoAtlas districtInteractionMode="press" />
      </section>

      {/* ── Districts / corridors ───────────────────────────────────────── */}
      <section className="lore-section">
        <h2 className="lore-heading">Districts, Corridors &amp; Reveals</h2>
        <p className="lore-body">
          The Roads operate as a separate corridor gameplay layer where route-specific threats and
          travel events erupt between district runs.
        </p>
        <div className="lore-grid">
          {DISTRICT_LORE.filter((district) => district.kind !== "hidden").map((d) => (
            <div key={d.name} className="lore-card">
              <div className="lore-card-header">
                <DistrictBadge location={d.name} size="sm" />
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
        <p className="lore-body lore-body--sm">
          Classified note: Electropolis remains intentionally sealed from the public district grid
          until the Fuzz pushes the next reveal into open play.
        </p>
      </section>

      <section className="lore-section">
        <h2 className="lore-heading">Courier Archetypes</h2>
        <div className="lore-grid">
          {ARCHETYPE_LORE.map((archetype) => (
            <div key={archetype.name} className="lore-card">
              <div className="lore-card-header">
                <span className="lore-card-name">{archetype.name}</span>
                <span className="lore-card-control">Courier school</span>
              </div>
              <p className="lore-tagline">"{archetype.tagline}"</p>
              <p className="lore-body">{archetype.description}</p>
              <div className="lore-card-meta">
                <span className="lore-meta-label">Strength profile</span>
                <span className="lore-meta-value">{archetype.strengths}</span>
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
          <ul className="lore-list">
            <li className="lore-list-item">The Codex keeps the macro world-state public.</li>
            <li className="lore-list-item">The Factions tab tracks only the crews you have actually uncovered.</li>
            <li className="lore-list-item">Recent discoveries stay aligned with the live forge and current narrative canon.</li>
          </ul>
        </div>
      </section>

      <section className="lore-section">
        <h2 className="lore-heading">Codex Cipher Challenge</h2>
        <div className="lore-world-card lore-world-card--challenge">
          <p className="lore-body">{CODEX_CIPHER_CHALLENGE.prompt}</p>
          <div className="lore-card-meta">
            <span className="lore-meta-label">District language</span>
            <span className="lore-meta-value">Cipher Mesh</span>
          </div>
          <div className="lore-card-meta">
            <span className="lore-meta-label">Cipher text</span>
            <span className="lore-meta-value">{CODEX_CIPHER_CHALLENGE.translatedCipherText}</span>
          </div>
          {CRAFTLINGUA_ENABLED && (
            <div className="lore-language-actions">
              <a
                className="btn-outline btn-sm"
                href={`https://craftlingua.app/share/${CODEX_CIPHER_CHALLENGE.shareCode}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open language shard ↗
              </a>
            </div>
          )}
          <form
            className="account-form lore-cipher-form"
            onSubmit={(e) => {
              e.preventDefault();
              setCipherSolved(cipherGuess.trim().toLowerCase() === CODEX_CIPHER_CHALLENGE.englishAnswer);
            }}
          >
            <div className="form-group">
              <label>Decoded answer</label>
              <input
                className="input"
                type="text"
                value={cipherGuess}
                onChange={(e) => {
                  setCipherGuess(e.target.value);
                  setCipherSolved(false);
                }}
                placeholder="Type the courier object"
              />
            </div>
            <button className="btn-primary btn-sm" type="submit">Check Answer</button>
          </form>
          {cipherSolved ? (
            <p className="login-success">Decoded. The stash marker means "{CODEX_CIPHER_CHALLENGE.englishAnswer}".</p>
          ) : (
            <p className="lore-body lore-body--sm">{CODEX_CIPHER_CHALLENGE.loreNote}</p>
          )}
        </div>
      </section>

      <section className="lore-section">
        <h2 className="lore-heading">Recent Codex Revisions</h2>
        <div className="lore-grid">
          {LORE_UPDATES.map((update) => (
            <div key={`${update.changedAt}-${update.title}`} className="lore-card">
              <div className="lore-card-header">
                <span className="lore-card-name">{update.title}</span>
                <span className="lore-card-control">{update.changedAt}</span>
              </div>
              <p className="lore-body">{update.summary}</p>
              <ul className="lore-list">
                {update.highlights.map((highlight) => (
                  <li key={highlight} className="lore-list-item">{highlight}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
