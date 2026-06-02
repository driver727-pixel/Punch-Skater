import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ─── Service Worker: aggressive update strategy ────────────────────────────
// Ensures users always get the latest build without Ctrl+F5 or clearing cache.
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true;
      window.location.reload();
    }
  });

  // Register with updateViaCache:'none' so the browser always fetches
  // the SW script from the network, bypassing HTTP cache entirely.
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });

      // Check for updates once per hour (polling too frequently wastes bandwidth)
      setInterval(() => { reg.update(); }, 3_600_000);

      // Also check whenever the user returns to the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });
    } catch (e) {
      // SW registration failed — app still works without it
      console.warn('SW registration failed:', e);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
