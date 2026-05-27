/**
 * useNotifications — subscribes to `notifications/{uid}/items`, returns the
 * most recent items + an unread count, and provides a `markRead` helper.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { NotificationItem } from "../lib/types";

const MAX_KEPT = 50;

export function useNotifications() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!uid || !db) {
      setItems([]);
      return;
    }
    setItems([]);
    const ref = collection(db, "notifications", uid, "items");
    return onSnapshot(ref, (snap) => {
      const next = snap.docs
        .map((d) => d.data() as NotificationItem)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, MAX_KEPT);
      setItems(next);
    });
  }, [uid]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markRead = useCallback(async (notifId: string) => {
    if (!uid || !db) return;
    try {
      await updateDoc(doc(db, "notifications", uid, "items", notifId), { read: true });
    } catch (err) {
      // Best-effort — failure to mark as read shouldn't break the UI.
      console.warn("Failed to mark notification as read:", notifId, err);
    }
  }, [uid]);

  const markAllRead = useCallback(async () => {
    await Promise.all(items.filter((n) => !n.read).map((n) => markRead(n.id)));
  }, [items, markRead]);

  return { items, unreadCount, markRead, markAllRead };
}
