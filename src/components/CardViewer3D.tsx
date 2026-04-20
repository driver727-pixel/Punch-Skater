import { useEffect, useRef, useState, useCallback } from "react";
import type { CardPayload } from "../lib/types";
import { PrintedCardBackContent, PrintedCardFrontContent } from "./PrintedCardFaces";

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

export function CardViewer3D({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  inline = false,
  onClose,
}: CardViewer3DProps) {
  const [rotateX, setRotateX] = useState(-5);
  const [rotateY, setRotateY] = useState(15);
  const [autoSpin, setAutoSpin] = useState(false);

  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spinRef = useRef<number | null>(null);

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

  const scene = (
    <div className={`viewer3d-scene${inline ? " viewer3d-scene--inline" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div
        className="viewer3d-card"
        style={{ transform: cardTransform }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onMouseUp}
      >
        <div className="viewer3d-face viewer3d-face--front print-card print-card--front">
          <PrintedCardFrontContent
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
          <PrintedCardBackContent card={card} />
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
    >
      {scene}
    </div>
  );
}
