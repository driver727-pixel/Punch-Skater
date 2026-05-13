(function () {
  var origin = window.location && typeof window.location.origin === 'string'
    ? window.location.origin.trim()
    : '';

  if (!origin || origin === 'null') return;

  function setAttribute(selector, attribute, path) {
    var node = document.querySelector(selector);
    if (!node) return;
    try {
      node.setAttribute(attribute, new URL(path, origin).toString());
    } catch {
      // Leave the build-time fallback value in place.
    }
  }

  setAttribute('link[rel="canonical"]', 'href', '/');
  setAttribute('meta[property="og:url"]', 'content', '/');
  setAttribute('meta[property="og:image"]', 'content', '/pwa-512x512.png');
  setAttribute('meta[name="twitter:image"]', 'content', '/pwa-512x512.png');
}());
