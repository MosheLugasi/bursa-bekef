// מרנדר את דף הנחיתה (HTML סטטי מלא – טוב ל-SEO ולשיתוף ברשתות).
// מופעל מתוך plugin.mjs בזמן build/dev. קישורים יחסיים – כדי שיעבוד גם ב-GitHub Pages וגם ב-Base44.
import { CONTENT, FACTS } from './content.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TICKER = [
  ['AAPL', '🍎', 'אפל', 'Apple'],
  ['NVDA', '🟩', 'אנבידיה', 'Nvidia'],
  ['TEVA.TA', '💊', 'טבע', 'Teva'],
  ['DIS', '🏰', 'דיסני', 'Disney'],
  ['LUMI.TA', '🏦', 'בנק לאומי', 'Bank Leumi'],
  ['NTDOY', '🎮', 'נינטנדו', 'Nintendo'],
  ['MSFT', '🪟', 'מיקרוסופט', 'Microsoft'],
  ['ESLT.TA', '🛰️', 'אלביט מערכות', 'Elbit Systems'],
  ['KO', '🥤', 'קוקה‑קולה', 'Coca‑Cola'],
  ['STRS.TA', '🍫', 'שטראוס', 'Strauss'],
  ['TSLA', '🚗', 'טסלה', 'Tesla'],
  ['MNDY', '📋', 'מאנדיי', 'monday.com'],
  ['MCD', '🍟', 'מקדונלד׳ס', 'McDonald’s'],
  ['NICE.TA', '🎧', 'נייס', 'NICE'],
  ['NFLX', '🎬', 'נטפליקס', 'Netflix'],
  ['RBLX', '🧱', 'רובלוקס', 'Roblox'],
  ['GOOGL', '🔎', 'אלפבית (גוגל)', 'Alphabet'],
  ['TA35', '🇮🇱', 'מדד ת״א‑35', 'TA‑35 index'],
  ['SPY', '🇺🇸', 'S&P 500', 'S&P 500'],
  ['MAT', '🧸', 'מאטל', 'Mattel']
];

const mark = (size = 36) => `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7B5CFF"/><stop offset="1" stop-color="#4A2BD9"/></linearGradient><linearGradient id="lhg" x1="0" y1="1" x2="0.4" y2="0"><stop offset="0" stop-color="#F0A030"/><stop offset="1" stop-color="#FFD66E"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lsg)"/><path d="M23 28 C16 27 12.5 22.5 12 15" fill="none" stroke="url(#lhg)" stroke-width="5.2" stroke-linecap="round"/><path d="M41 28 C47 26 50 21 52.5 12.5" fill="none" stroke="url(#lhg)" stroke-width="5.2" stroke-linecap="round"/><path d="M47.6 15.2 L53 10.6 L56.2 16.9" fill="none" stroke="url(#lhg)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="17.6" cy="33" rx="4.2" ry="2.6" transform="rotate(-18 17.6 33)" fill="#F3DDBA"/><ellipse cx="46.4" cy="33" rx="4.2" ry="2.6" transform="rotate(18 46.4 33)" fill="#F3DDBA"/><rect x="19.5" y="22.5" width="25" height="28.5" rx="12.5" fill="#FFF8EC"/><rect x="22.5" y="38.2" width="19" height="11" rx="5.5" fill="#F3DDBA"/><circle cx="28" cy="43.7" r="1.65" fill="#3A2A1A"/><circle cx="36" cy="43.7" r="1.65" fill="#3A2A1A"/><circle cx="27.2" cy="31.6" r="2.4" fill="#16132B"/><circle cx="36.8" cy="31.6" r="2.4" fill="#16132B"/><circle cx="28" cy="30.8" r="0.8" fill="#fff"/><circle cx="37.6" cy="30.8" r="0.8" fill="#fff"/></svg>`;

const check = '<svg class="ck" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const google =
  '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

