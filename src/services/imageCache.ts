import { auth, db } from "../lib/firebase";
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  type DocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";

const COLLECTION = "imageCache";

/** Generation metadata stored alongside a cached image URL. */
export interface CacheEntryMeta {
  /** The text prompt used to generate this image. */
  prompt?: string;
  /** Layer type: "background" | "character" | "frame" | "board-img". */
  layer?: string;
  /** The seed string passed to the generator. */
  seed?: string;
}

/** A full cache entry as returned by listCachedImages. */
export interface CacheEntry {
  /** Firestore document ID (encoded cache key). */
  id: string;
  imageUrl: string;
  createdAt: Timestamp | null;
  prompt?: string;
  layer?: string;
  seed?: string;
}

/**
 * Sanitise a seed string so it can be used as a Firestore document ID.
 * Firestore IDs must not contain '/', must not be '.' or '..', and are
 * capped at 1,500 bytes. Our seeds never come close to this limit but we
 * guard anyway.
 */
function encodeKey(key: string): string {
  const sanitized = key.replace(/\//g, "_");
  // Firestore disallows the literal IDs '.' and '..'
  if (sanitized === "." || sanitized === "..") return `_${sanitized}`;
  // Enforce the 1,500-byte document-ID ceiling
  return sanitized.slice(0, 1500);
}

/**
 * Returns a cached image URL for the given cache key, or null if not cached.
 * Errors are swallowed so a cache miss never blocks generation.
 */
export async function getCachedImage(cacheKey: string): Promise<string | null> {
  try {
    const ref = doc(db, COLLECTION, encodeKey(cacheKey));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const url = (snap.data() as { imageUrl?: string }).imageUrl;
      return url ?? null;
    }
  } catch (err) {
    console.warn("Image cache read failed:", err);
  }
  return null;
}

/**
 * Stores a generated image URL in the cache under the given key, along with
 * optional generation metadata (prompt, layer, seed).
 * Errors are swallowed so a write failure never breaks the UI.
 * The Firestore security rule allows `create` but not `update`, so this is
 * effectively a write-once store — concurrent writes for the same key are
 * harmless because the second write is silently rejected.
 */
export async function setCachedImage(
  cacheKey: string,
  imageUrl: string,
  meta?: CacheEntryMeta,
): Promise<void> {
  if (!db || !auth?.currentUser) return;
  try {
    const ref = doc(db, COLLECTION, encodeKey(cacheKey));
    // Avoid a doomed write when another user has already populated this
    // immutable cache entry; the extra read is cheaper than a rejected write.
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    const data: Record<string, unknown> = {
      imageUrl,
      createdAt: serverTimestamp(),
      ...(meta?.prompt ? { prompt: meta.prompt } : {}),
      ...(meta?.layer  ? { layer:  meta.layer  } : {}),
      ...(meta?.seed   ? { seed:   meta.seed   } : {}),
    };
    await setDoc(ref, data, { merge: false });
  } catch (err) {
    // Non-critical — may fail if another user already populated this entry
    console.warn("Image cache write failed:", err);
  }
}

/**
 * Deletes a cache entry.  Only succeeds when the Firestore security rule
 * permits it (admin users only).
 * @throws If the delete operation fails (e.g. permission denied).
 */
export async function deleteCachedImage(encodedId: string): Promise<void> {
  const ref = doc(db, COLLECTION, encodedId);
  await deleteDoc(ref);
}

const CACHE_LIST_PAGE_SIZE = 24;

/**
 * Returns a page of cache entries ordered by creation time (newest first).
 * Pass the last DocumentSnapshot from a previous page to continue paginating.
 */
export async function listCachedImages(
  after?: DocumentSnapshot,
): Promise<{ entries: CacheEntry[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const col = collection(db, COLLECTION);
  const q = after
    ? query(col, orderBy("createdAt", "desc"), startAfter(after), limit(CACHE_LIST_PAGE_SIZE))
    : query(col, orderBy("createdAt", "desc"), limit(CACHE_LIST_PAGE_SIZE));

  const snap = await getDocs(q);
  const entries: CacheEntry[] = snap.docs.map((d) => {
    const data = d.data() as {
      imageUrl?: string;
      createdAt?: Timestamp;
      prompt?: string;
      layer?: string;
      seed?: string;
    };
    return {
      id: d.id,
      imageUrl: data.imageUrl ?? "",
      createdAt: data.createdAt ?? null,
      prompt: data.prompt,
      layer: data.layer,
      seed: data.seed,
    };
  });

  return {
    entries,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === CACHE_LIST_PAGE_SIZE,
  };
}
