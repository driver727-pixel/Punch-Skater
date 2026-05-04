/**
 * RetroWireframeTunnel — an 80s-style perspective-grid tunnel rendered in SVG.
 *
 * Used as the background layer inside the card-back hero section, sitting
 * behind the electric-skateboard artwork.
 */

interface RetroWireframeTunnelProps {
  className?: string;
}

export function RetroWireframeTunnel({ className }: RetroWireframeTunnelProps) {
  const W = 400;
  const H = 200;

  // Inner vanishing rectangle (centered)
  const ix0 = 148;
  const iy0 = 66;
  const ix1 = 252;
  const iy1 = 134;
  const iw = ix1 - ix0; // 104
  const ih = iy1 - iy0; // 68

  const parts: string[] = [];

  // ── Top-face fan lines (N+1 lines across the top outer edge → inner top) ────
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ox = t * W;
    const innerX = ix0 + t * iw;
    parts.push(`M ${ox.toFixed(2)} 0 L ${innerX.toFixed(2)} ${iy0}`);
  }

  // ── Bottom-face fan lines ────────────────────────────────────────────────────
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ox = t * W;
    const innerX = ix0 + t * iw;
    parts.push(`M ${ox.toFixed(2)} ${H} L ${innerX.toFixed(2)} ${iy1}`);
  }

  // ── Left-face fan lines (M+1 lines down the left outer edge → inner left) ───
  const M = 6;
  for (let j = 0; j <= M; j++) {
    const t = j / M;
    const oy = t * H;
    const innerY = iy0 + t * ih;
    parts.push(`M 0 ${oy.toFixed(2)} L ${ix0} ${innerY.toFixed(2)}`);
  }

  // ── Right-face fan lines ─────────────────────────────────────────────────────
  for (let j = 0; j <= M; j++) {
    const t = j / M;
    const oy = t * H;
    const innerY = iy0 + t * ih;
    parts.push(`M ${W} ${oy.toFixed(2)} L ${ix1} ${innerY.toFixed(2)}`);
  }

  // ── Depth rings — concentric rectangles converging to the inner vanish rect ──
  //    Each ring is placed at fraction d of the way from the outer border
  //    toward the inner vanishing rect.
  const RINGS = 5;
  for (let r = 1; r <= RINGS; r++) {
    const d = r / (RINGS + 1);
    const tlx = (d * ix0).toFixed(2);
    const tly = (d * iy0).toFixed(2);
    const trx = (W - d * (W - ix1)).toFixed(2);
    const try_ = tly;
    const blx = tlx;
    const bly = (H - d * (H - iy1)).toFixed(2);
    const brx = trx;
    const bry = bly;
    parts.push(`M ${tlx} ${tly} L ${trx} ${try_} L ${brx} ${bry} L ${blx} ${bly} Z`);
  }

  const pathD = parts.join(" ");

  const cls = ["retro-wireframe-tunnel", className].filter(Boolean).join(" ");

  return (
    <svg
      className={cls}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Background fill */}
      <rect width={W} height={H} fill="#04080d" />

      {/* Grid lines */}
      <path
        d={pathD}
        fill="none"
        stroke="#00e8c8"
        strokeWidth="0.65"
        strokeLinecap="square"
        className="retro-wireframe-tunnel__lines"
      />

      {/* Inner vanishing rectangle */}
      <rect
        x={ix0}
        y={iy0}
        width={iw}
        height={ih}
        fill="#020507"
        stroke="#00e8c8"
        strokeWidth="0.65"
      />
    </svg>
  );
}
