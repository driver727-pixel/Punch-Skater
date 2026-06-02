import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../lib/firebase";
import { resolveAdminActionUrl } from "../lib/apiUrls";
import type { CardPayload } from "../lib/types";
import { generateRacerSpriteSheet } from "../services/racerSpriteGen";
import {
  buildRacerSpriteFilename,
  buildRacerSpriteManifest,
  buildRacerSpriteSlug,
  buildStaticRacerSpriteManifest,
  RACER_SPRITE_ASSET_DIR,
  type RacerSpriteRecord,
} from "../lib/arcadeRacerSprites";

interface AdminDeck {
  id: string;
  ownerUid: string;
  name: string;
  cards: CardPayload[];
}

const OBJECT_URL_REVOKE_DELAY_MS = 15_000;

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
}

type CardStatus = "idle" | "generating" | "done" | "error";

interface CardState {
  status: CardStatus;
  imageUrl?: string;
  error?: string;
}

export function AdminArcadeRacerSpritesPanel() {
  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [states, setStates] = useState<Record<string, CardState>>({});

  const fetchDecks = useCallback(async () => {
    if (!auth?.currentUser) {
      setError("Sign in as an admin to load card decks.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(resolveAdminActionUrl("/api/admin/decks"), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? "Failed to load admin decks.");
      }
      const data = await res.json();
      setDecks((data.decks ?? []) as AdminDeck[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin decks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  // Cards eligible for sprite generation: those with an isolated character layer.
  const eligibleCards = useMemo(() => {
    const seen = new Set<string>();
    const cards: { card: CardPayload; deckName: string }[] = [];
    for (const deck of decks) {
      for (const card of deck.cards) {
        if (!card.characterImageUrl || seen.has(card.id)) continue;
        seen.add(card.id);
        cards.push({ card, deckName: deck.name });
      }
    }
    return cards;
  }, [decks]);

  function setCardState(cardId: string, patch: Partial<CardState>) {
    setStates((prev) => ({ ...prev, [cardId]: { ...prev[cardId], ...patch } }));
  }

  const generateOne = useCallback(async (card: CardPayload) => {
    if (!card.characterImageUrl) return;
    setCardState(card.id, { status: "generating", imageUrl: undefined, error: undefined });
    try {
      const sheetUrl = await generateRacerSpriteSheet(card.characterImageUrl, {
        characterName: card.identity?.name,
      });
      setCardState(card.id, { status: "done", imageUrl: sheetUrl });
    } catch (err) {
      setCardState(card.id, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const doneRecords = useMemo<RacerSpriteRecord[]>(() => {
    const records: RacerSpriteRecord[] = [];
    for (const { card, deckName } of eligibleCards) {
      const state = states[card.id];
      if (state?.status !== "done" || !state.imageUrl) continue;
      const slug = buildRacerSpriteSlug(card.id);
      records.push({
        slug,
        cardId: card.id,
        name: card.identity?.name ?? card.id,
        deck: deckName,
        file: buildRacerSpriteFilename(slug),
        imageUrl: state.imageUrl,
      });
    }
    return records;
  }, [eligibleCards, states]);

  const exportSprites = useCallback(async () => {
    if (doneRecords.length === 0) {
      setError("Generate at least one racer sprite sheet before exporting.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const manifest = buildRacerSpriteManifest(doneRecords);
      triggerDownload(
        new Blob([JSON.stringify(buildStaticRacerSpriteManifest(manifest), null, 2)], {
          type: "application/json",
        }),
        "manifest.json",
      );

      for (const record of doneRecords) {
        if (!record.imageUrl) continue;
        setStatus(`Downloading ${record.name}…`);
        const response = await fetch(record.imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download ${record.name} (HTTP ${response.status}).`);
        }
        triggerDownload(await response.blob(), record.file);
      }
      setStatus(`Downloaded manifest.json and ${doneRecords.length} sprite sheet PNG(s).`);
    } catch (exportError) {
      console.error("Failed to export racer sprites:", exportError);
      setError(exportError instanceof Error ? exportError.message : "Failed to export racer sprites.");
    } finally {
      setExporting(false);
    }
  }, [doneRecords]);

  const generatingCount = eligibleCards.filter(
    ({ card }) => states[card.id]?.status === "generating",
  ).length;

  return (
    <section className="asset-gen-section">
      <div className="adlp-section-header">
        <h2 className="asset-gen-section-title">Arcade Racer Sprites</h2>
        <button className="btn-outline" onClick={fetchDecks} disabled={loading || exporting}>
          {loading ? "⏳ Loading…" : "↺ Refresh"}
        </button>
      </div>

      <p className="asset-gen-toolbar-copy">
        Generate clean isometric 2D <strong>animated sprite sheets</strong> from admin
        <strong> card-deck</strong> characters via fal.ai <code>nano-banana-2</code>. Each
        card&apos;s isolated character layer (background, frame, weapon, and skateboard
        deck removed) is sent as the reference image. Then{" "}
        <strong>Export Manifest + PNGs</strong> and commit the bundle into{" "}
        <code>public/{RACER_SPRITE_ASSET_DIR}/</code> so the Arcade Racer loads pre-baked
        assets in production.
      </p>

      <div className="asset-gen-toolbar" style={{ marginTop: 12 }}>
        <span className="asset-gen-counter">
          {doneRecords.length} / {eligibleCards.length} generated
        </span>
        <button
          className="btn-outline"
          onClick={exportSprites}
          disabled={loading || exporting || generatingCount > 0 || doneRecords.length === 0}
        >
          {exporting ? "⏳ Exporting…" : "⬇ Export Manifest + PNGs"}
        </button>
      </div>

      {!loading && eligibleCards.length === 0 && !error && (
        <p className="adlp-empty">
          No admin card-deck cards with a character layer were found.
        </p>
      )}

      <div className="asset-gen-grid">
        {eligibleCards.map(({ card, deckName }) => {
          const state = states[card.id] ?? { status: "idle" as CardStatus };
          return (
            <div key={card.id} className="asset-gen-card">
              <div className="asset-gen-card-label">
                {card.identity?.name ?? card.id}
                <span className="asset-gen-placeholder"> · {deckName}</span>
              </div>

              <div className="asset-gen-preview">
                {state.status === "idle" && card.characterImageUrl && (
                  <img
                    src={card.characterImageUrl}
                    alt="character reference"
                    className="asset-gen-img"
                    loading="lazy"
                  />
                )}
                {state.status === "generating" && (
                  <span className="asset-gen-spinner">⏳ Generating sheet…</span>
                )}
                {state.status === "done" && state.imageUrl && (
                  <img src={state.imageUrl} alt="sprite sheet" className="asset-gen-img" />
                )}
                {state.status === "error" && (
                  <span className="asset-gen-error" title={state.error}>
                    ✗ Error
                  </span>
                )}
              </div>

              <div className="asset-gen-card-actions">
                <button
                  className="btn-outline"
                  onClick={() => generateOne(card)}
                  disabled={state.status === "generating" || exporting}
                >
                  {state.status === "generating"
                    ? "⏳ Generating…"
                    : state.status === "done"
                      ? "↺ Regenerate"
                      : "▶ Generate Sheet"}
                </button>
                {state.status === "error" && (
                  <span className="asset-gen-error-msg">{state.error}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status && <p className="asset-gen-toolbar-copy" style={{ marginTop: 12 }}>{status}</p>}
      {error && <p className="admin-error">{error}</p>}
    </section>
  );
}