export function renderLanding(lang, { siteUrl, shots = {} }) {
  const c = CONTENT[lang];
  const other = CONTENT[c.nav.otherLangCode];
  const up = lang === 'he' ? './' : '../'; // שורש האתר, יחסית לדף
  const app = `${up}app/`;
  const assets = `${up}landing/assets/`;
  const url = siteUrl + c.path;
  const shot = (name, alt, cls = '', eager = false) => {
    const s = shots[name] ?? { w: 780, h: 1688 };
    return `<img class="shot ${cls}" src="${assets}shots/${name}.webp" width="${s.w}" height="${s.h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  };
  const tickerItems = TICKER.map(([, e, nh, ne]) => `<li><span>${e}</span>${esc(lang === 'he' ? nh : ne)}</li>`).join('');
  const wa = `https://wa.me/?text=${encodeURIComponent(c.share + ' ' + url)}`;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: lang === 'he' ? 'שורי' : 'Shori',
      alternateName: lang === 'he' ? 'Shori' : 'שורי',
      url,
      description: c.description,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, iOS, Android',
      inLanguage: 'he',
      audience: { '@type': 'Audience', audienceType: lang === 'he' ? 'משפחות, ילדים מגיל 7 ומבוגרים מתחילים' : 'Families, kids aged 7+ and adult beginners' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: lang === 'he' ? 'ILS' : 'USD' },
      image: `${siteUrl}og/og-${lang}.jpg`
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    },
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Shori', url: siteUrl, logo: `${siteUrl}icon-512.png` }
  ];

  return `<!doctype html>
<html lang="${c.lang}" dir="${c.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
<meta name="keywords" content="${esc(c.keywords)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="he" href="${siteUrl}">
<link rel="alternate" hreflang="en" href="${siteUrl}en/">
<link rel="alternate" hreflang="x-default" href="${siteUrl}">
<meta name="theme-color" content="#5b3df5">
<meta name="color-scheme" content="light">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Shori · שורי">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${siteUrl}og/og-${lang}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(c.ogAlt)}">
<meta property="og:locale" content="${c.locale}">
<meta property="og:locale:alternate" content="${other.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(c.title)}">
<meta name="twitter:description" content="${esc(c.description)}">
<meta name="twitter:image" content="${siteUrl}og/og-${lang}.jpg">
<script>
/* משתמשים חוזרים (או קישורים ישנים כמו ‎/#/market) – ישר למשחק */
(function () {
  try {
    // הגיעו מהמשחק (״אתר שורי״) – נשארים באתר לאורך כל הביקור
    if (/[?&]home=1/.test(location.search)) { sessionStorage.setItem('shori-home', '1'); return; }
    if (sessionStorage.getItem('shori-home')) return;
    var h = location.hash || '';
    var deep = h.indexOf('#/') === 0;
    var g = localStorage.getItem('bursa-bekef-game') || '';
    var known = localStorage.getItem('base44_access_token') || /"profiles":\\{"/.test(g);
    if (deep || known) location.replace('${app}' + (deep ? h : ''));
  } catch (e) {}
})();
</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="stylesheet" href="${up}landing/landing.css">
</head>
<body class="lang-${c.lang}">
<a class="skip" href="#main">${lang === 'he' ? 'דלגו לתוכן' : 'Skip to content'}</a>
<header class="top" id="top">
  <div class="wrap top-in">
    <a class="brand" href="${lang === 'he' ? './' : './'}" aria-label="Shori">${mark(34)}<span class="brand-name">${lang === 'he' ? 'שורי' : 'Shori'}</span></a>
    <nav class="nav" aria-label="${lang === 'he' ? 'ניווט' : 'Main'}">
      <a href="#how">${c.nav.how}</a><a href="#features">${c.nav.features}</a><a href="#parents">${c.nav.parents}</a><a href="#pricing">${c.nav.pricing}</a><a href="#faq">${c.nav.faq}</a>
    </nav>
    <div class="top-actions">
      <a class="lang" href="${lang === 'he' ? 'en/' : '../'}" hreflang="${c.nav.otherLangCode}" lang="${c.nav.otherLangCode}">${c.nav.otherLang}</a>
      <a class="link-login" href="${app}">${c.nav.login}</a>
      <a class="btn btn-sm" href="${app}?start=google" data-cta="nav">${c.nav.cta}</a>
    </div>
  </div>
</header>

<main id="main">
<section class="hero">
  <div class="hero-bg" aria-hidden="true"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><span class="grid"></span></div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="eyebrow reveal"><span class="dot"></span>${esc(c.hero.eyebrow)}</p>
      <h1 class="reveal">${esc(c.hero.h1a)}<br><span class="hl">${esc(c.hero.h1b)}</span></h1>
      <p class="lead reveal">${esc(c.hero.lead)}</p>
      <div class="cta-row reveal">
        <a class="btn btn-lg btn-google" href="${app}?start=google" data-cta="hero">${google}<span>${esc(c.hero.cta)}</span></a>
        <a class="btn-link" href="${app}?start=guest" data-cta="guest">${esc(c.hero.cta2)} <span class="arr">${lang === 'he' ? '←' : '→'}</span></a>
      </div>
      <ul class="trust reveal">${c.hero.trust.map((t) => `<li>${check}${esc(t)}</li>`).join('')}</ul>
    </div>
    <div class="hero-art" aria-hidden="false">
      <div class="phone phone-hero">${shot('home', c.hero.phoneAlt, '', true)}</div>
      <div class="float-mark" aria-hidden="true">${mark(84)}</div>
      ${c.hero.chips.map((ch, i) => `<div class="chip chip-${i + 1}" aria-hidden="true"><span class="chip-e">${ch.e}</span><span><b>${esc(ch.t)}</b><small>${esc(ch.s)}</small></span></div>`).join('')}
      <svg class="spark" viewBox="0 0 220 90" aria-hidden="true"><defs><linearGradient id="spg" x1="0" x2="1"><stop offset="0" stop-color="#7B5CFF"/><stop offset="1" stop-color="#12B886"/></linearGradient></defs><path d="M6 78 C30 70 40 52 62 58 S96 30 118 38 S150 14 172 22 S204 8 214 6" fill="none" stroke="url(#spg)" stroke-width="5" stroke-linecap="round"/></svg>
    </div>
  </div>
  <div class="wrap">
    <ul class="stats reveal" aria-label="${lang === 'he' ? 'שורי במספרים' : 'Shori in numbers'}">
      ${c.stats.map((s) => `<li><b data-count="${FACTS[s.n]}">${FACTS[s.n]}</b><span>${esc(s.l)}</span></li>`).join('')}
    </ul>
  </div>
</section>

<section class="ticker" aria-label="${esc(c.tickerTitle)}">
  <p class="ticker-title">${esc(c.tickerTitle)}</p>
  <div class="ticker-track"><ul>${tickerItems}</ul><ul aria-hidden="true">${tickerItems}</ul></div>
</section>

<section class="how" id="how">
  <div class="wrap">
    <p class="kicker reveal">${esc(c.how.kicker)}</p>
    <h2 class="reveal">${esc(c.how.h2)}</h2>
    <ol class="steps">
      ${c.how.steps.map((s, i) => `<li class="step reveal" style="--d:${i * 0.12}s"><span class="step-n">${i + 1}</span><span class="step-e">${s.e}</span><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="features" id="features">
  <div class="wrap">
    <p class="kicker reveal">${esc(c.features.kicker)}</p>
    <h2 class="reveal">${esc(c.features.h2)}</h2>
    ${c.shotNote ? `<p class="shot-note reveal">${esc(c.shotNote)}</p>` : ''}
    ${c.features.items
      .map(
        (f, i) => `<article class="feature ${i % 2 ? 'flip' : ''}" id="f-${f.id}">
      <div class="feature-copy reveal">
        <span class="feature-e">${f.e}</span>
        <h3>${esc(f.t)}</h3>
        <p>${esc(f.d)}</p>
        <ul class="ticks">${f.b.map((b) => `<li>${check}${esc(b)}</li>`).join('')}</ul>
      </div>
      <div class="feature-art reveal">
        <span class="halo" aria-hidden="true"></span>
        <div class="phone">${shot(f.shot, f.alt)}</div>
      </div>
    </article>`
      )
      .join('\n')}
  </div>
