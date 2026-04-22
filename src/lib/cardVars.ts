import type { CSSProperties } from "react";
import type { CardPayload } from "./types";

export type CardRenderMode = "editor" | "3d" | "print-screen";

/**
 * Build a CSS-variable style object for the given card and render mode.
 *
 * Apply the returned object to a CardContainer wrapping any card-face component
 * so that font sizes, accent colours, and other design tokens stay in sync
 * across the Card Editor, 3D viewer, and Print preview without prop-drilling
 * raw values into every leaf component.
 *
 * The CSS variables declared here are consumed by `.print-card` and its
 * descendants (see index.css --card-* tokens).  Print output is handled
 * separately via @media print overrides in the stylesheet.
 */
export function buildCardVars(
  card: CardPayload | null,
  mode: CardRenderMode = "editor",
): CSSProperties {
  const accent = card?.visuals.accentColor ?? "#00ff88";

  if (mode === "editor") {
    // These rem values mirror the pixel sizes previously hard-coded in
    // .print-preview-area--forge (name: 13 px, bio/body: 10 px, back-name: 12 px).
    // Using rem lets a future Print-preview wrapper override a single variable
    // (e.g. --card-name-size: 10pt) to scale for high-res output without
    // rewriting any layout or positioning rules.
    return {
      "--card-name-size": "1.75rem",      // ≈ 28 px — large enough to fill bottom third
      "--card-bio-size":  "1rem",         // ≈ 16 px
      "--card-age-size":  "0.875rem",     // ≈ 14 px
      "--card-back-name-size": "1.1rem",  // ≈ 17.6 px
      "--card-back-body-size": "0.75rem", // ≈ 12 px
      "--card-accent": accent,
    } as CSSProperties;
  }

  // "3d" and "print-screen" use the .print-card default tokens (small sizes
  // appropriate for the 189 px base card) — only pass accent.
  return { "--card-accent": accent } as CSSProperties;
}
