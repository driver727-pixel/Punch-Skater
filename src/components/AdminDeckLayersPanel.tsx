import { useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import type { CardPayload } from "../lib/types";
import { DISTRICT_RIVALS, type DistrictRival } from "../lib/rivals";
import {
  buildBoardPlacementStyle,
  buildCharacterPlacementStyle,
  CHARACTER_LAYER_Z_INDEX,
  getBoardLayerZIndex,
} from "../lib/boardPlacement";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";
import {
  getFrameBlendMode,
  getStaticFrameBackUrl,
  shouldInsetBackgroundForFrame,
} from "../services/staticAssets";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminDeck {
  id: string;
  ownerUid: string;
  name: string;
  isPrimary: boolean;
  battleReady: boolean;
  challengerCardId: string | null;
  cards: CardPayload[];
}

interface LayerToggles {
  background: boolean;
  board: boolean;
  character: boolean;
  frame: boolean;
}

const ALL_LAYERS_ON: LayerToggles = {
  background: true,
  board: true,
  character: true,
  frame: true,
};

const ALL_LAYERS_OFF: LayerToggles = {
  background: false,
  board: false,
  character: false,
  frame: false,
};

// ── URL resolution ─────────────────────────────────────────────────────────────

function resolveAdminActionUrl(pathname: string): string {
  const configuredUrl = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)?.trim();
  if (!configuredUrl) return pathname;
  try {
    return new URL(pathname, configuredUrl).toString();
  } catch {
    return pathname;
  }
}

// ── Layer toggle controls ──────────────────────────────────────────────────────

interface LayerToggleBarProps {
  toggles: LayerToggles;
  onChange: (toggles: LayerToggles) => void;
}

