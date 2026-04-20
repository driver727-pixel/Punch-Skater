import { useState } from "react";
import type { CardPayload } from "../lib/types";
import {
  PrintedCardBackContent,
  PrintedCardFrontContent,
  PrintedCardPreviewPair,
} from "./PrintedCardFaces";

interface PrintModalProps {
  card: CardPayload;
  backgroundImageUrl?: string;
  /** Full print-quality background URL (1536 × 2048 px). When provided, this
   *  is used in the hidden print-only area instead of backgroundImageUrl so the
   *  browser prints at the highest available resolution. */
  backgroundPrintUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  characterBlend?: number;
  onClose: () => void;
}

type PrintSide = "both" | "front" | "back";

/** Small crop-mark corners rendered outside the bleed box */
function BleedMarks() {
  return (
    <div className="print-bleed-marks" aria-hidden>
      <span className="print-bleed-corner print-bleed-corner--tl" />
      <span className="print-bleed-corner print-bleed-corner--tr" />
      <span className="print-bleed-corner print-bleed-corner--bl" />
      <span className="print-bleed-corner print-bleed-corner--br" />
    </div>
  );
}

export function PrintModal({
  card,
  backgroundImageUrl,
  backgroundPrintUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  onClose,
}: PrintModalProps) {
  const [side, setSide] = useState<PrintSide>("both");
  // Use the full print-quality background in the hidden printable area when available.
  const printBackgroundUrl = backgroundPrintUrl ?? backgroundImageUrl;

  const handlePrint = () => {
    window.print();
  };

  const handleSideChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSide(e.target.value as PrintSide);
  };

  return (
    <>
      {/* ── Screen UI ── */}
      <div className="modal-overlay print-modal-overlay" onClick={onClose}>
        <div className="modal-panel print-modal-panel" onClick={(e) => e.stopPropagation()}>
          <button className="close-btn modal-close" onClick={onClose}>✕</button>
          <h2 className="modal-title">🖨 Print Card</h2>
          <p className="modal-sub">
            Standard poker size · 2.5 × 3.5 in · 0.125 in bleed · flat, clean
          </p>

          {/* Side selector */}
          <div className="print-side-selector">
            {(["both", "front", "back"] as PrintSide[]).map((val) => (
              <label key={val} className="print-side-option">
                <input
                  type="radio"
                  name="print-side"
                  value={val}
                  checked={side === val}
                  onChange={handleSideChange}
                />
                {val === "both"  ? "Both Sides" : val === "front" ? "Front Only" : "Back Only"}
              </label>
            ))}
          </div>

          {/* Print preview */}
          <PrintedCardPreviewPair
            card={card}
            backgroundImageUrl={backgroundImageUrl}
            characterImageUrl={characterImageUrl}
            frameImageUrl={frameImageUrl}
            characterBlend={characterBlend}
          />

          <div className="print-modal-actions">
            <button className="btn-primary" onClick={handlePrint}>
              🖨 Print
            </button>
            <button className="btn-outline" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* ── Hidden printable area (only visible via @media print) ── */}
      <div className="print-only-area" aria-hidden>
        {/* Front: Character with name and bio */}
        {side !== "back" && (
        <div className="print-only-card-wrap">
          <div className="print-only-bleed">
            <BleedMarks />
            <div className="print-only-card">
              <PrintedCardFrontContent
                card={card}
                backgroundImageUrl={printBackgroundUrl}
                characterImageUrl={characterImageUrl}
                frameImageUrl={frameImageUrl}
                characterBlend={characterBlend}
                fallbackWidth={675}
                fallbackHeight={945}
              />
            </div>
          </div>
        </div>
        )}

        {/* Back: Skateboard with stats */}
        {side !== "front" && (
        <div className="print-only-card-wrap">
          <div className="print-only-bleed">
            <BleedMarks />
            <div
              className="print-only-card print-only-card--back"
              style={{ "--accent": card.visuals.accentColor || "#00ff88" } as React.CSSProperties}
            >
              <PrintedCardBackContent card={card} />
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
}
