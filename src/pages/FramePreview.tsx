import { FRAME_RENDER_HEIGHT, FRAME_RENDER_WIDTH, FRAME_PREVIEW_RARITIES } from "../components/CardFrame";
import { FrameOverlay } from "../components/FrameOverlay";

function FramePreviewTile({ rarity, tileIndex }: { rarity: typeof FRAME_PREVIEW_RARITIES[number]; tileIndex: number }) {
  return (
    <article className="frame-preview-tile">
      <div className="frame-preview-canvas">
        <div
          className="frame-preview-svg"
          aria-label={`${rarity} frame preview`}
          style={{ width: FRAME_RENDER_WIDTH, height: FRAME_RENDER_HEIGHT, background: "#000000" }}
        >
          <FrameOverlay
            rarity={rarity}
            frameSeed={`${rarity}-${tileIndex}`}
            className="card-art-layer card-art-layer--svg-frame"
            width={FRAME_RENDER_WIDTH}
            height={FRAME_RENDER_HEIGHT}
            label={`${rarity} frame`}
          />
        </div>
      </div>
      <div className="frame-preview-meta">
        <h2>{rarity}</h2>
        <p>750 × 1050 px</p>
      </div>
    </article>
  );
}

export function FramePreview() {
  return (
    <div className="page frame-preview-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🖼 Border Frame Preview</h1>
          <p className="page-sub">
            Fixed 750 × 1050 previews for all five card borders, including Punch Skater.
          </p>
        </div>
      </div>

      <section className="frame-preview-grid" aria-label="Card frame previews">
        {FRAME_PREVIEW_RARITIES.map((rarity, tileIndex) => (
          <FramePreviewTile key={rarity} rarity={rarity} tileIndex={tileIndex} />
        ))}
      </section>
    </div>
  );
}