</section>

<section class="parents dark" id="parents">
  <div class="dark-bg" aria-hidden="true"></div>
  <div class="wrap">
    <p class="kicker gold reveal">${esc(c.parents.kicker)}</p>
    <h2 class="reveal">${esc(c.parents.h2)}</h2>
    <p class="sub reveal">${esc(c.parents.lead)}</p>
    <ul class="cards">
      ${c.parents.items.map((p, i) => `<li class="card reveal" style="--d:${(i % 3) * 0.1}s"><span class="card-e">${p.e}</span><h3>${esc(p.t)}</h3><p>${esc(p.d)}</p></li>`).join('')}
    </ul>
  </div>
</section>

<section class="ages">
  <div class="wrap">
    <p class="kicker reveal">${esc(c.ages.kicker)}</p>
    <h2 class="reveal">${esc(c.ages.h2)}</h2>
    <ul class="age-cards">
      ${c.ages.items.map((a, i) => `<li class="age reveal" style="--d:${i * 0.12}s"><span class="age-e">${a.e}</span><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p></li>`).join('')}
    </ul>
  </div>
</section>

<section class="pricing" id="pricing">
  <div class="wrap">
    <p class="kicker reveal">${esc(c.pricing.kicker)}</p>
    <h2 class="reveal">${esc(c.pricing.h2)}</h2>
    <div class="price-card reveal">
      <div class="price-head">${mark(48)}<div><b>${esc(c.pricing.plan)}</b><span class="price"><span class="num">${esc(c.pricing.price)}</span> <small>${esc(c.pricing.per)}</small></span></div></div>
      <ul class="ticks">${c.pricing.items.map((t) => `<li>${check}${esc(t)}</li>`).join('')}</ul>
      <a class="btn btn-lg btn-google full" href="${app}?start=google" data-cta="pricing">${google}<span>${esc(c.pricing.cta)}</span></a>
      <p class="fine">${esc(c.pricing.note)}</p>
    </div>
  </div>
