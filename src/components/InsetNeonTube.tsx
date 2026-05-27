import type React from "react";
import { RARITY_COLORS, shouldRenderInsetNeonTube } from "../lib/cardRarityVisuals";
import type { Rarity } from "../lib/types";

interface InsetNeonTubeProps {
  rarity: Rarity;
  accentColor?: string;
}

export function InsetNeonTube({ rarity, accentColor }: InsetNeonTubeProps) {
  if (!shouldRenderInsetNeonTube(rarity)) return null;

  return (
    <div
      className="inset-neon-tube"
      aria-hidden="true"
      style={
        {
          "--tube-rarity": RARITY_COLORS[rarity],
          "--tube-accent": accentColor || RARITY_COLORS[rarity],
        } as React.CSSProperties
      }
    >
      <span className="inset-neon-tube__segment inset-neon-tube__segment--top-left" />
      <span className="inset-neon-tube__segment inset-neon-tube__segment--top-right" />
      <span className="inset-neon-tube__segment inset-neon-tube__segment--left" />
      <span className="inset-neon-tube__segment inset-neon-tube__segment--right" />
      <span className="inset-neon-tube__segment inset-neon-tube__segment--bottom" />
    </div>
  );
}
