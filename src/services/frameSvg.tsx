import { renderToStaticMarkup } from "react-dom/server";
import type { Rarity } from "../lib/types";
import { FrameOverlay } from "../components/FrameOverlay";

export function buildFrameSvgMarkup(rarity: Rarity, frameSeed: string): string {
  return renderToStaticMarkup(
    <FrameOverlay
      rarity={rarity}
      frameSeed={frameSeed}
      className=""
      label={`${rarity} frame`}
    />,
  );
}

export function buildFrameSvgDataUrl(rarity: Rarity, frameSeed: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildFrameSvgMarkup(rarity, frameSeed))}`;
}
