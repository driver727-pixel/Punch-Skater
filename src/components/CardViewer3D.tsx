import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CardPayload } from "../lib/types";
import { PrintedCardBackContent, PrintedCardFrontContent } from "./PrintedCardFaces";

const VIEWER_CARD_WIDTH = 189;
const VIEWER_CARD_HEIGHT = 264;
const VIEWER_PERSPECTIVE = 900;

function getProjectedCardCenterY(rotateX: number, rotateY: number) {
  const rotateXRad = (rotateX * Math.PI) / 180;
  const rotateYRad = (rotateY * Math.PI) / 180;
  const halfWidth = VIEWER_CARD_WIDTH / 2;
  const halfHeight = VIEWER_CARD_HEIGHT / 2;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  // The card transform is rotateX(...) rotateY(...), which CSS applies
  // right-to-left, so we project each corner after a Y rotation followed by X.
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [-halfHeight, halfHeight]) {
      const zAfterYRotation = -x * Math.sin(rotateYRad);
      const yAfterXRotation = y * Math.cos(rotateXRad) - zAfterYRotation * Math.sin(rotateXRad);
      const zAfterXRotation = y * Math.sin(rotateXRad) + zAfterYRotation * Math.cos(rotateXRad);
      const perspectiveScale = VIEWER_PERSPECTIVE / (VIEWER_PERSPECTIVE - zAfterXRotation);
      const screenY = yAfterXRotation * perspectiveScale;

      minY = Math.min(minY, screenY);
      maxY = Math.max(maxY, screenY);
    }
  }

  return (minY + maxY) / 2;
}

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
  const maxTiltX = inline ? 28 : 35;

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
    setRotateX((x) => Math.max(-maxTiltX, Math.min(maxTiltX, x - dy * 0.5)));
  }, [maxTiltX]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

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

  const frontCenterY = useMemo(() => getProjectedCardCenterY(rotateX, 0), [rotateX]);
  const anchorOffsetY = useMemo(
    () => frontCenterY - getProjectedCardCenterY(rotateX, rotateY),
    [frontCenterY, rotateX, rotateY],
  );

  const cardTransform = `translateY(${anchorOffsetY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  const scene = (
    <div className={`viewer3d-scene${inline ? " viewer3d-scene--inline" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className={`viewer3d-stage${inline ? " viewer3d-stage--inline" : ""}`}>
        <div
          className="viewer3d-card"
          style={{ transform: cardTransform }}
          onMouseDown={onMouseDown}
          onDragStart={(e) => e.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
          onTouchCancel={onMouseUp}
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
