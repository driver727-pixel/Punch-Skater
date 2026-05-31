import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import { CardContainer } from "../components/CardContainer";
import { SkateboardStatsPanel } from "../components/SkateboardStatsPanel";
import { SkaterCardFace } from "../components/SkaterCardFace";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useWorkshopBoards } from "../hooks/useWorkshopBoards";
import { useWorkshopWeapons } from "../hooks/useWorkshopWeapons";
import { buildCardVars } from "../lib/cardVars";
import { calculateBoardStats, getBoardSummary, normalizeBoardConfig } from "../lib/boardBuilder";
import { sfxClick, sfxRemove, sfxSuccess } from "../lib/sfx";
import type {
  BoardPlacement,
  CardPayload,
  CharacterPlacement,
  WeaponPlacement,
  WorkshopBoardPayload,
  WorkshopFloorPlacement,
} from "../lib/types";
import {
  createWorkshopBoard,
  createWorkshopWeapon,
  reforgeCardBoard,
  reforgeCardWeapon,
  WORKSHOP_REFORGE_FEE_OZZIES,
} from "../lib/workshop";
import { generateGouacheBoard, shouldRemoveBoardImageBackground } from "../services/boardImageGen";
import { getStaticFrameBackUrl } from "../services/staticAssets";
import { removeBackground } from "../services/imageGen";
import { useAuth } from "../context/AuthContext";
import {
  BOARD_PLACEMENT_MAX_SCALE,
  BOARD_PLACEMENT_MIN_SCALE,
  BOARD_PLACEMENT_SCALE_STEP,
  CHARACTER_PLACEMENT_MAX_SCALE,
  CHARACTER_PLACEMENT_MIN_SCALE,
  CHARACTER_PLACEMENT_SCALE_STEP,
  WEAPON_PLACEMENT_MAX_SCALE,
  WEAPON_PLACEMENT_MIN_SCALE,
  WEAPON_PLACEMENT_SCALE_STEP,
} from "../lib/boardPlacement";
import { WEAPON_ASSETS } from "./cardForge/constants";

