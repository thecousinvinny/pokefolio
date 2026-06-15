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

### Data layer — Supabase with localStorage fallback

All collection state lives in `components/CollectionContext.tsx`. On mount it attempts Supabase anonymous sign-in (`supabase.auth.signInAnonymously()`); if that succeeds, all reads/writes go to Supabase tables `pokemon_cards` and `pokemon_sales`. If Supabase is unreachable or the query fails, it falls back to `localStorage` keys `catchm_cards_v1` and `catchm_sales_v1`. The `useLocalStorage` boolean flag in context tracks which path is active.

Mutations use optimistic updates: state is updated immediately, then the Supabase call is made async. On failure the optimistic change is rolled back.

`middleware.ts` is a passthrough (no auth gate). The migration is at `supabase/migrations/001_initial_schema.sql`; run it at `https://supabase.com/dashboard/project/ydbcfvernfothrukmyty/sql` if resetting.

### TCG API proxy

All TCG API calls go through internal Next.js routes to hide the optional API key:
- `GET /api/tcg/search?q=&set=&type=&rarity=&page=&pageSize=` → `lib/tcg.ts:searchCardsFlexible`
- `GET /api/tcg/card/[id]` → `lib/tcg.ts:getCard`

`lib/tcg.ts` builds Lucene-style queries for `api.pokemontcg.io/v2`. Server-side revalidate is dynamic: 3600s for the default full-art browse (no query/set params), 300s for user searches. The `POKEMONTCG_API_KEY` env var is optional but raises rate limits.

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

`components/cards/CardTile.tsx` exports `PortfolioTile` (owned cards with condition, profit/loss, sparkles for holo) and `BrowseTile` (TCG search results with quick-add buttons). Both use `CardArtwork` internally and implement VAULT's 0.72 aspect-ratio artwork + info section layout. BrowseTile action row order: heart → TCG → +CATCHM.

`components/layout/AppShell.tsx` renders a floating liquid-glass pill tab bar (not full-width, `left/right: 14px`). The active tab gets a frosted-glass capsule (`rgba(255,255,255,0.15)` + `blur(10px)` + `border-radius: 9999px`) that wraps both the icon and label together. The pill position is measured via `getBoundingClientRect()` on wrapper `div` refs and animated with a spring transition. Nav order: Dashboard → Browse → Wishlist → Portfolio → Sold.

### TCG links

**Always use `tcgSearchUrl(name, setName?)` from `lib/utils.ts`** for any button or link that opens TCGPlayer. Never use the stored `card.tcgplayer_url` / `card.tcgplayer?.url` — those go through the `prices.pokemontcg.io` redirect service which adds 1–2 network hops of latency.

`tcgSearchUrl` builds a direct `https://www.tcgplayer.com/search/pokemon/product?q=...` URL. All TCG links use `components/ui/TcgLink.tsx`, which calls `window.open(url, '_blank', 'noopener,noreferrer')` to preserve PWA state on iOS (Safari opens as an overlay, keeping the app alive).

TCGPlayer blocks iframes via `frame-ancestors` CSP — never try to embed it in an `<iframe>`.

### Browse page client cache

`browse/page.tsx` keeps two module-level variables that survive tab navigation:
- `_browseCache: Map<string, CacheEntry>` — keyed by `"query|set"`, TTL 10 min. Prevents API calls when returning to a cached state. Cache key is blank for the default full-art browse, so searching doesn't poison the default view.
- `_browseScrollY: number` — saves scroll position on unmount, restored on remount via `requestAnimationFrame`.

Default sort (`premium`): SET date descending → full art (rarityWeight ≥ 80) → Pokémon → Trainer → price descending.

### Key types (`types/index.ts`)

Single source of truth for data shapes:
- `PokemonCard` — a card in the user's collection (status: `owned` | `wishlist` | `for_sale`)
- `SaleRecord` — a completed sale with `net_profit`
- `TCGCard` — raw API response from `api.pokemontcg.io`
- `tcgCardToPortfolioCard(tcg)` — converts `TCGCard` → `PokemonCard` shape for saving
- `conditionAdjustedValue(card)` — `market_price × CONDITION_MULTIPLIERS[condition]`
- `unrealizedProfit(card)` — `conditionAdjustedValue - price_paid`
- `getBestTCGPrice(card)` / `getBestTCGPriceTiers(card)` — pick best price tier from holofoil → normal → reverseHolo → 1st ed → unlimited
- `CONDITION_MULTIPLIERS`: NM=1.0, LP=0.85, MP=0.68, HP=0.50, DMG=0.32

### Key utilities (`lib/utils.ts`)

- `tcgSearchUrl(name, setName?)` — direct TCGPlayer search URL (use this, not stored URLs)
- `formatPrice(value, compact?)` — `$12.34` / `$1.2k`
- `rarityWeight(rarity?)` — 0–100; ≥80 = full art (SIR=100, HyperRare=90, IllustrationRare=80)
- `generatePriceHistory(currentPrice, points?)` — synthetic 30-day sparkline data

### Images

`next.config.ts` whitelists two remote image hosts: `images.pokemontcg.io` (TCG API card art) and `ydbcfvernfothrukmyty.supabase.co` (future user-uploaded images). Any other image domain requires adding a `remotePatterns` entry there.

### Dead code

`components/ui/WebSheet.tsx` — a full-screen iframe overlay component that was built to embed TCGPlayer in-app. Abandoned because TCGPlayer's CSP blocks all iframe embeds. The file still exists but nothing imports it.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://ydbcfvernfothrukmyty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # required for Supabase path to work
POKEMONTCG_API_KEY=               # optional, raises TCG API rate limits
```
