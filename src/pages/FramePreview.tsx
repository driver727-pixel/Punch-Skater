import { CardFrame, FRAME_RENDER_HEIGHT, FRAME_RENDER_WIDTH, FRAME_PREVIEW_RARITIES } from "../components/CardFrame";
import { getFrameBlendMode, getStaticFrameUrl } from "../services/staticAssets";

function FramePreviewTile({ rarity, tileIndex }: { rarity: typeof FRAME_PREVIEW_RARITIES[number]; tileIndex: number }) {
  const uid = `preview_${tileIndex}_${rarity.toLowerCase().replace(/\s+/g, "_")}`;
  const staticFrameUrl = getStaticFrameUrl(rarity);
  const frameLayerStyle = staticFrameUrl
    ? { mixBlendMode: getFrameBlendMode(rarity, staticFrameUrl) }
    : undefined;

  return (
    <article className="frame-preview-tile">
      <div className="frame-preview-canvas">
        {staticFrameUrl ? (
          <div
            className="frame-preview-svg"
            aria-label={`${rarity} frame preview`}
            style={{ width: FRAME_RENDER_WIDTH, height: FRAME_RENDER_HEIGHT, background: "#000000" }}
          >
            <img
              src={staticFrameUrl}
              alt={`${rarity} frame`}
              width={FRAME_RENDER_WIDTH}
              height={FRAME_RENDER_HEIGHT}
              style={{ width: "100%", height: "100%", objectFit: "fill", ...frameLayerStyle }}
            />
          </div>
        ) : (
          <svg
            width={FRAME_RENDER_WIDTH}
            height={FRAME_RENDER_HEIGHT}
            viewBox={`0 0 ${FRAME_RENDER_WIDTH} ${FRAME_RENDER_HEIGHT}`}
            className="frame-preview-svg"
            aria-label={`${rarity} frame preview`}
          >
            <rect width={FRAME_RENDER_WIDTH} height={FRAME_RENDER_HEIGHT} rx="42" fill="#000000" />
            <CardFrame
              width={FRAME_RENDER_WIDTH}
              height={FRAME_RENDER_HEIGHT}
              rarity={rarity}
              frameSeed={rarity}
              uid={uid}
            />
          </svg>
        )}
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
