import { useState } from "react";
import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { StatBar } from "./StatBar";
import { getDisplayedArchetype, getDisplayedCrew } from "../lib/cardIdentity";

interface PrintModalProps {
  card: CardPayload;
  backgroundImageUrl?: string;
  /** Full print-quality background URL (1536 × 2048 px). When provided, this
   *  is used in the hidden print-only area instead of backgroundImageUrl so the
   *  browser prints at the highest available resolution. */
  backgroundPrintUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  characterBlend?: number;
  onClose: () => void;
}

type PrintSide = "both" | "front" | "back";

const RARITY_COLORS: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice:     "#44ddaa",
  Master:         "#cc44ff",
  Rare:           "#4488ff",
  Legendary:      "#ffaa00",
};

/** Small crop-mark corners rendered outside the bleed box */
function BleedMarks() {
  return (
    <div className="print-bleed-marks" aria-hidden>
      <span className="print-bleed-corner print-bleed-corner--tl" />
      <span className="print-bleed-corner print-bleed-corner--tr" />
      <span className="print-bleed-corner print-bleed-corner--bl" />
      <span className="print-bleed-corner print-bleed-corner--br" />
    </div>
  );
}

export function PrintModal({
  card,
  backgroundImageUrl,
  backgroundPrintUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  onClose,
}: PrintModalProps) {
  const [side, setSide] = useState<PrintSide>("both");
  const accent = card.visuals.accentColor || "#00ff88";
  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";
  const hasAnyLayer = backgroundImageUrl || characterImageUrl || frameImageUrl;
  // Use the full print-quality background in the hidden printable area when available.
  const printBackgroundUrl = backgroundPrintUrl ?? backgroundImageUrl;

  const handlePrint = () => {
    window.print();
  };

  const handleSideChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSide(e.target.value as PrintSide);
  };

  return (
    <>
      {/* ── Screen UI ── */}
      <div className="modal-overlay print-modal-overlay" onClick={onClose}>
        <div className="modal-panel print-modal-panel" onClick={(e) => e.stopPropagation()}>
          <button className="close-btn modal-close" onClick={onClose}>✕</button>
          <h2 className="modal-title">🖨 Print Card</h2>
          <p className="modal-sub">
            Standard poker size · 2.5 × 3.5 in · 0.125 in bleed · flat, clean
          </p>

          {/* Side selector */}
          <div className="print-side-selector">
            {(["both", "front", "back"] as PrintSide[]).map((val) => (
              <label key={val} className="print-side-option">
                <input
                  type="radio"
                  name="print-side"
                  value={val}
                  checked={side === val}
                  onChange={handleSideChange}
                />
                {val === "both"  ? "Both Sides" : val === "front" ? "Front Only" : "Back Only"}
              </label>
            ))}
          </div>

          {/* Print preview */}
          <div className="print-preview-area">
            {/* Front preview */}
            <div className="print-preview-slot">
              <p className="print-preview-label">Front</p>
              <div className="print-card-wrap">
                <BleedMarks />
                <div className="print-card print-card--front" style={{ borderColor: rarityColor }}>
                  {hasAnyLayer ? (
                    <div className="print-art-composite">
                      {backgroundImageUrl && (
                        <img src={backgroundImageUrl} alt="background" className="print-art-layer print-art-layer--bg" />
                      )}
                      {characterImageUrl && (
                        <img
                          src={characterImageUrl}
                          alt="character"
                          className="print-art-layer print-art-layer--char"
                          style={characterBlend !== undefined ? { opacity: characterBlend } : undefined}
                        />
                      )}
                      {frameImageUrl && (
                        <img src={frameImageUrl} alt="frame" className="print-art-layer print-art-layer--frame" />
                      )}
                    </div>
                  ) : (
                    <CardArt card={card} width={189} height={264} />
                  )}
                </div>
              </div>
            </div>

            {/* Back preview */}
            <div className="print-preview-slot">
              <p className="print-preview-label">Back</p>
              <div className="print-card-wrap">
                <BleedMarks />
                <div
                  className="print-card print-card--back"
                  style={{ borderColor: rarityColor, "--accent": accent } as React.CSSProperties}
                >
                  <div className="print-back-header" style={{ background: rarityColor }}>
                    <span className="print-back-name">{card.identity.name}</span>
                    <span className="print-back-rarity">{card.prompts.rarity.toUpperCase()}</span>
                  </div>

                  {characterImageUrl && (
                    <img src={characterImageUrl} alt="portrait" className="print-back-portrait" />
                  )}

                  <div className="print-back-info">
                    {[
                      ["ARCHETYPE", getDisplayedArchetype(card)],
                      ["STYLE",     card.prompts.style],
                      ["VIBE",      card.prompts.vibe],
                      ["DISTRICT",  card.prompts.district],
                      ["CREW",      getDisplayedCrew(card)],
                      ["MFR",       card.identity.manufacturer],
                    ].map(([label, value]) => (
                      <div key={label} className="print-back-row">
                        <span className="print-back-row-label">{label}</span>
                        <span className="print-back-row-value">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="print-back-stats">
                    <StatBar label="SPD" value={card.stats.speed}   color={accent} />
                    <StatBar label="STL" value={card.stats.stealth} color={accent} />
                    <StatBar label="TCH" value={card.stats.tech}    color={accent} />
                    <StatBar label="GRT" value={card.stats.grit}    color={accent} />
                    <StatBar label="REP" value={card.stats.rep}     color={accent} />
                    <StatBar label="STA" value={card.stats.stamina} color={accent} />
                  </div>

                  <div className="print-back-trait">
                    <span className="print-back-trait-label">
                      PASSIVE · {card.traits.passiveTrait.name}
                    </span>
                    <p className="print-back-trait-desc">{card.traits.passiveTrait.description}</p>
                  </div>

                  <div className="print-back-trait">
                    <span className="print-back-trait-label">
                      ACTIVE · {card.traits.activeAbility.name}
                    </span>
                    <p className="print-back-trait-desc">{card.traits.activeAbility.description}</p>
                  </div>

                  <p className="print-back-flavor">&ldquo;{card.flavorText}&rdquo;</p>

                  <div className="print-back-tags">
                    {card.traits.personalityTags.map((t) => (
                      <span key={t} className="print-back-tag" style={{ borderColor: accent }}>{t}</span>
                    ))}
                  </div>

                  <div className="print-back-serial">{card.identity.serialNumber}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="print-modal-actions">
            <button className="btn-primary" onClick={handlePrint}>
              🖨 Print
            </button>
            <button className="btn-outline" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* ── Hidden printable area (only visible via @media print) ── */}
      <div className="print-only-area" aria-hidden>
        {side !== "back" && (
        <div className="print-only-card-wrap">
          <div className="print-only-bleed">
            <BleedMarks />
            <div className="print-only-card" style={{ borderColor: rarityColor }}>
              {hasAnyLayer ? (
                <div className="print-art-composite">
                  {printBackgroundUrl && (
                    <img src={printBackgroundUrl} alt="background" className="print-art-layer print-art-layer--bg" />
                  )}
                  {characterImageUrl && (
                    <img
                      src={characterImageUrl}
                      alt="character"
                      className="print-art-layer print-art-layer--char"
                      style={characterBlend !== undefined ? { opacity: characterBlend } : undefined}
                    />
                  )}
                  {frameImageUrl && (
                    <img src={frameImageUrl} alt="frame" className="print-art-layer print-art-layer--frame" />
                  )}
                </div>
              ) : (
                <CardArt card={card} width={675} height={945} />
              )}
            </div>
          </div>
        </div>
        )}

        {side !== "front" && (
        <div className="print-only-card-wrap">
          <div className="print-only-bleed">
            <BleedMarks />
            <div
              className="print-only-card print-only-card--back"
              style={{ borderColor: rarityColor, "--accent": accent } as React.CSSProperties}
            >
              <div className="print-back-header" style={{ background: rarityColor }}>
                <span className="print-back-name">{card.identity.name}</span>
                <span className="print-back-rarity">{card.prompts.rarity.toUpperCase()}</span>
              </div>

              {characterImageUrl && (
                <img src={characterImageUrl} alt="portrait" className="print-back-portrait" />
              )}

              <div className="print-back-info">
                {[
                  ["ARCHETYPE", card.prompts.archetype],
                  ["STYLE",     card.prompts.style],
                  ["VIBE",      card.prompts.vibe],
                  ["DISTRICT",  card.prompts.district],
                  ["CREW",      card.identity.crew],
                  ["MFR",       card.identity.manufacturer],
                ].map(([label, value]) => (
                  <div key={label} className="print-back-row">
                    <span className="print-back-row-label">{label}</span>
                    <span className="print-back-row-value">{value}</span>
                  </div>
                ))}
              </div>

              <div className="print-back-stats">
                <StatBar label="SPD" value={card.stats.speed}   color={accent} />
                <StatBar label="STL" value={card.stats.stealth} color={accent} />
                <StatBar label="TCH" value={card.stats.tech}    color={accent} />
                <StatBar label="GRT" value={card.stats.grit}    color={accent} />
                <StatBar label="REP" value={card.stats.rep}     color={accent} />
                <StatBar label="STA" value={card.stats.stamina} color={accent} />
              </div>

              <div className="print-back-trait">
                <span className="print-back-trait-label">
                  PASSIVE · {card.traits.passiveTrait.name}
                </span>
                <p className="print-back-trait-desc">{card.traits.passiveTrait.description}</p>
              </div>

              <div className="print-back-trait">
                <span className="print-back-trait-label">
                  ACTIVE · {card.traits.activeAbility.name}
                </span>
                <p className="print-back-trait-desc">{card.traits.activeAbility.description}</p>
              </div>

              <p className="print-back-flavor">&ldquo;{card.flavorText}&rdquo;</p>

              <div className="print-back-tags">
                {card.traits.personalityTags.map((t) => (
                  <span key={t} className="print-back-tag" style={{ borderColor: accent }}>{t}</span>
                ))}
              </div>

              <div className="print-back-serial">{card.identity.serialNumber}</div>
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
}
