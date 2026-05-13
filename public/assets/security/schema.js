(function () {
  var origin = window.location && typeof window.location.origin === 'string'
    ? window.location.origin.trim()
    : '';
  var siteOrigin = /^https?:\/\//i.test(origin)
    ? origin
    : 'https://punchskater.com';
  var schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Punch Skater',
    alternateName: 'Skater Punk Deck Builder',
    description: 'Punch Skater is a free cyberpunk card game where you forge unique AI-powered courier trading cards, build competitive decks, and trade with other skaters across five dystopian city districts.',
    url: new URL('/', siteOrigin).toString(),
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Requires a modern browser.',
    inLanguage: 'en-US',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    author: {
      '@type': 'Organization',
      name: 'SP Digital LLC',
    },
    copyrightHolder: {
      '@type': 'Organization',
      name: 'SP Digital LLC',
    },
    copyrightYear: '2025',
    keywords: 'cyberpunk, card game, deck builder, trading cards, AI art, skater punk',
    screenshot: new URL('/pwa-512x512.png', siteOrigin).toString(),
  };

  var script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}());
