# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Next.js 16, port 3000)
npm run build    # production build
npm run lint     # ESLint via next lint
npx tsc --noEmit # type-check without emitting (no test suite exists)
```

No test framework is configured. Type-check with `tsc --noEmit` after changes.

## What this app is

CATCHM is a Pokémon TCG portfolio tracker. Five tabs: **Dashboard** (stats + favorite + top performers), **Browse** (search TCG API), **Portfolio** (owned cards), **Wishlist** (target prices + alerts), **Sold** (ledger + monthly chart). Primary targets are PC and iPad.

## Architecture

### Data layer — localStorage only (Supabase bypassed for now)

All collection state lives in `components/CollectionContext.tsx`, a React context backed by `localStorage` keys `catchm_cards_v1` and `catchm_sales_v1`. Supabase is installed and the schema is ready (`supabase/migrations/001_initial_schema.sql`) but auth and DB reads/writes are completely removed. `middleware.ts` is a passthrough. The `user_id` field on every record is hardcoded `'local'`.

When Supabase is re-enabled: swap `CollectionContext` mutations to `@supabase/ssr` client calls, restore auth check in middleware, and run the migration at `https://supabase.com/dashboard/project/ydbcfvernfothrukmyty/sql`.

### TCG API proxy

All TCG API calls go through internal Next.js routes to hide the optional API key:
- `GET /api/tcg/search?q=&set=&type=&rarity=&page=&pageSize=` → `lib/tcg.ts:searchCardsFlexible`
- `GET /api/tcg/card/[id]` → `lib/tcg.ts:getCard`

`lib/tcg.ts` builds Lucene-style queries for `api.pokemontcg.io/v2`. The `POKEMONTCG_API_KEY` env var is optional but raises rate limits.

### Route structure

```
app/
  page.tsx                  → redirect to /dashboard
  (app)/
    layout.tsx              → wraps everything in <CollectionProvider> + <AppShell>
    dashboard/page.tsx
    browse/page.tsx
    portfolio/page.tsx
    wishlist/page.tsx
    sold/page.tsx
  (auth)/login/page.tsx     → unused (auth bypassed)
  api/tcg/search/route.ts
  api/tcg/card/[id]/route.ts
```

### Design system — VAULT/FOLIO Swift files are source of truth

The `VAULT/` and `FOLIO/` folders contain Swift source files from companion iOS apps. **These are the design blueprint.** When building or changing any UI component, read the matching Swift file first. Key files:

| Swift file | Web counterpart |
|---|---|
| `VAULT/CardTile_swift.txt` | `components/cards/CardTile.tsx` |
| `VAULT/CardDetailView_swift.txt` | `components/cards/CardDetailModal.tsx` |
| `VAULT/Theme_swift.txt` | `app/globals.css` + `tailwind.config.ts` |
| `VAULT/DashboardView_swift.txt` | `app/(app)/dashboard/page.tsx` |
| `VAULT/BrowseView_swift.txt` | `app/(app)/browse/page.tsx` |
| `FOLIO/RootTabView_swift.txt` | `components/layout/AppShell.tsx` |

CSS custom properties in `globals.css` and Tailwind colors in `tailwind.config.ts` both map to VAULT design tokens (`--bg #0D0F1A`, `--surface #1E2033`, `--gold #FFC845`, `--emerald #45DB8D`, `--violet #9C72FA`, etc.). Always use CSS vars or Tailwind token names — never hardcode hex values that exist as tokens.

### Card component architecture

`components/cards/CardArtwork.tsx` renders the type-based gradient background (colors from VAULT `Theme.swift` `CardType.artColors`). It is used inside every card tile and the detail modal. It also exports `TypeBadge` (small colored dot for info rows) and `getArtColors` (for direct gradient access).

`components/cards/CardTile.tsx` exports `PortfolioTile` (owned cards with condition, profit/loss, sparkles for holo) and `BrowseTile` (TCG search results with quick-add buttons). Both use `CardArtwork` internally and implement VAULT's 0.72 aspect-ratio artwork + info section layout.

`components/layout/AppShell.tsx` renders a floating liquid-glass pill tab bar (not full-width, `left/right: 14px`, `backdrop-filter: blur(40px) saturate(180%)`). Active tab gets a gold-tinted rounded rect indicator behind the icon.

### Key types

`types/index.ts` is the single source of truth for data shapes:
- `PokemonCard` — a card in the user's collection (owned/wishlist/for_sale)
- `SaleRecord` — a completed sale with net_profit
- `TCGCard` — raw API response shape from `api.pokemontcg.io`
- `tcgCardToPortfolioCard()` — converts a `TCGCard` to the `PokemonCard` shape for saving
- `conditionAdjustedValue()` — `market_price × CONDITION_MULTIPLIERS[condition]`
- `CONDITION_MULTIPLIERS`: NM=1.0, LP=0.85, MP=0.68, HP=0.50, DMG=0.32

### Images

`next.config.ts` whitelists two remote image hosts: `images.pokemontcg.io` (TCG API card art) and `ydbcfvernfothrukmyty.supabase.co` (future user-uploaded images). Any other image domain requires adding a `remotePatterns` entry there.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://ydbcfvernfothrukmyty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # needed when re-enabling Supabase
POKEMONTCG_API_KEY=               # optional, raises TCG API rate limits
```