async function generateTransparentBoardArt(
  config: WorkshopBoardPayload["config"],
  options?: Parameters<typeof generateGouacheBoard>[1],
): Promise<string> {
  const boardImageUrl = await generateGouacheBoard(config, options);
  if (!shouldRemoveBoardImageBackground(config)) {
    return boardImageUrl;
  }
  return (await removeBackground(boardImageUrl)).imageUrl;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const KEYBOARD_PERSIST_DEBOUNCE_MS = 220;
const KEYBOARD_NUDGE_STEP = 0.015;
const KEYBOARD_NUDGE_STEP_SHIFT = 0.03;
const DRAG_MOVEMENT_THRESHOLD_PX = 3;

type WorkshopAssetKind = "board" | "weapon";

interface WorkshopFloorAsset {
  key: string;
  id: string;
  kind: WorkshopAssetKind;
  label: string;
  imageUrl?: string;
  floorPlacement?: WorkshopFloorPlacement;
}

function getWorkshopAssetKey(kind: WorkshopAssetKind, id: string): string {
  return `${kind}:${id}`;
}

function isValidFloorPlacement(
  placement: WorkshopFloorPlacement | undefined,
): placement is WorkshopFloorPlacement {
  return Boolean(placement)
    && Number.isFinite(placement.x)
    && Number.isFinite(placement.y);
}

function getDefaultFloorPlacement(index: number, count: number): { x: number; y: number } {
  const safeCount = Math.max(1, count);
  const columns = Math.min(3, safeCount);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = clamp((column + 1) / (columns + 1), 0.12, 0.88);
  const y = clamp(0.3 + (row * 0.24), 0.22, 0.88);
  return { x, y };
}

export function Workshop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userProfile } = useAuth();
  const { cards, updateCard } = useCollection();
  const { updateCardInDecks } = useDecks();
  const { boards, isLoading: boardsLoading, addBoard, saveBoard, removeBoard } = useWorkshopBoards();
  const { weapons, isLoading: weaponsLoading, addWeapon, saveWeapon, removeWeapon } = useWorkshopWeapons();
  const [boardConfig, setBoardConfig] = useState(DEFAULT_BOARD_CONFIG);
  const [ignoreBoardCache, setIgnoreBoardCache] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(searchParams.get("board"));
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(searchParams.get("weapon"));
  const [selectedWeaponAssetUrl, setSelectedWeaponAssetUrl] = useState(WEAPON_ASSETS[0]?.url ?? "");
  const [selectedCardId, setSelectedCardId] = useState(searchParams.get("card") ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingBoard, setSavingBoard] = useState(false);
  const [savingWeapon, setSavingWeapon] = useState(false);
  const [savingCardLayout, setSavingCardLayout] = useState(false);
  const [generatingBoardArtId, setGeneratingBoardArtId] = useState<string | null>(null);
  const [applyingBoardId, setApplyingBoardId] = useState<string | null>(null);
  const [applyingWeaponId, setApplyingWeaponId] = useState<string | null>(null);
  const [draggingAssetKeys, setDraggingAssetKeys] = useState<Set<string>>(() => new Set());
  const [assetFloorPositions, setAssetFloorPositions] = useState<Record<string, WorkshopFloorPlacement>>({});
  const [editingCard, setEditingCard] = useState<CardPayload | null>(null);
  const workshopIgnoreCacheInputId = "workshop-ignore-board-cache";
  const pendingBoardSelectionRef = useRef<string | null>(null);
  const pendingWeaponSelectionRef = useRef<string | null>(null);
  const floorStageRef = useRef<HTMLElement | null>(null);
  const cardEditorSectionRef = useRef<HTMLElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const repositionSectionRef = useRef<HTMLDivElement | null>(null);
  const refreshArtSectionRef = useRef<HTMLDivElement | null>(null);
  const handledFocusRef = useRef<string | null>(null);
  const keyboardPersistTimersRef = useRef<Record<string, number>>({});
  const activeDragCountsRef = useRef<Record<string, number>>({});
  const dragSessionsRef = useRef<Record<number, {
    assetKey: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  }>>({});

  useEffect(() => {
    const queryBoardId = searchParams.get("board");
    const queryWeaponId = searchParams.get("weapon");
    const queryCardId = searchParams.get("card");
    setSelectedBoardId(queryBoardId);
    setSelectedWeaponId(queryWeaponId);
    if (queryCardId !== null) setSelectedCardId(queryCardId);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCardId && cards[0]) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  useEffect(() => {
    return () => {
      Object.values(keyboardPersistTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      keyboardPersistTimersRef.current = {};
    };
  }, []);

  const floorAssets = useMemo<WorkshopFloorAsset[]>(
    () => [
      ...boards.map((board) => ({
        key: getWorkshopAssetKey("board", board.id),
        id: board.id,
        kind: "board" as const,
        label: board.label,
        imageUrl: board.boardImageUrl,
        floorPlacement: board.floorPlacement,
      })),
      ...weapons.map((weapon) => ({
        key: getWorkshopAssetKey("weapon", weapon.id),
        id: weapon.id,
        kind: "weapon" as const,
        label: weapon.label,
        imageUrl: weapon.weaponImageUrl,
        floorPlacement: weapon.floorPlacement,
      })),
    ],
    [boards, weapons],
  );

  useEffect(() => {
    setAssetFloorPositions((current) => {
      const next: Record<string, WorkshopFloorPlacement> = {};
      floorAssets.forEach((asset, index) => {
        const persisted = asset.floorPlacement;
        const existing = current[asset.key];
        if (isValidFloorPlacement(existing)) {
          next[asset.key] = existing;
          return;
        }
        if (isValidFloorPlacement(persisted)) {
          next[asset.key] = {
            x: clamp(persisted.x, 0, 1),
            y: clamp(persisted.y, 0, 1),
          };
          return;
        }
        next[asset.key] = getDefaultFloorPlacement(index, floorAssets.length);
      });
      return next;
    });
  }, [floorAssets]);

  useEffect(() => {
    if (boardsLoading) return;
    if (selectedBoardId && boards.some((board) => board.id === selectedBoardId)) {
      pendingBoardSelectionRef.current = null;
      return;
    }
    const hasPendingSavedSelection = pendingBoardSelectionRef.current === selectedBoardId;
    if (!selectedBoardId || hasPendingSavedSelection) return;
    setSelectedBoardId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("board");
      return next;
    }, { replace: true });
  }, [boards, boardsLoading, selectedBoardId, setSearchParams]);

  useEffect(() => {
    if (weaponsLoading) return;
    if (selectedWeaponId && weapons.some((weapon) => weapon.id === selectedWeaponId)) {
      pendingWeaponSelectionRef.current = null;
      return;
    }
    const hasPendingSavedSelection = pendingWeaponSelectionRef.current === selectedWeaponId;
    if (!selectedWeaponId || hasPendingSavedSelection) return;
    setSelectedWeaponId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("weapon");
      return next;
    }, { replace: true });
  }, [selectedWeaponId, setSearchParams, weapons, weaponsLoading]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );
  const selectedWeapon = useMemo(
    () => weapons.find((weapon) => weapon.id === selectedWeaponId) ?? null,
    [weapons, selectedWeaponId],
  );
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );
  const weaponNameByUrl = useMemo(
    () => new Map(WEAPON_ASSETS.map((weapon) => [weapon.url, weapon.name])),
    [],
  );
  const selectedWeaponAsset = useMemo(
    () => WEAPON_ASSETS.find((weapon) => weapon.url === selectedWeaponAssetUrl) ?? null,
    [selectedWeaponAssetUrl],
  );
  const cardEditorVars = useMemo(
    () => (editingCard ? buildCardVars(editingCard, "editor") : null),
    [editingCard],
  );
  const cardEditorWrapFrameClass = useMemo(
    () => (editingCard && getStaticFrameBackUrl(editingCard.prompts.rarity) != null ? " print-card--wrap-frame" : ""),
    [editingCard],
  );
  const isAdmin = userProfile?.isAdmin === true;
  const benchLoadout = useMemo(
    () => calculateBoardStats(normalizeBoardConfig(boardConfig)),
    [boardConfig],
  );

  const updateSearchSelection = ({
    boardId = selectedBoardId,
    weaponId = selectedWeaponId,
    cardId = selectedCardId,
  }: {
    boardId?: string | null;
    weaponId?: string | null;
    cardId?: string;
  }) => {
    const next = new URLSearchParams();
    if (boardId) next.set("board", boardId);
    if (weaponId) next.set("weapon", weaponId);
    if (cardId) next.set("card", cardId);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!selectedCard) {
      setEditingCard(null);
      return;
    }
    setEditingCard(selectedCard);
    setBoardConfig(normalizeBoardConfig(selectedCard.board.config));
  }, [selectedCard]);

  const focusTarget = searchParams.get("focus");

  useEffect(() => {
    if (!editingCard || !focusTarget) return;
    const focusKey = `${editingCard.id}:${focusTarget}`;
    if (handledFocusRef.current === focusKey) return;
    handledFocusRef.current = focusKey;
    const sectionMap: Record<string, React.RefObject<HTMLElement | null>> = {
      rename: cardEditorSectionRef,
      reposition: repositionSectionRef,
      refresh: refreshArtSectionRef,
    };
    const targetRef = sectionMap[focusTarget];
    if (!targetRef) return;
    const timer = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusTarget === "rename") {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [editingCard, focusTarget]);

  const handleBenchSave = async () => {
    setSavingBoard(true);
    setError("");
    setMessage("");
    try {
      const board = createWorkshopBoard(boardConfig, selectedCard?.id);
      setMessage("Generating transparent skateboard art for the workshop floor…");
      const boardImageUrl = await generateTransparentBoardArt(
        board.config,
        ignoreBoardCache ? { skipCache: true } : undefined,
      );
      const boardWithArt = { ...board, boardImageUrl };
      pendingBoardSelectionRef.current = board.id;
      await addBoard(boardWithArt);
      setSelectedBoardId(board.id);
      updateSearchSelection({ boardId: board.id });
      sfxSuccess();
      setMessage("Generated skateboard saved to the workshop floor.");
    } catch (saveError) {
      pendingBoardSelectionRef.current = null;
      setError(saveError instanceof Error ? saveError.message : "Failed to generate and save the board to the workshop.");
    } finally {
      setSavingBoard(false);
    }
  };

  const handleSelectCard = (cardId: string) => {
    setSelectedCardId(cardId);
    updateSearchSelection({ cardId });
  };

  const handleBoardPlacementChange = (placement: BoardPlacement) => {
    setEditingCard((current) => (
      current
        ? {
            ...current,
            board: {
              ...current.board,
              placement,
            },
          }
        : current
    ));
  };

  const handleCharacterPlacementChange = (placement: CharacterPlacement) => {
    setEditingCard((current) => (
      current
        ? {
            ...current,
            characterPlacement: placement,
          }
        : current
    ));
  };

  const handleWeaponPlacementChange = (placement: WeaponPlacement) => {
    setEditingCard((current) => (
      current
        ? {
            ...current,
            weaponPlacement: placement,
          }
        : current
    ));
  };

  const updateBoardPlacement = (patch: Partial<BoardPlacement>) => {
    if (!editingCard) return;
    handleBoardPlacementChange({
      ...editingCard.board.placement,
      ...patch,
    });
  };

  const updateCharacterPlacement = (patch: Partial<CharacterPlacement>) => {
    if (!editingCard?.characterPlacement) return;
    handleCharacterPlacementChange({
      ...editingCard.characterPlacement,
      ...patch,
    });
  };

  const updateWeaponPlacement = (patch: Partial<WeaponPlacement>) => {
    if (!editingCard?.weaponPlacement) return;
    handleWeaponPlacementChange({
      ...editingCard.weaponPlacement,
      ...patch,
    });
  };

  const handleResetCardLayout = () => {
    if (!selectedCard) return;
    sfxClick();
    setEditingCard(selectedCard);
  };

  const handleSaveCardLayout = () => {
    if (!editingCard) return;
    setSavingCardLayout(true);
    try {
      updateCard(editingCard);
      updateCardInDecks(editingCard);
      setMessage(`${editingCard.identity.name} now uses the updated card layout.`);
      setError("");
      sfxSuccess();
    } catch (saveError) {
      setMessage("");
      setError(saveError instanceof Error ? saveError.message : "Failed to save the updated card layout.");
    } finally {
      setSavingCardLayout(false);
    }
  };

  const handleCardNameChange = (name: string) => {
    setEditingCard((current) => (
      current ? { ...current, identity: { ...current.identity, name } } : current
    ));
  };

  const handleCardAgeChange = (age: string) => {
    setEditingCard((current) => (
      current ? { ...current, identity: { ...current.identity, age } } : current
    ));
  };

  const handleCardBioChange = (flavorText: string) => {
    setEditingCard((current) => (
      current
        ? {
            ...current,
            front: { ...current.front, flavorText, flavorTextEnglish: flavorText },
          }
        : current
    ));
  };

  const handleRefreshArt = (scope: "all" | "background" | "character" | "frame" | "board") => {
    sfxClick();
    setEditingCard((current) => {
      if (!current) return current;
      const clearBackground = scope === "all" || scope === "background";
      const clearCharacter = scope === "all" || scope === "character";
      const clearFrame = scope === "all" || scope === "frame";
      const clearBoard = scope === "all" || scope === "board";
      return {
        ...current,
        backgroundImageUrl: clearBackground ? undefined : current.backgroundImageUrl,
        characterImageUrl: clearCharacter ? undefined : current.characterImageUrl,
        frameImageUrl: clearFrame ? undefined : current.frameImageUrl,
        board: clearBoard ? { ...current.board, imageUrl: undefined } : current.board,
      };
    });
  };

  const handleSelectBoard = (boardId: string) => {
    sfxClick();
    setSelectedBoardId(boardId);
    updateSearchSelection({ boardId });
  };

  const handleDeselectBoard = () => {
    sfxClick();
    setSelectedBoardId(null);
    updateSearchSelection({ boardId: null });
  };

  const handleBenchSaveWeapon = async () => {
    if (!selectedWeaponAsset) {
      setError("Pick a workshop weapon before saving it to the floor.");
      return;
    }
    setSavingWeapon(true);
    setError("");
    setMessage("");
    try {
      const weapon = createWorkshopWeapon(selectedWeaponAsset.url, selectedWeaponAsset.name, selectedCard?.id);
      pendingWeaponSelectionRef.current = weapon.id;
      await addWeapon(weapon);
      setSelectedWeaponId(weapon.id);
      updateSearchSelection({ weaponId: weapon.id });
      sfxSuccess();
      setMessage("Saved weapon dropped onto the workshop floor.");
    } catch (saveError) {
      pendingWeaponSelectionRef.current = null;
      setError(saveError instanceof Error ? saveError.message : "Failed to save the weapon to the workshop.");
    } finally {
      setSavingWeapon(false);
    }
  };

  const handleSelectWeapon = (weaponId: string) => {
    sfxClick();
    setSelectedWeaponId(weaponId);
    updateSearchSelection({ weaponId });
  };

  const handleDeselectWeapon = () => {
    sfxClick();
    setSelectedWeaponId(null);
    updateSearchSelection({ weaponId: null });
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

  const handleGenerateSelectedBoardArt = async (forceIgnoreCache = false) => {
    if (!selectedBoard) return;
    setGeneratingBoardArtId(selectedBoard.id);
    setError("");
    setMessage("Generating transparent skateboard art for this saved board…");
    try {
      const boardImageUrl = await generateTransparentBoardArt(
        selectedBoard.config,
        forceIgnoreCache || ignoreBoardCache ? { skipCache: true } : undefined,
      );
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

  const handleScrapWeapon = async () => {
    if (!selectedWeapon) return;
    try {
      sfxRemove();
      await removeWeapon(selectedWeapon.id);
      setMessage("Saved weapon scrapped from the workshop floor.");
      setError("");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to scrap the saved weapon.");
    }
  };

  const handleApplyBoard = async () => {
    if (!selectedBoard || !selectedCard) {
      setError("Pick a saved board and a card before marrying the setup.");
      return;
    }
    const isAdmin = userProfile?.isAdmin ?? false;
    if (!isAdmin && (selectedCard.ozzies ?? 0) < WORKSHOP_REFORGE_FEE_OZZIES) {
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
      const appliedFee = isAdmin ? 0 : WORKSHOP_REFORGE_FEE_OZZIES;
      const reforgedCard = reforgeCardBoard(selectedCard, selectedBoard.config, {
        feeOzzies: appliedFee,
        boardImageUrl: selectedBoard.boardImageUrl,
      });
      updateCard(reforgedCard);
      updateCardInDecks(reforgedCard);
      await removeBoard(selectedBoard.id);
      sfxSuccess();
      setMessage(
        isAdmin
          ? `${selectedCard.identity.name} took the generated board. Stats updated.`
          : `${selectedCard.identity.name} took the generated board. Stats updated and ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies spent.`,
      );
    } catch (generationError) {
      const detail = generationError instanceof Error ? generationError.message : "Unknown workshop error.";
      setMessage("");
      setError(`Could not bind the board until skateboard art is ready: ${detail}`);
    } finally {
      setApplyingBoardId(null);
    }
  };

  const handleApplyWeapon = async () => {
    if (!selectedWeapon || !selectedCard) {
      setError("Pick a saved weapon and a card before marrying the setup.");
      return;
    }
    const isAdmin = userProfile?.isAdmin ?? false;
    if (!isAdmin && (selectedCard.ozzies ?? 0) < WORKSHOP_REFORGE_FEE_OZZIES) {
      setError(`${selectedCard.identity.name} needs ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies to cover the workshop fee.`);
      return;
    }

    setApplyingWeaponId(selectedWeapon.id);
    setError("");
    setMessage("");

    try {
      const appliedFee = isAdmin ? 0 : WORKSHOP_REFORGE_FEE_OZZIES;
      const reforgedCard = reforgeCardWeapon(selectedCard, selectedWeapon.weaponImageUrl, {
        feeOzzies: appliedFee,
      });
      updateCard(reforgedCard);
      updateCardInDecks(reforgedCard);
      await removeWeapon(selectedWeapon.id);
      sfxSuccess();
      setMessage(
        isAdmin
          ? `${selectedCard.identity.name} took the saved weapon. Card art updated.`
          : `${selectedCard.identity.name} took the saved weapon. Card art updated and ${WORKSHOP_REFORGE_FEE_OZZIES} Ozzies spent.`,
      );
    } catch (generationError) {
      const detail = generationError instanceof Error ? generationError.message : "Unknown workshop error.";
      setMessage("");
      setError(`Could not bind the weapon: ${detail}`);
    } finally {
      setApplyingWeaponId(null);
    }
  };

  const handleDragStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    assetKey: string,
    assetIndex: number,
  ) => {
    const stage = floorStageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const placement = assetFloorPositions[assetKey] ?? getDefaultFloorPlacement(assetIndex, floorAssets.length);
    const assetCenterX = bounds.left + (placement.x * bounds.width);
    const assetCenterY = bounds.top + (placement.y * bounds.height);
    dragSessionsRef.current[event.pointerId] = {
      assetKey,
      offsetX: event.clientX - assetCenterX,
      offsetY: event.clientY - assetCenterY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    activeDragCountsRef.current[assetKey] = (activeDragCountsRef.current[assetKey] ?? 0) + 1;
    setDraggingAssetKeys((current) => {
      const next = new Set(current);
      next.add(assetKey);
      return next;
    });
  };

  const persistFloorPlacement = (assetKey: string, x: number, y: number) => {
    const [assetKind, assetId] = assetKey.split(":") as [WorkshopAssetKind, string];
    if (assetKind === "board") {
      const board = boards.find((entry) => entry.id === assetId);
      if (!board) return;
      saveBoard({
        ...board,
        floorPlacement: { x, y },
        updatedAt: new Date().toISOString(),
      }).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Could not save board placement.");
      });
      return;
    }
    const weapon = weapons.find((entry) => entry.id === assetId);
    if (!weapon) return;
    saveWeapon({
      ...weapon,
      floorPlacement: { x, y },
      updatedAt: new Date().toISOString(),
    }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Could not save weapon placement.");
    });
  };

  const schedulePersistFloorPlacement = (assetKey: string, x: number, y: number) => {
    const existingTimer = keyboardPersistTimersRef.current[assetKey];
    if (typeof existingTimer === "number") {
      window.clearTimeout(existingTimer);
    }
    keyboardPersistTimersRef.current[assetKey] = window.setTimeout(() => {
      persistFloorPlacement(assetKey, x, y);
      delete keyboardPersistTimersRef.current[assetKey];
    }, KEYBOARD_PERSIST_DEBOUNCE_MS);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLButtonElement>, assetKey: string) => {
    const session = dragSessionsRef.current[event.pointerId];
    if (!session || session.assetKey !== assetKey) return;
    const stage = floorStageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const movedX = Math.abs(event.clientX - session.startX);
    const movedY = Math.abs(event.clientY - session.startY);
    if (!session.moved && (movedX > DRAG_MOVEMENT_THRESHOLD_PX || movedY > DRAG_MOVEMENT_THRESHOLD_PX)) {
      session.moved = true;
    }
    const x = clamp((event.clientX - bounds.left - session.offsetX) / bounds.width, 0, 1);
    const y = clamp((event.clientY - bounds.top - session.offsetY) / bounds.height, 0, 1);
    setAssetFloorPositions((current) => ({
      ...current,
      [assetKey]: { x, y },
    }));
  };

  const handleDragEnd = (assetKey: string, pointerId: number): boolean => {
    const session = dragSessionsRef.current[pointerId];
    if (!session || session.assetKey !== assetKey) return false;
    delete dragSessionsRef.current[pointerId];
    const existingTimer = keyboardPersistTimersRef.current[assetKey];
    if (typeof existingTimer === "number") {
      window.clearTimeout(existingTimer);
      delete keyboardPersistTimersRef.current[assetKey];
    }
    const placement = assetFloorPositions[assetKey];
    if (placement) {
      persistFloorPlacement(assetKey, placement.x, placement.y);
    }
    const activeCount = activeDragCountsRef.current[assetKey] ?? 0;
    if (activeCount <= 1) {
      delete activeDragCountsRef.current[assetKey];
      setDraggingAssetKeys((current) => {
        const next = new Set(current);
        next.delete(assetKey);
        return next;
      });
    } else {
      activeDragCountsRef.current[assetKey] = activeCount - 1;
    }
    return session.moved;
  };

  const isAdminUser = userProfile?.isAdmin ?? false;
  const marryButtonLabel = isAdminUser ? "Marry to Card · Free" : `Marry to Card · ${WORKSHOP_REFORGE_FEE_OZZIES} Oz`;

  return (
    <div className="page page--workshop">
      <video
        className="workshop-page-bg"
        src="/assets/backgrounds/workshop-bg.mp4?v=20260510"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="page-header">
        <div>
          <h1 className="page-title">Workshop</h1>
          <p className="page-sub">Save bench builds, edit forged cards (rename, reposition art, refresh art), and marry new skateboards or weapons to a card.</p>
        </div>
        <button className="btn-outline" type="button" onClick={() => navigate("/forge")}>
          ← Back to Card Forge
        </button>
      </div>

      <section className="workshop-hero">
        <div className="workshop-hero__copy">
          <p className="eyebrow">Garage Stash</p>
          <h2>Bench new hardware without re-forging the whole courier.</h2>
          <p>
            Save experimental skateboard builds and spare weapons to the workshop floor, then bind them to an existing
            card when a mission needs different gear access.
          </p>
        </div>
        <div className="workshop-hero__meta">
          <span><strong>{boards.length}</strong> saved boards</span>
          <span><strong>{weapons.length}</strong> saved weapons</span>
          <span><strong>{cards.length}</strong> forged cards</span>
          <span>{isAdminUser ? <strong>Free (admin)</strong> : <><strong>{WORKSHOP_REFORGE_FEE_OZZIES}</strong> Oz workshop fee</>}</span>
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
            <div className="workshop-panel-heading__actions">
              <button className="btn-primary btn-sm" type="button" onClick={handleBenchSave} disabled={savingBoard}>
                {savingBoard ? "Generating…" : "Generate & Save to Floor"}
              </button>
              {isAdmin && (
                <label className="workshop-admin-toggle">
                  <input
                    id={workshopIgnoreCacheInputId}
                    type="checkbox"
                    checked={ignoreBoardCache}
                    onChange={(event) => setIgnoreBoardCache(event.target.checked)}
                  />
                  <span>Force regenerate (ignore cache)</span>
                </label>
              )}
            </div>
          </div>
          <BoardBuilder value={boardConfig} onChange={setBoardConfig} showLockIn={false} />
          <div className="workshop-bench__preview">
            <SkateboardStatsPanel loadout={benchLoadout} config={normalizeBoardConfig(boardConfig)} />
          </div>
        </section>

        <div className="workshop-sidebar">
          <section className="workshop-detail">
            <div className="workshop-panel-heading">
              <div>
                <p className="eyebrow">Weapons Rack</p>
                <h2>Save a spare weapon</h2>
              </div>
              <div className="workshop-panel-heading__actions">
                <button className="btn-primary btn-sm" type="button" onClick={handleBenchSaveWeapon} disabled={savingWeapon}>
                  {savingWeapon ? "Saving…" : "Save to Floor"}
                </button>
              </div>
            </div>

            <label className="workshop-field">
              <span>Weapon target</span>
              <div className="workshop-select">
                <select
                  className="input workshop-select__control"
                  value={selectedWeaponAssetUrl}
                  onChange={(event) => setSelectedWeaponAssetUrl(event.target.value)}
                >
                  {WEAPON_ASSETS.map((weapon) => (
                    <option key={weapon.url} value={weapon.url}>
                      {weapon.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="workshop-bench__preview">
              {selectedWeaponAsset ? (
                <div className="workshop-board-art">
                  <img
                    src={selectedWeaponAsset.url}
                    alt={selectedWeaponAsset.name}
                    className="workshop-board-art__img workshop-board-art__img--weapon"
                  />
                </div>
              ) : (
                <div className="workshop-board-art workshop-board-art--empty">
                  <span>Pick a weapon</span>
                </div>
              )}
            </div>
          </section>

          <section className="workshop-detail" ref={cardEditorSectionRef}>
            <div className="workshop-panel-heading">
              <div>
                <p className="eyebrow">Card Editor</p>
                <h2>Rename, reposition art, and refresh art</h2>
              </div>
            </div>
            <p className="form-hint">
              Everything you need to edit a forged card lives here: rename the courier, reposition each art layer, and
              refresh stale generated art back to the live render.
            </p>

            <label className="workshop-field">
              <span>Card target</span>
              <div className="workshop-select">
                <select
                  className="input workshop-select__control"
                  value={selectedCardId}
                  onChange={(event) => handleSelectCard(event.target.value)}
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
                <span>Current weapon: {selectedCard.weaponImageUrl ? (weaponNameByUrl.get(selectedCard.weaponImageUrl) ?? "Custom weapon") : "None equipped"}</span>
                <span>Available Ozzies: {selectedCard.ozzies ?? 0}</span>
              </div>
            )}

            {editingCard && cardEditorVars && (
              <>
                <label className="workshop-field">
                  <span>Rename courier</span>
                  <input
                    ref={renameInputRef}
                    className="input"
                    type="text"
                    value={editingCard.identity.name}
                    onChange={(event) => handleCardNameChange(event.target.value)}
                    aria-label="Rename courier"
                    placeholder="Courier name"
                  />
                </label>
                <label className="workshop-field">
                  <span>Age</span>
                  <input
                    className="input"
                    type="text"
                    value={editingCard.identity.age ?? ""}
                    onChange={(event) => handleCardAgeChange(event.target.value)}
                    aria-label="Courier age"
                    placeholder="Optional"
                  />
                </label>
                <label className="workshop-field">
                  <span>Bio</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={editingCard.front.flavorTextEnglish ?? editingCard.front.flavorText ?? ""}
                    onChange={(event) => handleCardBioChange(event.target.value)}
                    aria-label="Courier bio"
                    placeholder="Optional flavor text"
                  />
                </label>
                <CardContainer cardVars={cardEditorVars}>
                  <div className="print-preview-area print-preview-area--workshop">
                    <div className="print-preview-slot">
                      <p className="print-preview-label">Front</p>
                      <div className="print-card-wrap">
                        <div className={`print-card print-card--front${cardEditorWrapFrameClass}`}>
                          <SkaterCardFace
                            face="front"
                            card={editingCard}
                            backgroundImageUrl={editingCard.backgroundImageUrl}
                            characterImageUrl={editingCard.characterImageUrl}
                            frameImageUrl={editingCard.frameImageUrl}
                            weaponImageUrl={editingCard.weaponImageUrl}
                            artEditable
                            metadataEditable
                            onNameChange={handleCardNameChange}
                            onAgeChange={handleCardAgeChange}
                            onBioChange={handleCardBioChange}
                            onBoardPlacementChange={handleBoardPlacementChange}
                            onCharacterPlacementChange={handleCharacterPlacementChange}
                            onWeaponPlacementChange={handleWeaponPlacementChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContainer>
                <div ref={repositionSectionRef} className="edit-form-section-header" style={{ marginTop: 16 }}>
                  ↔ Reposition Art
                </div>
                <p className="form-hint" style={{ marginTop: 12 }}>
                  Drag layers on the card face to reposition them, or use the sliders below for precise size and rotation changes.
                  On touch devices, pinch or rotate to scale and turn the layer.
                </p>
                <div className="edit-card-layout-grid">
                  <div className="blend-control">
                    <label className="blend-control__label">
                      <span>Skateboard Size</span>
                      <span>{Math.round(editingCard.board.placement.scale * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      className="range-slider"
                      min={BOARD_PLACEMENT_MIN_SCALE}
                      max={BOARD_PLACEMENT_MAX_SCALE}
                      step={BOARD_PLACEMENT_SCALE_STEP}
                      value={editingCard.board.placement.scale}
                      onChange={(event) => updateBoardPlacement({ scale: Number(event.target.value) })}
                      aria-label="Workshop skateboard size"
                    />
                  </div>
                  <div className="blend-control">
                    <label className="blend-control__label">
                      <span>Skateboard Rotation</span>
                      <span>{Math.round(editingCard.board.placement.rotationDeg)}°</span>
                    </label>
                    <input
                      type="range"
                      className="range-slider"
                      min={-180}
                      max={180}
                      step={1}
                      value={editingCard.board.placement.rotationDeg}
                      onChange={(event) => updateBoardPlacement({ rotationDeg: Number(event.target.value) })}
                      aria-label="Workshop skateboard rotation"
                    />
                  </div>
                  {editingCard.characterPlacement && (
                    <>
                      <div className="blend-control">
                        <label className="blend-control__label">
                          <span>Character Size</span>
                          <span>{Math.round(editingCard.characterPlacement.scale * 100)}%</span>
                        </label>
                        <input
                          type="range"
                          className="range-slider"
                          min={CHARACTER_PLACEMENT_MIN_SCALE}
                          max={CHARACTER_PLACEMENT_MAX_SCALE}
                          step={CHARACTER_PLACEMENT_SCALE_STEP}
                          value={editingCard.characterPlacement.scale}
                          onChange={(event) => updateCharacterPlacement({ scale: Number(event.target.value) })}
                          aria-label="Workshop character size"
                        />
                      </div>
                      <div className="blend-control">
                        <label className="blend-control__label">
                          <span>Character Rotation</span>
                          <span>{Math.round(editingCard.characterPlacement.rotationDeg)}°</span>
                        </label>
                        <input
                          type="range"
                          className="range-slider"
                          min={-180}
                          max={180}
                          step={1}
                          value={editingCard.characterPlacement.rotationDeg}
                          onChange={(event) => updateCharacterPlacement({ rotationDeg: Number(event.target.value) })}
                          aria-label="Workshop character rotation"
                        />
                      </div>
                    </>
                  )}
                  {editingCard.weaponPlacement && (
                    <>
                      <div className="blend-control">
                        <label className="blend-control__label">
                          <span>Weapon Size</span>
                          <span>{Math.round(editingCard.weaponPlacement.scale * 100)}%</span>
                        </label>
                        <input
                          type="range"
                          className="range-slider"
                          min={WEAPON_PLACEMENT_MIN_SCALE}
                          max={WEAPON_PLACEMENT_MAX_SCALE}
                          step={WEAPON_PLACEMENT_SCALE_STEP}
                          value={editingCard.weaponPlacement.scale}
                          onChange={(event) => updateWeaponPlacement({ scale: Number(event.target.value) })}
                          aria-label="Workshop weapon size"
                        />
                      </div>
                      <div className="blend-control">
                        <label className="blend-control__label">
                          <span>Weapon Rotation</span>
                          <span>{Math.round(editingCard.weaponPlacement.rotationDeg)}°</span>
                        </label>
                        <input
                          type="range"
                          className="range-slider"
                          min={-180}
                          max={180}
                          step={1}
                          value={editingCard.weaponPlacement.rotationDeg}
                          onChange={(event) => updateWeaponPlacement({ rotationDeg: Number(event.target.value) })}
                          aria-label="Workshop weapon rotation"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div ref={refreshArtSectionRef} className="edit-form-section-header" style={{ marginTop: 16 }}>
                  ✨ Refresh Art
                </div>
                <p className="form-hint" style={{ marginTop: 12 }}>
                  Drop a stale saved art layer so the card falls back to its live render. Useful when generated art no
                  longer matches the current build. Save when you are happy with the result.
                </p>
                <div className="edit-card-art-actions">
                  <button className="btn-outline btn-sm" type="button" onClick={() => handleRefreshArt("all")}>
                    Refresh All Art
                  </button>
                  <button
                    className="btn-outline btn-sm"
                    type="button"
                    onClick={() => handleRefreshArt("background")}
                    disabled={!editingCard.backgroundImageUrl}
                  >
                    Refresh Background
                  </button>
                  <button
                    className="btn-outline btn-sm"
                    type="button"
                    onClick={() => handleRefreshArt("character")}
                    disabled={!editingCard.characterImageUrl}
                  >
                    Refresh Character
                  </button>
                  <button
                    className="btn-outline btn-sm"
                    type="button"
                    onClick={() => handleRefreshArt("frame")}
                    disabled={!editingCard.frameImageUrl}
                  >
                    Refresh Frame
                  </button>
                  <button
                    className="btn-outline btn-sm"
                    type="button"
                    onClick={() => handleRefreshArt("board")}
                    disabled={!editingCard.board.imageUrl}
                  >
                    Refresh Board
                  </button>
                </div>
                <div className="workshop-detail__actions">
                  <button className="btn-outline btn-sm" type="button" onClick={handleResetCardLayout}>
                    Reset Changes
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    type="button"
                    onClick={handleSaveCardLayout}
                    disabled={savingCardLayout}
                  >
                    {savingCardLayout ? "Saving…" : "Save Card"}
                  </button>
                </div>
              </>
            )}
          </section>

          {selectedBoard && (
            <section className="workshop-detail">
              <div className="workshop-panel-heading">
                <div>
                  <p className="eyebrow">Marriage Bay</p>
                  <h2>Bind a saved board to a card</h2>
                </div>
              </div>

              <div className="workshop-detail__meta">
                <strong>{selectedBoard.label}</strong>
                <span>Saved {new Date(selectedBoard.createdAt).toLocaleString()}</span>
              </div>
              <SkateboardStatsPanel loadout={selectedBoard.loadout} config={selectedBoard.config} />
              <div className="workshop-detail__actions">
                <button
                  className="btn-outline btn-sm"
                  type="button"
                  onClick={handleDeselectBoard}
                >
                  Selection: Off
                </button>
                {!selectedBoard.boardImageUrl && (
                  <button
                    className="btn-outline btn-sm"
                    type="button"
                    onClick={() => void handleGenerateSelectedBoardArt()}
                    disabled={generatingBoardArtId === selectedBoard.id}
                  >
                    {generatingBoardArtId === selectedBoard.id ? "Generating…" : "Generate Board Art"}
                  </button>
                )}
                {isAdmin && selectedBoard.boardImageUrl && (
                  <button
                    className="btn-outline btn-sm"
                    type="button"
                    onClick={() => void handleGenerateSelectedBoardArt(true)}
                    disabled={generatingBoardArtId === selectedBoard.id}
                    title="Admin only — bypasses the per-user board cache for a fresh render."
                    aria-label="Force regenerate board art and ignore cache"
                  >
                    {generatingBoardArtId === selectedBoard.id ? "⏳ Regenerating…" : "Force regenerate (ignore cache)"}
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
                  {applyingBoardId === selectedBoard.id ? "Marrying…" : marryButtonLabel}
                </button>
              </div>
            </section>
          )}

          {selectedWeapon && (
            <section className="workshop-detail">
              <div className="workshop-panel-heading">
                <div>
                  <p className="eyebrow">Weapons Bay</p>
                  <h2>Bind a saved weapon to a card</h2>
                </div>
              </div>

              <div className="workshop-detail__meta">
                <strong>{selectedWeapon.label}</strong>
                <span>Saved {new Date(selectedWeapon.createdAt).toLocaleString()}</span>
              </div>
              <div className="workshop-bench__preview">
                <div className="workshop-board-art">
                  <img
                    src={selectedWeapon.weaponImageUrl}
                    alt={selectedWeapon.label}
                    className="workshop-board-art__img workshop-board-art__img--weapon"
                  />
                </div>
              </div>
              <div className="workshop-detail__actions">
                <button
                  className="btn-outline btn-sm"
                  type="button"
                  onClick={handleDeselectWeapon}
                >
                  Selection: Off
                </button>
                <button className="btn-danger btn-sm" type="button" onClick={handleScrapWeapon}>
                  Scrap Weapon
                </button>
                <button
                  className="btn-primary btn-sm"
                  type="button"
                  onClick={handleApplyWeapon}
                  disabled={!selectedCard || applyingWeaponId === selectedWeapon.id}
                >
                  {applyingWeaponId === selectedWeapon.id ? "Marrying…" : marryButtonLabel}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="workshop-floor-stage" aria-label="Saved workshop gear paper dolls" ref={floorStageRef}>
        {floorAssets.length > 0 && (
          <p className="workshop-floor__drag-hint">Drag gear anywhere on the floor</p>
        )}
        <div className="workshop-floor__canvas">
          {(boardsLoading || weaponsLoading) && (
            <div className="empty-state workshop-empty">
              <span className="empty-icon">🛹</span>
              <p>Loading saved workshop gear…</p>
            </div>
          )}
          {!boardsLoading && !weaponsLoading && floorAssets.length === 0 && (
            <div className="empty-state workshop-empty">
              <span className="empty-icon">🛹</span>
              <p>No saved workshop gear yet.</p>
              <p className="page-sub">Generate a board or save a weapon and it will land directly on the workshop floor.</p>
            </div>
          )}
          {!boardsLoading && !weaponsLoading && floorAssets.map((asset, index) => {
            const tilt = ((index % 5) - 2) * 3;
            const isDragging = draggingAssetKeys.has(asset.key);
            const placement = assetFloorPositions[asset.key] ?? getDefaultFloorPlacement(index, floorAssets.length);
            const isSelected = asset.kind === "board" ? selectedBoardId === asset.id : selectedWeaponId === asset.id;
            return (
              <button
                key={asset.key}
                type="button"
                className={[
                  "workshop-board-card",
                  asset.kind === "weapon" ? "workshop-board-card--weapon" : "",
                  isSelected ? "workshop-board-card--active" : "",
                  isDragging ? "workshop-board-card--dragging" : "",
                ].filter(Boolean).join(" ")}
                style={{
                  left: `${placement.x * 100}%`,
                  top: `${placement.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
                  zIndex: isDragging ? 6 : 4,
                }}
                aria-label={asset.kind === "board"
                  ? `Select ${asset.label} for card binding`
                  : `Select ${asset.label} weapon for card binding`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (asset.kind === "board") {
                      handleSelectBoard(asset.id);
                    } else {
                      handleSelectWeapon(asset.id);
                    }
                    return;
                  }
                  let dx = 0;
                  let dy = 0;
                  const step = event.shiftKey ? KEYBOARD_NUDGE_STEP_SHIFT : KEYBOARD_NUDGE_STEP;
                  if (event.key === "ArrowLeft") dx = -step;
                  if (event.key === "ArrowRight") dx = step;
                  if (event.key === "ArrowUp") dy = -step;
                  if (event.key === "ArrowDown") dy = step;
                  if (dx === 0 && dy === 0) return;
                  event.preventDefault();
                  const currentPlacement = assetFloorPositions[asset.key] ?? getDefaultFloorPlacement(index, floorAssets.length);
                  const next = {
                    x: clamp(currentPlacement.x + dx, 0, 1),
                    y: clamp(currentPlacement.y + dy, 0, 1),
                  };
                  setAssetFloorPositions((current) => ({
                    ...current,
                    [asset.key]: next,
                  }));
                  schedulePersistFloorPlacement(asset.key, next.x, next.y);
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  handleDragStart(event, asset.key, index);
                }}
                onPointerMove={(event) => handleDragMove(event, asset.key)}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  const moved = handleDragEnd(asset.key, event.pointerId);
                  if (!moved) {
                    if (asset.kind === "board") {
                      handleSelectBoard(asset.id);
                    } else {
                      handleSelectWeapon(asset.id);
                    }
                  }
                }}
                onPointerCancel={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  handleDragEnd(asset.key, event.pointerId);
                }}
              >
                {asset.imageUrl ? (
                  <div className="workshop-board-card__art">
                    <img
                      src={asset.imageUrl}
                      alt={asset.label}
                      className={`workshop-board-card__art-img${asset.kind === "weapon" ? " workshop-board-card__art-img--weapon" : ""}`}
                      draggable={false}
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
