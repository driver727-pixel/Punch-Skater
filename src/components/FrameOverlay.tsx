import type { CSSProperties } from "react";
import type { Rarity } from "../lib/types";
import { CardFrame, FRAME_RENDER_HEIGHT, FRAME_RENDER_WIDTH } from "./CardFrame";

interface FrameOverlayProps {
  rarity: Rarity;
  frameSeed: string;
  className: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  label?: string;
}

function buildUid(rarity: Rarity, frameSeed: string): string {
  return `${rarity}-${frameSeed}`.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "frame";
}

export function FrameOverlay({
  rarity,
  frameSeed,
  className,
  style,
  width = FRAME_RENDER_WIDTH,
  height = FRAME_RENDER_HEIGHT,
  label,
}: FrameOverlayProps) {
  const uid = buildUid(rarity, frameSeed);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${FRAME_RENDER_WIDTH} ${FRAME_RENDER_HEIGHT}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <CardFrame
        width={FRAME_RENDER_WIDTH}
        height={FRAME_RENDER_HEIGHT}
        rarity={rarity}
        frameSeed={frameSeed}
        uid={uid}
      />
    </svg>
  );
}
