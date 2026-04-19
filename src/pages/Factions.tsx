import { useState } from "react";
import { FACTION_LORE } from "../lib/lore";
import { useFactionDiscovery } from "../hooks/useFactionDiscovery";
import { useFactionImages } from "../hooks/useFactionImages";
import { factionSlug } from "../lib/factionSlug";

export function Factions() {
  const { discoveredFactions } = useFactionDiscovery();
  const factionImages = useFactionImages();
  const [expandedFactions, setExpandedFactions] = useState<Record<string, boolean>>({});
  const knownFactions = FACTION_LORE.filter((entry) => discoveredFactions.includes(entry.name));

  const toggleFaction = (name: string) => {
    setExpandedFactions((current) => ({
      ...current,
      [name]: !current[name],
    }));
  };

  return (
    <div className="page lore-page">
      <h1 className="page-title">FACTIONS</h1>
      <p className="page-sub">The crews you have actually uncovered through forging.</p>

      {knownFactions.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🕵️</span>
          <p>No factions discovered yet. Keep forging unusual combinations to surface hidden crews.</p>
        </div>
      ) : (
        <section className="lore-section">
          <h2 className="lore-heading">Known Factions</h2>
          <div className="lore-faction-list">
            {knownFactions.map((faction) => {
              const slug = factionSlug(faction.name);
              const imageUrl = factionImages.get(slug);
              const isExpanded = Boolean(expandedFactions[faction.name]);
              const detailsId = `faction-details-${slug}`;
              return (
                <div
                  key={faction.name}
                  className={`lore-faction-item${isExpanded ? " lore-faction-item--expanded" : ""}`}
                >
                  <button
                    type="button"
                    className="lore-faction-toggle"
                    onClick={() => toggleFaction(faction.name)}
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${faction.name} faction details`}
                  >
                    <div
                      className="lore-faction-media"
                      style={
                        imageUrl
                          ? {
                              backgroundImage: `url(${imageUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      <div className="lore-faction-img-overlay" />
                      <div className="lore-faction-content">
                        <div className="lore-faction-header">
                          <span className="lore-faction-name">{faction.name}</span>
                          <span className="lore-faction-districts">{faction.districts.join(" · ")}</span>
                        </div>
                        <p className="lore-tagline lore-tagline--sm">"{faction.tagline}"</p>
                        <span className="lore-faction-toggle-label">
                          {isExpanded ? "Hide intel ▲" : "Show intel ▼"}
                        </span>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div id={detailsId} className="lore-faction-details">
                      <p className="lore-body lore-body--sm">{faction.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
