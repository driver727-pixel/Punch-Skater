import { useCallback, useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { loadWorkshopBoards, saveWorkshopBoards } from "../lib/storage";
import type { WorkshopBoardPayload } from "../lib/types";

function sortBoards(boards: WorkshopBoardPayload[]): WorkshopBoardPayload[] {
  return [...boards].sort((a, b) => {
    const aOrder = a.sortOrder ?? Infinity;
    const bOrder = b.sortOrder ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}

function shallowEqualBoardArrays(previous: WorkshopBoardPayload[], next: WorkshopBoardPayload[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  return previous.every((board, index) => board === next[index]);
}

export function useWorkshopBoards() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [boards, setBoards] = useState<WorkshopBoardPayload[]>(() => loadWorkshopBoards());
  const [isLoading, setIsLoading] = useState(() => Boolean(uid));
  const lastSavedBoardsRef = useRef<WorkshopBoardPayload[]>(boards);
  const guestHydratingRef = useRef(!uid);
  const initialGuestBoardsRef = useRef<WorkshopBoardPayload[] | null>(null);

  useEffect(() => {
    if (!uid) {
      const localBoards = sortBoards(loadWorkshopBoards());
      guestHydratingRef.current = true;
      initialGuestBoardsRef.current = localBoards;
      lastSavedBoardsRef.current = localBoards;
      setBoards(localBoards);
      setIsLoading(false);
      return;
    }

    if (!db) return;

    setIsLoading(true);
    guestHydratingRef.current = false;
    initialGuestBoardsRef.current = null;
    lastSavedBoardsRef.current = [];
    setBoards([]);

    const colRef = collection(db, "users", uid, "workshopBoards");
    const unsub = onSnapshot(colRef, (snap) => {
      setBoards(sortBoards(snap.docs.map((entry) => entry.data() as WorkshopBoardPayload)));
      setIsLoading(false);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (uid) return;

    if (guestHydratingRef.current) {
      if (!initialGuestBoardsRef.current || !shallowEqualBoardArrays(initialGuestBoardsRef.current, boards)) return;
      guestHydratingRef.current = false;
    }

    if (shallowEqualBoardArrays(lastSavedBoardsRef.current, boards)) return;

    saveWorkshopBoards(boards);
    lastSavedBoardsRef.current = boards;
  }, [boards, uid]);

  const saveBoard = useCallback(async (board: WorkshopBoardPayload) => {
    if (uid && db) {
      await setDoc(doc(db, "users", uid, "workshopBoards", board.id), board, { merge: true });
      return;
    }
    setBoards((prev) => {
      const existing = prev.find((entry) => entry.id === board.id);
      const nextBoard = existing ? { ...existing, ...board } : board;
      return sortBoards([...prev.filter((entry) => entry.id !== board.id), nextBoard]);
    });
  }, [uid]);

  const addBoard = useCallback(async (board: WorkshopBoardPayload) => {
    await saveBoard(board);
  }, [saveBoard]);

  const removeBoard = useCallback(async (boardId: string) => {
    if (uid && db) {
      await deleteDoc(doc(db, "users", uid, "workshopBoards", boardId));
      return;
    }
    setBoards((prev) => prev.filter((board) => board.id !== boardId));
  }, [uid]);

  const reorderBoards = useCallback(async (orderedIds: string[]) => {
    setBoards((prev) => {
      const byId = new Map(prev.map((b) => [b.id, b]));
      const orderedSet = new Set(orderedIds);
      const reordered = orderedIds
        .map((id, index) => {
          const board = byId.get(id);
          return board ? { ...board, sortOrder: index } : null;
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);
      // Preserve any boards whose IDs were not in orderedIds (append after reordered ones)
      const trailing = prev.filter((b) => !orderedSet.has(b.id));
      return [...reordered, ...trailing];
    });
    if (uid && db) {
      const firestore = db;
      await Promise.all(
        orderedIds.map((id, index) => {
          const ref = doc(firestore, "users", uid, "workshopBoards", id);
          return setDoc(ref, { sortOrder: index }, { merge: true });
        }),
      );
    }
  }, [uid]);

  return {
    boards,
    isLoading,
    addBoard,
    saveBoard,
    removeBoard,
    reorderBoards,
  };
}