</section>

<section class="faq" id="faq">
  <div class="wrap">
    <p class="kicker reveal">${esc(c.faq.kicker)}</p>
    <h2 class="reveal">${esc(c.faq.h2)}</h2>
    <div class="faq-list">
      ${c.faq.items.map((f) => `<details class="qa reveal"><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`).join('')}
    </div>
  </div>
</section>

<section class="final dark">
  <div class="dark-bg glow" aria-hidden="true"></div>
  <div class="wrap final-in reveal">
    <div class="final-mark">${mark(96)}</div>
    <h2>${esc(c.final.h2a)}<br><span class="hl-gold">${esc(c.final.h2b)}</span></h2>
    <p class="sub">${esc(c.final.lead)}</p>
    <div class="cta-row center">
      <a class="btn btn-lg btn-google" href="${app}?start=google" data-cta="final">${google}<span>${esc(c.final.cta)}</span></a>
      <a class="btn-wa" href="${wa}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>${esc(c.final.share)}</a>
    </div>
  </div>
</section>
</main>

<footer class="foot dark">
  <div class="wrap foot-in">
    <div class="foot-brand">${mark(40)}<div><b>${lang === 'he' ? 'שורי' : 'Shori'}</b><span>${esc(c.footer.tag)}</span></div></div>
    <nav class="foot-links" aria-label="footer">
      <a href="${app}">${esc(c.footer.links.play)}</a>
      <a href="${lang === 'he' ? 'en/' : '../'}" hreflang="${c.nav.otherLangCode}" lang="${c.nav.otherLangCode}">${c.nav.otherLang}</a>
      <a href="#top">${esc(c.footer.links.top)}</a>
    </nav>
    <p class="disclaimer">${esc(c.footer.disclaimer)}</p>
    <p class="copy">© 2026 Shori · שורי</p>
  </div>
</footer>
<script type="module" src="${up}landing/landing.js"></script>
</body>
</html>`;
}

/** sitemap.xml + robots.txt */
export function renderSitemap(siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const alt = `<xhtml:link rel="alternate" hreflang="he" href="${siteUrl}"/><xhtml:link rel="alternate" hreflang="en" href="${siteUrl}en/"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${siteUrl}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority>${alt}</url>
  <url><loc>${siteUrl}en/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${alt}</url>
</urlset>
`;
}
export function renderRobots(siteUrl) {
  const root = new URL(siteUrl).pathname; // ב-GitHub Pages: /bursa-bekef/
  return `User-agent: *
Allow: /
Disallow: ${root}app/
Sitemap: ${siteUrl}sitemap.xml
`;
}
