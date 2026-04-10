import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import type { Faction } from "../lib/types";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { FACTION_LORE } from "../lib/lore";
import { loadFactionDiscoveries, saveFactionDiscoveries } from "../lib/storage";

const VALID_FACTIONS = new Set<Faction>(FACTION_LORE.map((entry) => entry.name));

function dedupeFactions(values: string[]): Faction[] {
  return Array.from(new Set(values.filter((value): value is Faction => VALID_FACTIONS.has(value as Faction)))).sort();
}

export function useFactionDiscovery() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [discoveredFactions, setDiscoveredFactions] = useState<Faction[]>([]);

  useEffect(() => {
    if (!uid || !db) {
      setDiscoveredFactions(dedupeFactions(loadFactionDiscoveries()));
      return;
    }

    const localDiscoveries = dedupeFactions(loadFactionDiscoveries());
    if (localDiscoveries.length > 0) {
      setDoc(doc(db, "userProfiles", uid), { discoveredFactions: localDiscoveries }, { merge: true }).catch(console.error);
    }

    const unsub = onSnapshot(doc(db, "userProfiles", uid), (snap) => {
      const profileDiscoveries = Array.isArray(snap.data()?.discoveredFactions)
        ? (snap.data()?.discoveredFactions as string[])
        : [];
      const merged = dedupeFactions([...localDiscoveries, ...profileDiscoveries]);
      setDiscoveredFactions(merged);
      saveFactionDiscoveries(merged);

      if (merged.length !== profileDiscoveries.length) {
        setDoc(doc(db, "userProfiles", uid), { discoveredFactions: merged }, { merge: true }).catch(console.error);
      }
    });

    return unsub;
  }, [uid]);

  const unlockFaction = useCallback((faction: Faction) => {
    setDiscoveredFactions((prev) => {
      const next = dedupeFactions([...prev, faction]);
      saveFactionDiscoveries(next);

      if (uid && db) {
        setDoc(doc(db, "userProfiles", uid), { discoveredFactions: next }, { merge: true }).catch(console.error);
      }

      return next;
    });
  }, [uid]);

  const hasFaction = useCallback((faction: Faction) => discoveredFactions.includes(faction), [discoveredFactions]);

  return {
    discoveredFactions,
    hasFaction,
    unlockFaction,
  };
}
