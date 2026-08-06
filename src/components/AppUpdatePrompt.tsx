import { useEffect, useState } from "react";
import {
  SERVICE_WORKER_SKIP_WAITING,
  SERVICE_WORKER_UPDATE_READY_EVENT,
} from "../lib/serviceWorkerUpdates";

export function AppUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const updateEvent = event as CustomEvent<ServiceWorkerRegistration>;
      if (updateEvent.detail?.waiting) {
        setRegistration(updateEvent.detail);
      }
    };

    window.addEventListener(SERVICE_WORKER_UPDATE_READY_EVENT, handleUpdate);
    return () => window.removeEventListener(SERVICE_WORKER_UPDATE_READY_EVENT, handleUpdate);
  }, []);

  const refresh = () => {
    const waitingWorker = registration?.waiting;
    if (!waitingWorker) {
      setRegistration(null);
      return;
    }

    setRefreshing(true);
    waitingWorker.postMessage({ type: SERVICE_WORKER_SKIP_WAITING });
  };

  if (!registration) return null;

  return (
    <aside className="app-update-prompt" data-testid="app-update-prompt" role="status" aria-live="polite">
      <div>
        <strong>A new version is ready.</strong>
        <span>Refresh when you are ready to load the latest game build.</span>
      </div>
      <div className="app-update-prompt__actions">
        <button type="button" className="app-update-prompt__refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
        <button type="button" className="app-update-prompt__later" onClick={() => setRegistration(null)}>
          Later
        </button>
      </div>
    </aside>
  );
}
