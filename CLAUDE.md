# CLAUDE.md – בורסה בכיף (Bursa Be'Kef)

Hebrew (RTL) educational paper-trading game for kids 7+ and beginner adults. Static SPA (Vite + React 19 + TS + Tailwind v4 + Zustand) deployed to GitHub Pages; real market data is fetched daily by GitHub Actions. The owner manages the project from Claude on mobile – keep changes small, tested, and pushed.

## Commands
- `npm run dev` – dev server (needs `public/data/`, see below)
- `npm test` – vitest engine tests (`src/**/*.test.ts`) – must pass
- `npm run build` – `tsc -b && vite build` – must pass (strict TS, no unused locals)
- `npm run devdata` – **synthetic** dev data via `pipeline/make_dev_data.py` (Yahoo Finance is blocked in Claude cloud sessions; never commit or deploy this data – `public/data/` is gitignored and the manifest is flagged `synthetic: true`, which shows a warning banner)
- Real data: `python pipeline/fetch_data.py --out public/data --cache data-cache` (runs in `.github/workflows/deploy.yml`)

## Architecture
- `src/engine/` – pure game engine. Prices are **raw (not split-adjusted)**; splits/dividends are applied as events in `process.ts#advance`. `market.ts` (MarketData over `closes.json` + per-instrument OHLC), `trading.ts` (buy/sell/limit/SL/TP/options/bonds/valuation), `finance.ts` (Black-Scholes, bond pricing from real yield curves, `BOND_PRODUCTS`), `metrics.ts`. Add tests in `engine.test.ts` for engine changes.
- Game time: every portfolio has `currentDate`. `mode: 'history'` (time machine) advances manually; `mode: 'live'` is auto-advanced to `manifest.asOf` on load (`game/actions.ts#processLivePortfolios`). UI must never show data after the portfolio's `currentDate` (no future leakage).
- `src/content/` – all Hebrew educational content. `universe.json` is the single list of instruments (also read by the Python pipeline). Text supports `[[termId]]` / `[[termId|label]]` glossary links (must be valid ids in `glossary.ts`) and `**bold**`. Company profiles support dated markers (`content/dated.ts`): `{{YYYY-MM-DD|text}}` shows only from that date, `{{<YYYY-MM-DD|text}}` only before it – the time machine uses them to hide future events, so wrap any new time-sensitive fact. Types in `content/types.ts`.
- `src/game/` – XP/levels, achievements (`achievements.ts`), time-machine challenges, coach tutorials (`coach.ts`, replayable via the header "שורי מסביר" button), feature gating (`features.ts`: kids unlock features by completing lessons), kids' journey (`journey.ts` stations + animated scenes in `ui/journey/Scenes.tsx`).
- `src/state/` – Zustand store persisted to localStorage (`store.ts`), UI store, optional Supabase sync (`cloud.ts`, docs table `game_docs`, LWW per doc by `updatedAt`).
- Zustand v5: selectors must return stable references (never `useGame(s => Object.values(...))` – select the map and `useMemo`).
- Charts: lightweight-charts v5 (`addSeries(AreaSeries…)`, `createSeriesMarkers`), custom SVG for donut/bars/payoff. Palette in `index.css` / `ui/charts.tsx`; gains/losses always paired with ▲▼ and sign, not color alone.

## Conventions
- All UI text in Hebrew, gender-neutral plural ("אתם"), Hebrew punctuation ״ ׳. Numbers/prices wrapped with `.num` (LTR isolate).
- Mobile-first: test at 390px width; bottom nav on mobile, side nav ≥ md.
- Educational, never investment advice. Don't invent financial figures in content.
- Adding an instrument: add to `src/content/universe.json` (Yahoo symbol; TASE `.TA` prices are in agorot and converted automatically) + a profile in one of `companies-*.ts` (merged in `content/index.ts`). Stocks carry `rank` (market-cap rank within its market, ranked Nov 2026 via `pipeline/research` on the `diag/rank` branch) and `core: true` for kid-familiar brands (always get daily news; others rotate).
- Data size: `closes.json` v2 delta-encodes each series (`{k, d}`); keep the universe around ~220 instruments unless lazy loading is added.

## Deployment
Push to `main` → workflow fetches data (cache on orphan branch `data`), runs tests, builds with `BASE_PATH=/<repo>/`, deploys to Pages. Daily cron 22:40 UTC Mon–Fri. Optional: secret `ANTHROPIC_API_KEY` (Hebrew news summaries via Claude), variables `SUPABASE_URL`/`SUPABASE_ANON_KEY` (cloud sync).
