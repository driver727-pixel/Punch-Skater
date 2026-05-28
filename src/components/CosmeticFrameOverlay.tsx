import { normalizeCosmeticFrameId } from "../lib/cosmeticFrames";

interface CosmeticFrameOverlayProps {
  frameId?: string;
  className?: string;
}

export function CosmeticFrameOverlay({ frameId, className = "" }: CosmeticFrameOverlayProps) {
  const normalized = normalizeCosmeticFrameId(frameId);
  if (!normalized) return null;
  return (
    <div
      className={`cosmetic-frame-overlay cosmetic-frame-overlay--${normalized}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    />
  );
}
