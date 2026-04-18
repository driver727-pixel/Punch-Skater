import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface FactionImageEntry {
  factionName: string;
  imageUrl: string;
}

function resolveFactionImageUrl(imageUrl: string, imageVersion?: number): string {
  if (!imageVersion) return imageUrl;
  return `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}v=${imageVersion}`;
}

/** Returns a map of faction slug → image URL, updated in real time. */
export function useFactionImages(): Map<string, string> {
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!db) return;

    const unsub = onSnapshot(collection(db, "factionImages"), (snap) => {
      const entries = new Map<string, string>();
      snap.forEach((doc) => {
        const data = doc.data();
        if (typeof data.imageUrl === "string" && data.imageUrl) {
          const imageVersion = typeof data.imageVersion === "number" ? data.imageVersion : undefined;
          entries.set(doc.id, resolveFactionImageUrl(data.imageUrl, imageVersion));
        }
      });
      setImageMap(entries);
    });

    return unsub;
  }, []);

  return imageMap;
}
