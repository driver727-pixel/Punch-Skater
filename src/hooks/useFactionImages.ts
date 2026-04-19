import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FACTION_LORE } from "../lib/lore";
import { factionSlug } from "../lib/factionSlug";
import { getStaticFactionImageUrl } from "../services/staticAssets";
import type { Faction } from "../lib/types";

export interface FactionImageEntry {
  factionName: string;
  imageUrl: string;
}

/** Returns a map of faction slug → image URL, updated in real time.
 *
 * Static asset images (public/assets/factions/) are used as the baseline.
 * Any image uploaded via the Admin panel (Firebase) overrides the static one
 * for that faction.
 */
export function useFactionImages(): Map<string, string> {
  const [imageMap, setImageMap] = useState<Map<string, string>>(() => {
    const seed = new Map<string, string>();
    for (const entry of FACTION_LORE) {
      const url = getStaticFactionImageUrl(entry.name as Faction);
      if (url) seed.set(factionSlug(entry.name), url);
    }
    return seed;
  });

  useEffect(() => {
    if (!db) return;

    const unsub = onSnapshot(collection(db, "factionImages"), (snap) => {
      setImageMap((prev) => {
        const next = new Map(prev);
        snap.forEach((doc) => {
          const data = doc.data();
          if (typeof data.imageUrl === "string" && data.imageUrl) {
            next.set(doc.id, data.imageUrl);
          }
        });
        return next;
      });
    });

    return unsub;
  }, []);

  return imageMap;
}
