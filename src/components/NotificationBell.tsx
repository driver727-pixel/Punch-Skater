/**
 * NotificationBell — top-nav inbox for race-related notifications.
 *
 * Subscribes to `notifications/{uid}/items` via `useNotifications`. Renders
 * a bell with an unread-count badge; clicking opens a popover listing the
 * latest items. Clicking an item navigates via its deep-link and marks it
 * read; the "Mark all read" button clears the badge in one shot.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import { sfxClick } from "../lib/sfx";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback((id: string, link?: string) => {
    sfxClick();
    void markRead(id);
    setOpen(false);
    if (link) navigate(link);
  }, [markRead, navigate]);

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        className="notif-bell-btn"
        onClick={() => { sfxClick(); setOpen((v) => !v); }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">{Math.min(99, unreadCount)}</span>
        )}
      </button>
      {open && (
        <div className="notif-popover" role="dialog" aria-label="Notifications">
          <header className="notif-popover-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="btn-link" onClick={() => void markAllRead()}>Mark all read</button>
            )}
          </header>
          {items.length === 0 ? (
            <p className="notif-popover-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-popover-list">
              {items.map((n) => (
                <li key={n.id} className={`notif-item${n.read ? " notif-item--read" : ""}`}>
                  <button
                    className="notif-item-btn"
                    onClick={() => handleSelect(n.id, n.link || undefined)}
                  >
                    <span className="notif-item-title">{n.title}</span>
                    {n.body && <span className="notif-item-body">{n.body}</span>}
                    <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
