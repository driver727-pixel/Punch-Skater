import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import { SkateboardStatsPanel } from "../components/SkateboardStatsPanel";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useWorkshopBoards } from "../hooks/useWorkshopBoards";
import { calculateBoardStats, getBoardSummary, normalizeBoardConfig } from "../lib/boardBuilder";
import { sfxClick, sfxRemove, sfxSuccess } from "../lib/sfx";
import type { WorkshopBoardPayload } from "../lib/types";
import { createWorkshopBoard, reforgeCardBoard, WORKSHOP_REFORGE_FEE_OZZIES } from "../lib/workshop";
import { generateGouacheBoard } from "../services/boardImageGen";
import { removeBackground } from "../services/imageGen";

async function generateTransparentBoardArt(config: WorkshopBoardPayload["config"]): Promise<string> {
  const boardImageUrl = await generateGouacheBoard(config);
  return (await removeBackground(boardImageUrl)).imageUrl;
}

export function Workshop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cards, updateCard } = useCollection();
  const { updateCardInDecks } = useDecks();
  const { boards, isLoading: boardsLoading, addBoard, saveBoard, removeBoard, reorderBoards } = useWorkshopBoards();
  const [boardConfig, setBoardConfig] = useState(DEFAULT_BOARD_CONFIG);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(searchParams.get("board"));
  const [selectedCardId, setSelectedCardId] = useState(searchParams.get("card") ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingBoard, setSavingBoard] = useState(false);
  const [generatingBoardArtId, setGeneratingBoardArtId] = useState<string | null>(null);
  const [applyingBoardId, setApplyingBoardId] = useState<string | null>(null);
  const [dragBoardId, setDragBoardId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const pendingBoardSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    const queryBoardId = searchParams.get("board");
    const queryCardId = searchParams.get("card");
    if (queryBoardId !== null) setSelectedBoardId(queryBoardId);
    if (queryCardId !== null) setSelectedCardId(queryCardId);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCardId && cards[0]) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  useEffect(() => {
    if (boardsLoading) return;
    if (selectedBoardId && boards.some((board) => board.id === selectedBoardId)) {
      pendingBoardSelectionRef.current = null;
      return;
    }
    if (!selectedBoardId || pendingBoardSelectionRef.current === selectedBoardId) return;
    setSelectedBoardId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("board");
      return next;
    }, { replace: true });
  }, [boards, boardsLoading, selectedBoardId, setSearchParams]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );
  const benchLoadout = useMemo(
    () => calculateBoardStats(normalizeBoardConfig(boardConfig)),
    [boardConfig],
  );

  const updateSearchSelection = (nextBoardId: string | null, nextCardId = selectedCardId) => {
    const next = new URLSearchParams();
    if (nextBoardId) next.set("board", nextBoardId);
    if (nextCardId) next.set("card", nextCardId);
    setSearchParams(next, { replace: true });
  };

  const handleBenchSave = async () => {
    setSavingBoard(true);
    setError("");
    setMessage("");
    try {
      const board = createWorkshopBoard(boardConfig, selectedCard?.id);
      setMessage("Generating transparent skateboard art for the workshop floor…");
      const boardImageUrl = await generateTransparentBoardArt(board.config);
      const boardWithArt = { ...board, boardImageUrl };
      pendingBoardSelectionRef.current = board.id;
      await addBoard(boardWithArt);
      setSelectedBoardId(board.id);
      updateSearchSelection(board.id);
      sfxSuccess();
      setMessage("Generated skateboard saved to the workshop floor.");
    } catch (saveError) {
      pendingBoardSelectionRef.current = null;
      setError(saveError instanceof Error ? saveError.message : "Failed to generate and save the board to the workshop.");
    } finally {
      setSavingBoard(false);
    }
  };

  const handleSelectBoard = (boardId: string) => {
    sfxClick();
    setSelectedBoardId(boardId);
    updateSearchSelection(boardId);
  };

  const handleScrapBoard = async () => {
    if (!selectedBoard) return;
    try {
      sfxRemove();
      await removeBoard(selectedBoard.id);
      setMessage("Saved board scrapped from the workshop floor.");
      setError("");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to scrap the saved board.");
    }
  };

  const handleGenerateSelectedBoardArt = async () => {
    if (!selectedBoard) return;
    setGeneratingBoardArtId(selectedBoard.id);
    setError("");
    setMessage("Generating transparent skateboard art for this saved board…");
    try {
      const boardImageUrl = await generateTransparentBoardArt(selectedBoard.config);
      await saveBoard({ ...selectedBoard, boardImageUrl, updatedAt: new Date().toISOString() });
      sfxSuccess();
      setMessage("Generated skateboard art is now on the workshop floor.");
    } catch (artError) {
      setMessage("");
      setError(artError instanceof Error ? artError.message : "Failed to generate skateboard art.");
    } finally {
      setGeneratingBoardArtId(null);
    }
  };

  const handleApplyBoard = async () => {
    if (!selectedBoard || !selectedCard) {
      setError("Pick a saved board and a card before marrying the setup.");
      return;
    }
    if ((selectedCard.ozzies ?? 0) < WORKSHOP_REFORGE_FEE_OZZIES) {
      setError(`${selectedCard.identity.name} needs ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies to cover the workshop fee.`);
      return;
    }
    if (!selectedBoard.boardImageUrl) {
      setError("Generate transparent skateboard art for this saved board before marrying it to a card.");
      return;
    }

    setApplyingBoardId(selectedBoard.id);
    setError("");
    setMessage("");

    try {
      const reforgedCard = reforgeCardBoard(selectedCard, selectedBoard.config, {
        feeOzzies: WORKSHOP_REFORGE_FEE_OZZIES,
        boardImageUrl: selectedBoard.boardImageUrl,
      });
      updateCard(reforgedCard);
      updateCardInDecks(reforgedCard);
      await removeBoard(selectedBoard.id);
      sfxSuccess();
      setMessage(`${selectedCard.identity.name} took the generated board. Stats updated and ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies spent.`);
    } catch (generationError) {
      const detail = generationError instanceof Error ? generationError.message : "Unknown workshop error.";
      setMessage("");
      setError(`Could not bind the board until skateboard art is ready: ${detail}`);
    } finally {
      setApplyingBoardId(null);
    }
  };

  const handleDragStart = (boardId: string) => {
    setDragBoardId(boardId);
  };

  const handleDragOver = (event: React.DragEvent, boardId: string) => {
    event.preventDefault();
    if (boardId !== dragBoardId) setDropTargetId(boardId);
  };

  const handleDrop = (event: React.DragEvent, targetBoardId: string) => {
    event.preventDefault();
    if (!dragBoardId || dragBoardId === targetBoardId) {
      setDragBoardId(null);
      setDropTargetId(null);
      return;
    }
    const currentIds = boards.map((b) => b.id);
    const fromIndex = currentIds.indexOf(dragBoardId);
    const toIndex = currentIds.indexOf(targetBoardId);
    if (fromIndex === -1 || toIndex === -1) {
      setDragBoardId(null);
      setDropTargetId(null);
      return;
    }
    const reordered = [...currentIds];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, dragBoardId);
    reorderBoards(reordered).catch((reorderError) => {
      setError(reorderError instanceof Error ? reorderError.message : "Could not save board order.");
    });
    setDragBoardId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDragBoardId(null);
    setDropTargetId(null);
  };

  return (
    <div className="page page--workshop">
      <video
        className="workshop-page-bg"
        src="/assets/backgrounds/workshop-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="page-header">
        <div>
          <h1 className="page-title">Workshop</h1>
          <p className="page-sub">Save bench builds, inspect paper-doll boards, and marry a new skateboard to a forged card.</p>
        </div>
        <button className="btn-outline" type="button" onClick={() => navigate("/")}>
          ← Back to Card Forge
        </button>
      </div>

      <section className="workshop-hero">
        <div className="workshop-hero__copy">
          <p className="eyebrow">Garage Stash</p>
          <h2>Bench new hardware without re-forging the whole courier.</h2>
          <p>
            Save experimental skateboard builds to the workshop floor, then bind one to an existing card when a mission
            needs different gear access.
          </p>
        </div>
        <div className="workshop-hero__meta">
          <span><strong>{boards.length}</strong> saved boards</span>
          <span><strong>{cards.length}</strong> forged cards</span>
          <span><strong>{WORKSHOP_REFORGE_FEE_OZZIES}</strong> Oz workshop fee</span>
        </div>
      </section>

      {message && <div className="collection-rewards-message collection-rewards-message--ok">{message}</div>}
      {error && <div className="collection-rewards-message collection-rewards-message--error">{error}</div>}

      <div className="workshop-layout">
        <section className="workshop-bench">
          <div className="workshop-panel-heading">
            <div>
              <p className="eyebrow">Assembly Bench</p>
              <h2>Generate a spare skateboard</h2>
            </div>
            <button className="btn-primary btn-sm" type="button" onClick={handleBenchSave} disabled={savingBoard}>
              {savingBoard ? "Generating…" : "Generate & Save to Floor"}
            </button>
          </div>
          <BoardBuilder value={boardConfig} onChange={setBoardConfig} showLockIn={false} />
          <div className="workshop-bench__preview">
            <SkateboardStatsPanel loadout={benchLoadout} />
          </div>
        </section>

        {selectedBoard && (
          <section className="workshop-detail">
            <div className="workshop-panel-heading">
              <div>
                <p className="eyebrow">Marriage Bay</p>
                <h2>Bind a saved board to a card</h2>
              </div>
            </div>

            <label className="workshop-field">
              <span>Card target</span>
              <div className="workshop-select">
                <select
                  className="input workshop-select__control"
                  value={selectedCardId}
                  onChange={(event) => {
                    setSelectedCardId(event.target.value);
                    updateSearchSelection(selectedBoardId, event.target.value);
                  }}
                >
                  {cards.length === 0 && <option value="">No cards saved</option>}
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.identity.name} · {card.prompts.rarity} · {card.board.loadout?.accessProfile ?? card.board.accessProfile}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {selectedCard && (
              <div className="workshop-card-meta">
                <span>Current board: {getBoardSummary(selectedCard.board.config)}</span>
                <span>Current access: {selectedCard.board.loadout?.accessProfile ?? selectedCard.board.accessProfile}</span>
                <span>Available Ozzies: {selectedCard.ozzies ?? 0}</span>
              </div>
            )}

            <div className="workshop-detail__meta">
              <strong>{selectedBoard.label}</strong>
              <span>Saved {new Date(selectedBoard.createdAt).toLocaleString()}</span>
            </div>
            <SkateboardStatsPanel loadout={selectedBoard.loadout} />
            <div className="workshop-detail__actions">
              {!selectedBoard.boardImageUrl && (
                <button
                  className="btn-outline btn-sm"
                  type="button"
                  onClick={handleGenerateSelectedBoardArt}
                  disabled={generatingBoardArtId === selectedBoard.id}
                >
                  {generatingBoardArtId === selectedBoard.id ? "Generating…" : "Generate Board Art"}
                </button>
              )}
              <button className="btn-danger btn-sm" type="button" onClick={handleScrapBoard}>
                Scrap Build
              </button>
              <button
                className="btn-primary btn-sm"
                type="button"
                onClick={handleApplyBoard}
                disabled={!selectedCard || !selectedBoard.boardImageUrl || applyingBoardId === selectedBoard.id}
              >
                {applyingBoardId === selectedBoard.id ? "Marrying…" : `Marry to Card · ${WORKSHOP_REFORGE_FEE_OZZIES} Oz`}
              </button>
            </div>
          </section>
        )}
      </div>

      <section className="workshop-floor-stage" aria-label="Saved skateboard paper dolls">
        {boards.length > 1 && (
          <p className="workshop-floor__drag-hint">Drag boards to rearrange</p>
        )}
        <div className="workshop-floor__grid">
          {boardsLoading && (
            <div className="empty-state workshop-empty">
              <span className="empty-icon">🛹</span>
              <p>Loading saved boards…</p>
            </div>
          )}
          {!boardsLoading && boards.length === 0 && (
            <div className="empty-state workshop-empty">
              <span className="empty-icon">🛹</span>
              <p>No saved boards yet.</p>
              <p className="page-sub">Generate one on the bench and it will land directly on the workshop floor.</p>
            </div>
          )}
          {!boardsLoading && boards.map((board, index) => {
            const tilt = ((index % 5) - 2) * 3;
            const lift = (index % 3) * 10;
            const isDragging = dragBoardId === board.id;
            const isDropTarget = dropTargetId === board.id;
            return (
              <button
                key={board.id}
                type="button"
                draggable
                className={[
                  "workshop-board-card",
                  selectedBoardId === board.id ? "workshop-board-card--active" : "",
                  isDragging ? "workshop-board-card--dragging" : "",
                  isDropTarget ? "workshop-board-card--drop-target" : "",
                ].filter(Boolean).join(" ")}
                style={{ transform: `rotate(${tilt}deg) translateY(${lift}px)` }}
                aria-label={`Select ${board.label} for card binding`}
                title={`${board.label} · ${board.loadout.accessProfile}`}
                onClick={() => handleSelectBoard(board.id)}
                onDragStart={() => handleDragStart(board.id)}
                onDragOver={(e) => handleDragOver(e, board.id)}
                onDrop={(e) => handleDrop(e, board.id)}
                onDragEnd={handleDragEnd}
              >
                {board.boardImageUrl ? (
                  <div className="workshop-board-card__art">
                    <img
                      src={board.boardImageUrl}
                      alt={board.label}
                      className="workshop-board-card__art-img"
                    />
                  </div>
                ) : (
                  <div className="workshop-board-card__art workshop-board-card__art--pending">
                    <span>Generate art</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