function LayerToggleBar({ toggles, onChange }: LayerToggleBarProps) {
  const allOn = toggles.background && toggles.board && toggles.character && toggles.frame;

  function toggle(key: keyof LayerToggles) {
    onChange({ ...toggles, [key]: !toggles[key] });
  }

  function toggleAll() {
    onChange(allOn ? ALL_LAYERS_OFF : ALL_LAYERS_ON);
  }

  return (
    <div className="adlp-layer-bar">
      <button
        className={`adlp-layer-btn${allOn ? " adlp-layer-btn--active" : ""}`}
        onClick={toggleAll}
        title="Toggle all layers"
      >
        ⊞ All
      </button>
      <button
        className={`adlp-layer-btn${toggles.background ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("background")}
        title="Background layer"
      >
        🌄 BG
      </button>
      <button
        className={`adlp-layer-btn${toggles.board ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("board")}
        title="Skateboard deck layer"
      >
        🛹 Board
      </button>
      <button
        className={`adlp-layer-btn${toggles.character ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("character")}
        title="Character layer"
      >
        🧍 Char
      </button>
      <button
        className={`adlp-layer-btn${toggles.frame ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("frame")}
        title="Frame overlay layer"
      >
        🖼 Frame
      </button>
    </div>
  );
}

// ── Single card layer preview ──────────────────────────────────────────────────

const CARD_W = 160;
const CARD_H = 224;

interface CardLayerPreviewProps {
  card: CardPayload;
  toggles: LayerToggles;
}

function CardLayerPreview({ card, toggles }: CardLayerPreviewProps) {
  const [boardImageFailed, setBoardImageFailed] = useState(false);
  const { backgroundImageUrl, characterImageUrl, frameImageUrl } = card;
  const hasBackFrame = getStaticFrameBackUrl(card.prompts.rarity) != null;
  const hasAnyLayer = backgroundImageUrl || characterImageUrl || frameImageUrl || card.board?.imageUrl;

  const backgroundLayerClassName = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "card-art-layer card-art-layer--background card-art-layer--background-inset"
    : "card-art-layer card-art-layer--background";

  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;

  const boardPoseScene = resolveBoardPoseScene(card.characterSeed);
  const showExactBoardLayer =
    toggles.board &&
    Boolean(card.board?.imageUrl && (backgroundImageUrl || characterImageUrl));

  const boardPlacementStyle = {
    ...buildBoardPlacementStyle(boardPoseScene.key, card.board?.placement),
    zIndex: getBoardLayerZIndex(card.board?.layerOrder),
  };
  const characterPlacementStyle = {
    ...buildCharacterPlacementStyle(card.characterPlacement),
    zIndex: CHARACTER_LAYER_Z_INDEX,
  };

  return (
    <div
      className={`card-art-composite adlp-card-preview${hasBackFrame ? " card-art-composite--wrap-frame" : ""}`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      {toggles.background && backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt="background"
          className={backgroundLayerClassName}
          loading="lazy"
          decoding="async"
        />
      )}
      {showExactBoardLayer && card.board?.imageUrl && !boardImageFailed && (
        <img
          src={card.board.imageUrl}
          alt="skateboard deck"
          className="card-art-layer card-art-layer--board-exact"
          style={boardPlacementStyle}
          loading="lazy"
          decoding="async"
          onError={() => setBoardImageFailed(true)}
        />
      )}
      {toggles.character && characterImageUrl && (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
          style={characterPlacementStyle}
          loading="lazy"
          decoding="async"
        />
      )}
      {toggles.frame && frameImageUrl && (
        <img
          src={frameImageUrl}
          alt="frame"
          className={
            hasBackFrame
              ? "card-art-layer card-art-layer--frame card-art-layer--frame-wrap"
              : "card-art-layer card-art-layer--frame"
          }
          style={frameLayerStyle as React.CSSProperties}
          loading="lazy"
          decoding="async"
        />
      )}
      {!hasAnyLayer && (
        <div className="adlp-no-layers">No image layers generated yet</div>
      )}
    </div>
  );
}

// ── Deck section ───────────────────────────────────────────────────────────────

interface DeckSectionProps {
  deck: AdminDeck;
}

function DeckSection({ deck }: DeckSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [globalToggles, setGlobalToggles] = useState<LayerToggles>(ALL_LAYERS_ON);

  return (
    <div className="adlp-deck">
      <div className="adlp-deck-header">
        <button className="adlp-deck-expand-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "▾" : "▸"}
        </button>
        <span className="adlp-deck-name">
          {deck.name}
          {deck.isPrimary && <span className="adlp-primary-badge">★ Primary</span>}
          {deck.battleReady && <span className="adlp-ready-badge">⚔ Battle Ready</span>}
        </span>
        <span className="adlp-deck-meta">
          {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""}
        </span>
        {expanded && (
          <div className="adlp-deck-global-toggles">
            <span className="adlp-deck-global-label">All cards:</span>
            <LayerToggleBar toggles={globalToggles} onChange={setGlobalToggles} />
          </div>
        )}
      </div>

      {expanded && (
        <div className="adlp-card-grid">
          {deck.cards.map((card) => (
            <CardTileWithGlobal
              key={card.id}
              card={card}
              isChallengerCard={deck.challengerCardId === card.id}
              globalToggles={globalToggles}
            />
          ))}
          {deck.cards.length === 0 && (
            <p className="adlp-empty">This deck has no cards.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Card tile that can be overridden by global toggles or managed individually
interface CardTileWithGlobalProps {
  card: CardPayload;
  isChallengerCard: boolean;
  globalToggles: LayerToggles;
}

function CardTileWithGlobal({ card, isChallengerCard, globalToggles }: CardTileWithGlobalProps) {
  // Individual overrides start synced to global, then diverge if user changes them
  const [overridden, setOverridden] = useState(false);
  const [localToggles, setLocalToggles] = useState<LayerToggles>(globalToggles);

  // Sync with global when not overridden
  useEffect(() => {
    if (!overridden) {
      setLocalToggles(globalToggles);
    }
  }, [globalToggles, overridden]);

  function handleChange(t: LayerToggles) {
    setOverridden(true);
    setLocalToggles(t);
  }

  return (
    <div className="adlp-card-tile">
      <div className="adlp-card-tile-name">
        {card.identity?.name ?? "—"}
        {isChallengerCard && <span className="adlp-challenger-badge">⚡ Challenger</span>}
        {overridden && (
          <button
            className="adlp-reset-btn"
            onClick={() => { setOverridden(false); setLocalToggles(globalToggles); }}
            title="Reset to deck-wide toggles"
          >
            ↺
          </button>
        )}
      </div>
      <div className="adlp-card-tile-sub">
        {card.prompts?.rarity} · {card.prompts?.archetype}
      </div>
      <CardLayerPreview card={card} toggles={localToggles} />
      <LayerToggleBar toggles={localToggles} onChange={handleChange} />
    </div>
  );
}

// ── Boss card tile ─────────────────────────────────────────────────────────────

interface BossTileProps {
  rival: DistrictRival;
}

function BossTile({ rival }: BossTileProps) {
  const sc = rival.signatureCard;
  return (
    <div className="adlp-boss-tile">
      <div className="adlp-boss-header">
        <span className="adlp-boss-name">{rival.name}</span>
        <span className="adlp-boss-district">{rival.district}</span>
      </div>
      <div className="adlp-boss-tagline">{rival.tagline}</div>
      <div className="adlp-no-layers adlp-boss-no-layers">
        No image layers — boss cards are stat-only
      </div>
      <div className="adlp-boss-stats">
        <div className="adlp-boss-stat"><span>SPD</span>{sc.stats.speed}</div>
        <div className="adlp-boss-stat"><span>RNG</span>{sc.stats.range}</div>
        <div className="adlp-boss-stat"><span>STL</span>{sc.stats.stealth}</div>
        <div className="adlp-boss-stat"><span>GRT</span>{sc.stats.grit}</div>
        <div className="adlp-boss-stat"><span>LNC</span>{sc.joust.lance}</div>
        <div className="adlp-boss-stat"><span>SHD</span>{sc.joust.shield}</div>
        <div className="adlp-boss-stat"><span>HYP</span>{sc.joust.hype}</div>
      </div>
      <div className="adlp-boss-tactic">
        ⚔ Tactic: <strong>{rival.signatureTactic}</strong> · {rival.signatureTrait}
      </div>
      <blockquote className="adlp-boss-dialogue">{rival.dialogue.intro}</blockquote>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function AdminDeckLayersPanel() {
  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDecks = useCallback(async () => {
    if (!auth?.currentUser) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(resolveAdminActionUrl("/api/admin/decks"), {
        headers: {
          Authorization: "Bearer " + idToken,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load admin decks.");
      setDecks(data.decks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin decks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  return (
    <div className="adlp-panel">
      {/* ── Admin Card Decks ─────────────────────────────────────────────── */}
      <section className="asset-gen-section">
        <div className="adlp-section-header">
          <h2 className="asset-gen-section-title">Admin Card Decks</h2>
          <button
            className="btn-outline"
            onClick={fetchDecks}
            disabled={loading}
          >
            {loading ? "⏳ Loading…" : "↺ Refresh"}
          </button>
        </div>
        <p className="asset-gen-toolbar-copy">
          All card decks saved by admin accounts. Use the layer toggles on each card
          to show or hide the Background, Skateboard Deck, Character, and Frame layers.
          Deck-wide toggles apply to all cards at once; individual card toggles override independently.
        </p>

        {error && <p className="admin-error">{error}</p>}

        {!loading && decks.length === 0 && !error && (
          <p className="adlp-empty">No admin card decks found.</p>
        )}

        {decks.map((deck) => (
          <DeckSection key={`${deck.ownerUid}::${deck.id}`} deck={deck} />
        ))}
      </section>

      {/* ── District Bosses ───────────────────────────────────────────────── */}
      <section className="asset-gen-section">
        <h2 className="asset-gen-section-title">District Bosses / Rivals</h2>
        <p className="asset-gen-toolbar-copy">
          All six named district boss rivals. Boss cards are stat-only snapshots — they do not
          have AI-generated image layers yet.
        </p>
        <div className="adlp-boss-grid">
          {DISTRICT_RIVALS.map((rival) => (
            <BossTile key={rival.id} rival={rival} />
          ))}
        </div>
      </section>
    </div>
  );
}
