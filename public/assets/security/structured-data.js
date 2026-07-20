(function () {
  var structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Punch Skater™',
    alternateName: 'Skater Punk™ Deck Builder',
    description: 'Punch Skater™ is a free cyberpunk card game where you forge unique AI-powered courier trading cards, build competitive decks, and trade with other skaters across five dystopian city districts.',
    url: 'https://punchskater.com/',
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
    screenshot: 'https://punchskater.com/pwa-512x512.png',
  };
  var script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
}());
