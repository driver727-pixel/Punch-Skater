const PHASER_CANDIDATES = [
  './vendor/phaser.esm.min.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js',
  'https://esm.sh/phaser@3.90.0?bundle',
];

function showLoadError(message) {
  const container = document.getElementById('game-container');
  if (!container) return;
  container.innerHTML = `
    <div class="fallback fallback--centered">
      ${message}
    </div>
  `;
}

async function loadPhaser() {
  let lastError = null;

  for (const url of PHASER_CANDIDATES) {
    try {
      const mod = await import(url);
      return mod.default ?? mod;
    } catch (error) {
      lastError = error;
      console.error(`Classic Race failed to load Phaser from ${url}`, error);
    }
  }

  const attemptedSources = PHASER_CANDIDATES.join(', ');
  throw lastError ?? new Error(`Unable to load Phaser from any source: ${attemptedSources}`);
}

try {
  globalThis.__PS_PHASER__ = await loadPhaser();
  await import('./main.js');
} catch (error) {
  console.error('Classic Race failed to boot.', error);
  showLoadError('Classic Race could not load its game engine. Try refreshing the page or return to Punch Skater™ and relaunch.');
}
