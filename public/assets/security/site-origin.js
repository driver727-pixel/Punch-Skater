(function () {
  var origin = window.location && typeof window.location.origin === 'string'
    ? window.location.origin.trim()
    : '';

  if (!/^https?:\/\//i.test(origin)) return;

  function setAttribute(selector, attribute, path) {
    var node = document.querySelector(selector);
    if (!node) return;
    node.setAttribute(attribute, new URL(path, origin).toString());
  }

  setAttribute('link[rel="canonical"]', 'href', '/');
  setAttribute('meta[property="og:url"]', 'content', '/');
  setAttribute('meta[property="og:image"]', 'content', '/pwa-512x512.png');
  setAttribute('meta[name="twitter:image"]', 'content', '/pwa-512x512.png');
}());
