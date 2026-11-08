// Vite plugin: מייצר את דפי הנחיתה (עברית ב-/ ואנגלית ב-/en/) כ-HTML סטטי, ואת sitemap.xml ו-robots.txt.
import { readFileSync, existsSync } from 'node:fs';
import { renderLanding, renderRobots, renderSitemap } from './render.mjs';

const DEFAULT_SITE = 'https://moshelugasi.github.io/bursa-bekef/';

export default function shoriLanding() {
  const siteUrl = (process.env.SITE_URL || DEFAULT_SITE).replace(/\/?$/, '/');
  let shots = {};
  const loadShots = () => {
    const f = new URL('./assets/shots/sizes.json', import.meta.url);
    shots = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  };
  return {
    name: 'shori-landing',
    buildStart() {
      loadShots();
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const m = html.match(/<!--shori-landing:(he|en)-->/);
        if (!m) return html;
        loadShots();
        return renderLanding(m[1], { siteUrl, shots });
      }
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap(siteUrl) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: renderRobots(siteUrl) });
    }
  };
}
