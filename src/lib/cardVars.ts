import type { CSSProperties } from "react";
import type { CardPayload } from "./types";

export type CardRenderMode = "editor" | "3d" | "print-screen" | "collection";

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
    // These rem values tune the editor preview independently from the 189 px
    // print/3D card baseline so the mobile forge layout stays readable without
    // overflowing the front bio or crowding the back-card hero overlays.
    return {
      "--card-name-size": "2.1rem",
      "--card-bio-size":  "0.95rem",
      "--card-age-size":  "0.95rem",
      "--card-back-name-size": "1.2rem",
      "--card-back-body-size": "0.78rem",
      "--card-accent": accent,
    } as CSSProperties;
  }

  // "3d", "print-screen", and "collection" use the .print-card default tokens
  // (small sizes appropriate for the 189 px base card) — only pass accent.
  return { "--card-accent": accent } as CSSProperties;
}
