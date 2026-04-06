import { useEffect, useRef, useState, useCallback } from "react";
import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { StatBar } from "./StatBar";

interface CardViewer3DProps {
  card: CardPayload;
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  characterBlend?: number;
  onClose: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice:     "#44ddaa",
  Master:         "#cc44ff",
  Rare:           "#4488ff",
  Legendary:      "#ffaa00",
};

export function CardViewer3D({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  onClose,
}: CardViewer3DProps) {
  const [rotateX, setRotateX] = useState(-5);
  const [rotateY, setRotateY] = useState(15);
  const [autoSpin, setAutoSpin] = useState(false);

  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spinRef = useRef<number | null>(null);

  const accent = card.visuals.accentColor || "#00ff88";
  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";

  const hasAnyLayer = backgroundImageUrl || characterImageUrl || frameImageUrl;

  // ── Close on Escape ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Auto-spin ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoSpin) {
      const tick = () => {
        setRotateY((y) => y + 0.6);
        spinRef.current = requestAnimationFrame(tick);
      };
      spinRef.current = requestAnimationFrame(tick);
    } else {
      if (spinRef.current !== null) cancelAnimationFrame(spinRef.current);
    }
    return () => { if (spinRef.current !== null) cancelAnimationFrame(spinRef.current); };
  }, [autoSpin]);

  // ── Mouse drag ───────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (autoSpin) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [autoSpin]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setRotateY((y) => y + dx * 0.5);
    setRotateX((x) => Math.max(-45, Math.min(45, x - dy * 0.5)));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // ── Touch drag ───────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (autoSpin) return;
    dragging.current = true;
    const t = e.touches[0];
    lastPos.current = { x: t.clientX, y: t.clientY };
  }, [autoSpin]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const t = e.touches[0];
    const dx = t.clientX - lastPos.current.x;
    const dy = t.clientY - lastPos.current.y;
    lastPos.current = { x: t.clientX, y: t.clientY };
    setRotateY((y) => y + dx * 0.5);
    setRotateX((x) => Math.max(-45, Math.min(45, x - dy * 0.5)));
  }, []);

  // ── Flip ─────────────────────────────────────────────────────────────────────
  const handleFlip = () => {
    setAutoSpin(false);
    setRotateY((y) => y + 180);
  };

  const handleAutoSpin = () => {
    setAutoSpin((v) => !v);
  };

  const cardTransform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  return (
    <div
      className="viewer3d-overlay"
      onClick={onClose}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div className="viewer3d-scene" onClick={(e) => e.stopPropagation()}>
        {/* Card 3D object */}
        <div
          className="viewer3d-card"
          style={{ transform: cardTransform }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        >
          {/* ── Front face ── */}
          <div className="viewer3d-face viewer3d-face--front" style={{ borderColor: rarityColor }}>
            {hasAnyLayer ? (
              <div className="viewer3d-art-composite">
                {backgroundImageUrl && (
                  <img src={backgroundImageUrl} alt="background" className="viewer3d-layer viewer3d-layer--bg" />
                )}
                {characterImageUrl && (
                  <img
                    src={characterImageUrl}
                    alt="character"
                    className="viewer3d-layer viewer3d-layer--char"
                    style={characterBlend !== undefined ? { opacity: characterBlend } : undefined}
                  />
                )}
                {frameImageUrl && (
                  <img src={frameImageUrl} alt="frame" className="viewer3d-layer viewer3d-layer--frame" />
                )}
              </div>
            ) : (
              <div className="viewer3d-art-svg">
                <CardArt card={card} width={252} height={352} />
              </div>
            )}
            {/* Gloss overlay */}
            <div className="viewer3d-gloss" />
          </div>

          {/* ── Back face ── */}
          <div
            className="viewer3d-face viewer3d-face--back"
            style={{ borderColor: rarityColor, "--accent": accent } as React.CSSProperties}
          >
            {/* Back-face header */}
            <div className="viewer3d-back-header" style={{ background: rarityColor }}>
              <span className="viewer3d-back-name">{card.identity.name}</span>
              <span className="viewer3d-back-rarity">{card.prompts.rarity}</span>
            </div>

            {/* Portrait thumbnail */}
            {characterImageUrl && (
              <img src={characterImageUrl} alt="portrait" className="viewer3d-back-portrait" />
            )}

            {/* Info rows */}
            <div className="viewer3d-back-info">
              {[
                ["ARCHETYPE", card.prompts.archetype],
                ["STYLE",     card.prompts.style],
                ["VIBE",      card.prompts.vibe],
                ["DISTRICT",  card.prompts.district],
                ["CREW",      card.identity.crew],
                ["MFR",       card.identity.manufacturer],
              ].map(([label, value]) => (
                <div key={label} className="viewer3d-back-row">
                  <span className="viewer3d-back-row-label">{label}</span>
                  <span className="viewer3d-back-row-value">{value}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="viewer3d-back-stats">
              <StatBar label="SPD" value={card.stats.speed}   color={accent} />
              <StatBar label="STL" value={card.stats.stealth} color={accent} />
              <StatBar label="TCH" value={card.stats.tech}    color={accent} />
              <StatBar label="GRT" value={card.stats.grit}    color={accent} />
              <StatBar label="REP" value={card.stats.rep}     color={accent} />
              <StatBar label="STA" value={card.stats.stamina} color={accent} />
            </div>

            {/* Passive trait */}
            <div className="viewer3d-back-trait">
              <span className="viewer3d-back-trait-label">PASSIVE · {card.traits.passiveTrait.name}</span>
              <p className="viewer3d-back-trait-desc">{card.traits.passiveTrait.description}</p>
            </div>

            {/* Active ability */}
            <div className="viewer3d-back-trait">
              <span className="viewer3d-back-trait-label">ACTIVE · {card.traits.activeAbility.name}</span>
              <p className="viewer3d-back-trait-desc">{card.traits.activeAbility.description}</p>
            </div>

            {/* Flavor text */}
            <p className="viewer3d-back-flavor">&ldquo;{card.flavorText}&rdquo;</p>

            {/* Tags */}
            <div className="viewer3d-back-tags">
              {card.traits.personalityTags.map((t) => (
                <span key={t} className="viewer3d-back-tag" style={{ borderColor: accent }}>{t}</span>
              ))}
            </div>

            {/* Serial */}
            <div className="viewer3d-back-serial">{card.identity.serialNumber}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="viewer3d-controls">
          <button className="viewer3d-btn" onClick={handleFlip} title="Flip card">
            ⟲ Flip
          </button>
          <button
            className={`viewer3d-btn${autoSpin ? " viewer3d-btn--active" : ""}`}
            onClick={handleAutoSpin}
            title="Toggle auto-spin"
          >
            ◎ Spin
          </button>
          <button className="viewer3d-btn" onClick={onClose} title="Close 3D viewer">
            ✕ Close
          </button>
        </div>

        <p className="viewer3d-hint">{autoSpin ? "Click Spin to stop" : "Drag to rotate · Flip to see card back"}</p>
      </div>
    </div>
  );
}
