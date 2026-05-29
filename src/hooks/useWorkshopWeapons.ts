import { useCallback, useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { loadWorkshopWeapons, saveWorkshopWeapons } from "../lib/storage";
import type { WorkshopWeaponPayload } from "../lib/types";

function sortWeapons(weapons: WorkshopWeaponPayload[]): WorkshopWeaponPayload[] {
  return [...weapons].sort((a, b) => {
    const aOrder = a.sortOrder ?? Infinity;
    const bOrder = b.sortOrder ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}

function shallowEqualWeaponArrays(previous: WorkshopWeaponPayload[], next: WorkshopWeaponPayload[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  return previous.every((weapon, index) => weapon === next[index]);
}

export function useWorkshopWeapons() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [weapons, setWeapons] = useState<WorkshopWeaponPayload[]>(() => loadWorkshopWeapons());
  const [isLoading, setIsLoading] = useState(() => Boolean(uid));
  const lastSavedWeaponsRef = useRef<WorkshopWeaponPayload[]>(weapons);
  const guestHydratingRef = useRef(!uid);
  const initialGuestWeaponsRef = useRef<WorkshopWeaponPayload[] | null>(null);

  useEffect(() => {
    if (!uid) {
      const localWeapons = sortWeapons(loadWorkshopWeapons());
      guestHydratingRef.current = true;
      initialGuestWeaponsRef.current = localWeapons;
      lastSavedWeaponsRef.current = localWeapons;
      setWeapons(localWeapons);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    guestHydratingRef.current = false;
    initialGuestWeaponsRef.current = null;
    lastSavedWeaponsRef.current = [];
    setWeapons([]);

    const colRef = collection(db, "users", uid, "workshopWeapons");
    const unsub = onSnapshot(colRef, (snap) => {
      setWeapons(sortWeapons(snap.docs.map((entry) => entry.data() as WorkshopWeaponPayload)));
      setIsLoading(false);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (uid) return;

    if (guestHydratingRef.current) {
      if (!initialGuestWeaponsRef.current || !shallowEqualWeaponArrays(initialGuestWeaponsRef.current, weapons)) return;
      guestHydratingRef.current = false;
    }

    if (shallowEqualWeaponArrays(lastSavedWeaponsRef.current, weapons)) return;

    saveWorkshopWeapons(weapons);
    lastSavedWeaponsRef.current = weapons;
  }, [weapons, uid]);

  const saveWeapon = useCallback(async (weapon: WorkshopWeaponPayload) => {
    if (uid) {
      await setDoc(doc(db, "users", uid, "workshopWeapons", weapon.id), weapon, { merge: true });
      return;
    }
    setWeapons((prev) => {
      const existing = prev.find((entry) => entry.id === weapon.id);
      const nextWeapon = existing ? { ...existing, ...weapon } : weapon;
      return sortWeapons([...prev.filter((entry) => entry.id !== weapon.id), nextWeapon]);
    });
  }, [uid]);

  const addWeapon = useCallback(async (weapon: WorkshopWeaponPayload) => {
    await saveWeapon(weapon);
  }, [saveWeapon]);

  const removeWeapon = useCallback(async (weaponId: string) => {
    if (uid) {
      await deleteDoc(doc(db, "users", uid, "workshopWeapons", weaponId));
      return;
    }
    setWeapons((prev) => prev.filter((weapon) => weapon.id !== weaponId));
  }, [uid]);

  return {
    weapons,
    isLoading,
    addWeapon,
    saveWeapon,
    removeWeapon,
  };
}
