import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import { BoardPreviewGrid } from "../components/BoardPreviewGrid";
import { SkateboardStatsPanel } from "../components/SkateboardStatsPanel";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useWorkshopBoards } from "../hooks/useWorkshopBoards";
import { calculateBoardStats, getBoardComponentImageUrls, getBoardSummary, normalizeBoardConfig } from "../lib/boardBuilder";
import { sfxClick, sfxRemove, sfxSuccess } from "../lib/sfx";
import { createWorkshopBoard, reforgeCardBoard, WORKSHOP_REFORGE_FEE_OZZIES } from "../lib/workshop";
import { generateGouacheBoard } from "../services/boardImageGen";

export function Workshop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cards, updateCard } = useCollection();
  const { updateCardInDecks } = useDecks();
  const { boards, addBoard, removeBoard } = useWorkshopBoards();
  const [boardConfig, setBoardConfig] = useState(DEFAULT_BOARD_CONFIG);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(searchParams.get("board"));
  const [selectedCardId, setSelectedCardId] = useState(searchParams.get("card") ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingBoard, setSavingBoard] = useState(false);
  const [applyingBoardId, setApplyingBoardId] = useState<string | null>(null);

  useEffect(() => {
    const queryBoardId = searchParams.get("board");
    const queryCardId = searchParams.get("card");
    if (queryBoardId !== selectedBoardId) setSelectedBoardId(queryBoardId);
    if (queryCardId !== selectedCardId) setSelectedCardId(queryCardId ?? "");
  }, [searchParams, selectedBoardId, selectedCardId]);

  useEffect(() => {
    if (!selectedCardId && cards[0]) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  useEffect(() => {
    if (selectedBoardId && boards.some((board) => board.id === selectedBoardId)) {
      return;
    }
    const fallbackBoardId = boards[0]?.id ?? null;
    setSelectedBoardId(fallbackBoardId);
    const next = new URLSearchParams(searchParams);
    if (fallbackBoardId) next.set("board", fallbackBoardId);
    else next.delete("board");
    setSearchParams(next, { replace: true });
  }, [boards, searchParams, selectedBoardId, setSearchParams]);

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
      await addBoard(board);
      setSelectedBoardId(board.id);
      updateSearchSelection(board.id);
      sfxSuccess();
      setMessage("Paper-doll board saved to the workshop floor.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save the board to the workshop.");
    } finally {
      setSavingBoard(false);
    }
  };

  const handleSelectBoard = (boardId: string) => {
    sfxClick();
    setSelectedBoardId(boardId);
    updateSearchSelection(boardId);
  };

  const handleLoadBoardToBench = () => {
    if (!selectedBoard) return;
    sfxClick();
    setBoardConfig(selectedBoard.config);
    setMessage("Loaded the saved board back onto the assembly bench.");
    setError("");
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

  const handleApplyBoard = async () => {
    if (!selectedBoard || !selectedCard) {
      setError("Pick a saved board and a card before marrying the setup.");
      return;
    }
    if ((selectedCard.ozzies ?? 0) < WORKSHOP_REFORGE_FEE_OZZIES) {
      setError(`${selectedCard.identity.name} needs ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies to cover the workshop fee.`);
      return;
    }

    setApplyingBoardId(selectedBoard.id);
    setError("");
    setMessage("");

    const reforgedCard = reforgeCardBoard(selectedCard, selectedBoard.config, {
      feeOzzies: WORKSHOP_REFORGE_FEE_OZZIES,
    });
    try {
      updateCard(reforgedCard);
      updateCardInDecks(reforgedCard);
      await removeBoard(selectedBoard.id);
      sfxSuccess();
      setMessage(`${selectedCard.identity.name} took the new board. Stats updated and ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies spent.`);

      const boardImageUrl = await generateGouacheBoard(selectedBoard.config);
      const artPatchedCard = reforgeCardBoard(selectedCard, selectedBoard.config, {
        boardImageUrl,
      });
      updateCard(artPatchedCard);
      updateCardInDecks(artPatchedCard);
      setMessage(`${selectedCard.identity.name} took the new board. Stats updated and fresh board art locked in.`);
    } catch (generationError) {
      const detail = generationError instanceof Error ? generationError.message : "Unknown workshop error.";
      setMessage(`${selectedCard.identity.name} took the new board. Stats updated, but fresh board art could not be forged yet.`);
      setError(`Workshop follow-up: ${detail}`);
    } finally {
      setApplyingBoardId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workshop</h1>
          <p className="page-sub">Save bench builds, inspect paper-doll boards, and marry a new skateboard to a forged card.</p>
        </div>
        <button className="btn-outline" type="button" onClick={() => navigate("/collection?tab=decks")}>
          ← Back to Garage
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
              <h2>Build a spare board</h2>
            </div>
            <button className="btn-primary btn-sm" type="button" onClick={handleBenchSave} disabled={savingBoard}>
              {savingBoard ? "Saving…" : "Save to Workshop"}
            </button>
          </div>
          <BoardBuilder value={boardConfig} onChange={setBoardConfig} />
          <div className="workshop-bench__preview">
            <BoardPreviewGrid
              urls={getBoardComponentImageUrls(boardConfig)}
              accentColor="#66d9ff"
            />
            <SkateboardStatsPanel loadout={benchLoadout} />
          </div>
        </section>

        <section className="workshop-detail">
          <div className="workshop-panel-heading">
            <div>
              <p className="eyebrow">Marriage Bay</p>
              <h2>{selectedBoard ? "Bind a saved board to a card" : "Choose a saved board"}</h2>
            </div>
          </div>

          <label className="workshop-field">
            <span>Card target</span>
            <select
              className="input"
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
          </label>

          {selectedCard && (
            <div className="workshop-card-meta">
              <span>Current board: {getBoardSummary(selectedCard.board.config)}</span>
              <span>Current access: {selectedCard.board.loadout?.accessProfile ?? selectedCard.board.accessProfile}</span>
              <span>Available Ozzies: {selectedCard.ozzies ?? 0}</span>
            </div>
          )}

          {selectedBoard ? (
            <>
              <BoardPreviewGrid urls={getBoardComponentImageUrls(selectedBoard.config)} accentColor="#ff8ccf" />
              <div className="workshop-detail__meta">
                <strong>{selectedBoard.label}</strong>
                <span>Saved {new Date(selectedBoard.createdAt).toLocaleString()}</span>
              </div>
              <SkateboardStatsPanel loadout={selectedBoard.loadout} />
              <div className="workshop-detail__actions">
                <button className="btn-outline btn-sm" type="button" onClick={handleLoadBoardToBench}>
                  Load to Bench
                </button>
                <button className="btn-danger btn-sm" type="button" onClick={handleScrapBoard}>
                  Scrap Build
                </button>
                <button
                  className="btn-primary btn-sm"
                  type="button"
                  onClick={handleApplyBoard}
                  disabled={!selectedCard || applyingBoardId === selectedBoard.id}
                >
                  {applyingBoardId === selectedBoard.id ? "Marrying…" : `Marry to Card · ${WORKSHOP_REFORGE_FEE_OZZIES} Oz`}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state workshop-empty">
              <span className="empty-icon">🛹</span>
              <p>No saved boards yet.</p>
              <p className="page-sub">Lock one in on the bench and it will land here as a paper-doll spare.</p>
            </div>
          )}
        </section>
      </div>

      <section className="workshop-floor">
        <div className="workshop-panel-heading">
          <div>
            <p className="eyebrow">Workshop Floor</p>
            <h2>Paper-doll stash</h2>
          </div>
        </div>
        <div className="workshop-floor__grid">
          {boards.map((board, index) => {
            const tilt = ((index % 5) - 2) * 3;
            const lift = (index % 3) * 10;
            return (
              <button
                key={board.id}
                type="button"
                className={`workshop-board-card${selectedBoardId === board.id ? " workshop-board-card--active" : ""}`}
                style={{ transform: `rotate(${tilt}deg) translateY(${lift}px)` }}
                onClick={() => handleSelectBoard(board.id)}
              >
                <BoardPreviewGrid urls={getBoardComponentImageUrls(board.config)} accentColor={selectedBoardId === board.id ? "#9effd4" : "#7e67ff"} />
                <span className="workshop-board-card__title">{board.label}</span>
                <span className="workshop-board-card__meta">{board.loadout.accessProfile}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
