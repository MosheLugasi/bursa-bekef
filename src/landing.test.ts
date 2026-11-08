import { describe, expect, it } from 'vitest';
import { LESSONS, EVENTS } from '@/content';
import { GLOSSARY } from '@/content/glossary';
import { JOURNEY } from '@/game/journey';
import { ACHIEVEMENTS } from '@/game/achievements';
import { CHALLENGES } from '@/game/challenges';
import { DEFAULT_MAX_PROFILES } from '@/state/cloud';
import universe from '@/content/universe.json';

// דף הנחיתה כתוב ב-JS (רץ בתוך Vite) – טוענים אותו דינמית
const load = async () => {
  const content = await import('../landing/content.mjs' as string);
  const render = await import('../landing/render.mjs' as string);
  return { ...content, ...render } as {
    FACTS: Record<string, number>;
    CONTENT: Record<string, Record<string, unknown>>;
    renderLanding: (lang: string, o: { siteUrl: string }) => string;
  };
};

describe('landing page', () => {
  it('numbers on the page match the product', async () => {
    const { FACTS } = await load();
    const u = (universe as unknown as { instruments?: unknown[] }).instruments ?? (universe as unknown as unknown[]);
    expect(FACTS).toMatchObject({
      instruments: u.length,
      journey: JOURNEY.length,
      lessons: LESSONS.length,
      glossary: GLOSSARY.length,
      achievements: ACHIEVEMENTS.length,
      events: EVENTS.length,
      challenges: CHALLENGES.length,
      maxPlayers: DEFAULT_MAX_PROFILES
    });
    const { CONTENT } = await load();
    const pricing = (l: string) => (CONTENT[l].pricing as { items: string[] }).items.join(' | ');
    expect(pricing('he')).toContain(`עד ${DEFAULT_MAX_PROFILES} שחקנים`);
    expect(pricing('en')).toContain(`Up to ${DEFAULT_MAX_PROFILES} players`);
  });

  it('Hebrew and English have the same structure', async () => {
    const { CONTENT } = await load();
    const shape = (o: unknown): unknown => (Array.isArray(o) ? o.map(shape) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o);
    expect(shape(CONTENT.en)).toEqual(shape(CONTENT.he));
  });

  it('renders complete, crawlable pages', async () => {
    const { renderLanding } = await load();
    for (const lang of ['he', 'en']) {
      const html = renderLanding(lang, { siteUrl: 'https://example.com/shori/' });
      expect(html).toContain(`<html lang="${lang}"`);
      expect(html).toContain('<link rel="canonical" href="https://example.com/shori/' + (lang === 'en' ? 'en/' : '') + '">');
      expect(html).toContain('hreflang="x-default"');
      expect(html).toContain('og:image" content="https://example.com/shori/og/og-' + lang + '.jpg"');
      expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
      expect(html).not.toMatch(/undefined|\[object Object\]/);
      const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
      expect(ld.flat().map((x: { '@type': string }) => x['@type'])).toEqual(expect.arrayContaining(['WebApplication', 'FAQPage']));
    }
  });
});
