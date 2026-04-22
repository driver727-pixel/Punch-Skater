import { useEffect, useRef, useState, useCallback } from "react";
import type { CardPayload } from "../lib/types";
import { SkaterCardFace } from "./SkaterCardFace";
import { buildCardVars } from "../lib/cardVars";

interface CardViewer3DBaseProps {
  card: CardPayload;
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  characterBlend?: number;
}

type CardViewer3DProps =
  | (CardViewer3DBaseProps & { inline: true; onClose?: () => void })
  | (CardViewer3DBaseProps & { inline?: false; onClose: () => void });

const NEUTRAL_X = -5;
const NEUTRAL_Y = 15;
const HOVER_TILT = 15; // ± degrees from card center during hover

export function CardViewer3D({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  inline = false,
  onClose,
}: CardViewer3DProps) {
  const [rotateX, setRotateX] = useState(NEUTRAL_X);
  const [rotateY, setRotateY] = useState(NEUTRAL_Y);
  const [autoSpin, setAutoSpin] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const maxTiltX = inline ? 28 : 35;

  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spinRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Cache getBoundingClientRect to avoid forced layout reflow on every mousemove.
  const cardRectRef = useRef<DOMRect | null>(null);

  // Refresh the cached rect on window resize so the tilt origin stays accurate.
  useEffect(() => {
    const updateRect = () => {
      if (cardRef.current) cardRectRef.current = cardRef.current.getBoundingClientRect();
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, []);

  // ── Close on Escape ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
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
    // Entering drag mode: disable hover tilt so there's no CSS transition lag.
    setIsHovering(false);
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [autoSpin]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      // Manual drag — accumulate deltas as before.
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setRotateY((y) => y + dx * 0.5);
      setRotateX((x) => Math.max(-maxTiltX, Math.min(maxTiltX, x - dy * 0.5)));
      return;
    }

    if (autoSpin || !cardRectRef.current) return;

    // Hover tilt — map cursor offset from card center to ±HOVER_TILT degrees.
    const rect = cardRectRef.current;
    const offsetX = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2); // -1..1
    const offsetY = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2); // -1..1
    setRotateY(NEUTRAL_Y + offsetX * HOVER_TILT);
    setRotateX(NEUTRAL_X - offsetY * HOVER_TILT);
    setIsHovering(true);
  }, [autoSpin, maxTiltX]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // ── Hover leave — smooth reset to neutral ────────────────────────────────────
  const onMouseLeave = useCallback(() => {
    if (dragging.current || autoSpin) return;
    setRotateX(NEUTRAL_X);
    setRotateY(NEUTRAL_Y);
    setIsHovering(false);
  }, [autoSpin]);

  // ── Touch drag ───────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (autoSpin) return;
    e.preventDefault();
    dragging.current = true;
    const t = e.touches[0];
    lastPos.current = { x: t.clientX, y: t.clientY };
  }, [autoSpin]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - lastPos.current.x;
    const dy = t.clientY - lastPos.current.y;
    lastPos.current = { x: t.clientX, y: t.clientY };
    setRotateY((y) => y + dx * 0.5);
    setRotateX((x) => Math.max(-maxTiltX, Math.min(maxTiltX, x - dy * 0.5)));
  }, [maxTiltX]);

  // ── Flip ─────────────────────────────────────────────────────────────────────
  const handleFlip = () => {
    setAutoSpin(false);
    setRotateY((y) => y + 180);
  };

  const handleAutoSpin = () => {
    setAutoSpin((v) => !v);
  };

  const cardTransform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  const cardVars = buildCardVars(card, "3d");

  // .is-tilting adds a smooth transition during hover; it's absent while
  // dragging so there's no input lag during manual rotation.
  const cardClassName = `viewer3d-card${isHovering && !dragging.current ? " is-tilting" : ""}`;

  const scene = (
    <div className={`viewer3d-scene${inline ? " viewer3d-scene--inline" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className={`viewer3d-stage${inline ? " viewer3d-stage--inline" : ""}`}>
        <div
          ref={cardRef}
          className={cardClassName}
          style={{ ...cardVars, transform: cardTransform }}
          onMouseEnter={() => { if (cardRef.current) cardRectRef.current = cardRef.current.getBoundingClientRect(); }}
          onMouseDown={onMouseDown}
          onDragStart={(e) => e.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
          onTouchCancel={onMouseUp}
        >
          <div className="viewer3d-face viewer3d-face--front print-card print-card--front">
            <SkaterCardFace
              face="front"
              card={card}
              backgroundImageUrl={backgroundImageUrl}
              characterImageUrl={characterImageUrl}
              frameImageUrl={frameImageUrl}
              characterBlend={characterBlend}
            />
          </div>

          <div
            className="viewer3d-face viewer3d-face--back print-card print-card--back"
            style={{ "--accent": card.visuals.accentColor || "#00ff88" } as React.CSSProperties}
          >
            <SkaterCardFace face="back" card={card} />
          </div>
        </div>
      </div>

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
        {!inline && onClose && (
          <button className="viewer3d-btn" onClick={onClose} title="Close 3D viewer">
            ✕ Close
          </button>
        )}
      </div>

      <p className="viewer3d-hint">{autoSpin ? "Click Spin to stop" : "Drag to rotate · Flip to see card back"}</p>
    </div>
  );

  if (inline) {
    return (
      <div
        className="viewer3d-inline"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {scene}
      </div>
    );
  }

  return (
    <div
      className="viewer3d-overlay"
      onClick={() => onClose?.()}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {scene}
    </div>
  );
}

