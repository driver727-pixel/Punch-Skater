import { useCallback, useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { loadWorkshopBoards, saveWorkshopBoards } from "../lib/storage";
import type { WorkshopBoardPayload } from "../lib/types";

function sortBoards(boards: WorkshopBoardPayload[]): WorkshopBoardPayload[] {
  return [...boards].sort((a, b) => (
    b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  ));
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
      return;
    }

    guestHydratingRef.current = false;
    initialGuestBoardsRef.current = null;
    lastSavedBoardsRef.current = [];
    setBoards([]);

    const colRef = collection(db, "users", uid, "workshopBoards");
    const unsub = onSnapshot(colRef, (snap) => {
      setBoards(sortBoards(snap.docs.map((entry) => entry.data() as WorkshopBoardPayload)));
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

  const saveBoard = useCallback((board: WorkshopBoardPayload) => {
    if (uid) {
      setDoc(doc(db, "users", uid, "workshopBoards", board.id), board).catch(console.error);
      return;
    }
    setBoards((prev) => sortBoards([...prev.filter((entry) => entry.id !== board.id), board]));
  }, [uid]);

  const addBoard = useCallback((board: WorkshopBoardPayload) => {
    saveBoard(board);
  }, [saveBoard]);

  const removeBoard = useCallback((boardId: string) => {
    if (uid) {
      deleteDoc(doc(db, "users", uid, "workshopBoards", boardId)).catch(console.error);
      return;
    }
    setBoards((prev) => prev.filter((board) => board.id !== boardId));
  }, [uid]);

  return {
    boards,
    addBoard,
    saveBoard,
    removeBoard,
  };
}
