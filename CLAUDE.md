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

CATCHM is a Pokémon TCG portfolio tracker. Five tabs: **DASH** (stats + favorite + top performers), **FIND** (search TCG API), **CATCHM** (owned cards), **WISH** (target prices + alerts), **LEDGER** (ledger + monthly chart). Primary targets are PC and iPad.

## Architecture

### Data layer — Supabase with localStorage fallback

All collection state lives in `components/CollectionContext.tsx`. On mount it attempts Supabase anonymous sign-in (`supabase.auth.signInAnonymously()`); if that succeeds, all reads/writes go to Supabase tables `pokemon_cards` and `pokemon_sales`. If Supabase is unreachable or the query fails, it falls back to `localStorage` keys `catchm_cards_v1` and `catchm_sales_v1`. The `useLocalStorage` boolean flag in context tracks which path is active.

Mutations use optimistic updates: state is updated immediately, then the Supabase call is made async. On failure the optimistic change is rolled back.

`middleware.ts` is a passthrough (no auth gate). The migration is at `supabase/migrations/001_initial_schema.sql`; run it at `https://supabase.com/dashboard/project/ydbcfvernfothrukmyty/sql` if resetting.

### TCG API proxy

All TCG API calls go through internal Next.js routes to hide the optional API key:
- `GET /api/tcg/search?q=&set=&type=&rarity=&page=&pageSize=` → `lib/tcg.ts:searchCardsFlexible`
- `GET /api/tcg/card/[id]` → `lib/tcg.ts:getCard`

`lib/tcg.ts` builds Lucene-style queries for `api.pokemontcg.io/v2`. Server-side revalidate is dynamic: 3600s for the default full-art browse (no query/set params), 300s for user searches. The route handler adds matching `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` response headers so the Vercel edge cache and browser cache responses directly. The `POKEMONTCG_API_KEY` env var is optional but raises rate limits.

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
  share/[id]/
    page.tsx                → server component, reads share row via anon Supabase key
    ShareView.tsx           → client component, renders the public share page
  api/tcg/search/route.ts
  api/tcg/card/[id]/route.ts
```

`app/share/[id]/` is **outside the `(app)` group** — no `AppShell`, no auth gate. It uses `createClient` from `lib/supabase/server` (anon key, RLS applies). `components/layout/ProfileSheet.tsx` handles the share modal inside the app: it builds the share payload, writes it to the `user_shares` Supabase table, and lets the user filter by All / Full Art / Favs Only before copying the link.

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

**Button gradient system** — six CSS variables and matching utility classes are defined in `globals.css`:

| Variable / class | Gradient | Used for |
|---|---|---|
| `--btn-catchm` / `.btn-catchm` | `#fb923c → #eab308` | ADD TO CATCHM, Move to CATCHM, Add to CATCHM |
| `--btn-wishlist` / `.btn-wishlist` | `#ec4899 → #6D28D9` | WISH, GIFT, Add to WISH |
| `--btn-sell` / `.btn-sell` | `#10b981 → #06b6d4` | SELL, Confirm Sale |
| `--btn-info` / `.btn-info` | `#60a5fa → #a78bfa` | ↗ TCG, Edit, ↩ WISH, Save Changes |
| `--btn-remove` / `.btn-remove` | `#f43f5e → #7f1d1d` | ✕ Remove, confirm Remove |
| `--btn-disabled` / `.btn-disabled` | `#4b5563 → #374151` | disabled/inactive states |

All action buttons use `background: var(--btn-x)`, `color: #fff`, `border: none`. Reference the CSS var in inline styles (the dominant pattern) or add `className="btn btn-x"` for the hover/active opacity transitions from the `.btn` base class. Never hardcode the gradient hex values — always use the vars.

### Animation classes and stacking contexts

`globals.css` defines several reusable animation classes:
- `.card-enter` — entrance for list items: `opacity 0→1, translateY 16px→0, scale 0.95→1`, spring curve, `fill-mode: both`. **Caution:** `fill-mode: both` retains `transform: scale(1) translateY(0)` after the animation ends. Any non-`none` transform creates a persistent stacking context. If you render a fixed/absolute overlay (e.g. a backdrop at `z-index: 5`) and need a `.card-enter` child to appear above it, apply the z-index **on the `.card-enter` wrapper itself** (e.g. `zIndex: 7`), not on a descendant — descendants' z-indices are scoped to the animation's stacking context and won't compete against the root-level overlay.
- `.section-enter` — entrance for full-width page sections: `opacity + translateY`, ease-out, no bounce.
- `.showcase-border` — prismatic rainbow glow for the DASH showcase card, driven by `@keyframes prismatic-glow` cycling `box-shadow` colors.
- Spring curve for all interactive motion: `cubic-bezier(0.34, 1.56, 0.64, 1)` at `0.38s`.

### Card component architecture

`components/cards/CardArtwork.tsx` renders the type-based gradient background (colors from VAULT `Theme.swift` `CardType.artColors`). It is used inside every card tile and the detail modal. It also exports `TypeBadge` (small colored dot for info rows) and `getArtColors` (for direct gradient access).

`components/cards/CardTile.tsx` exports `PortfolioTile` (owned cards with condition, profit/loss, sparkles for holo) and `BrowseTile` (TCG search results with quick-add buttons). Both use `CardArtwork` internally and implement VAULT's 0.72 aspect-ratio artwork + info section layout. BrowseTile action row order: heart → TCG → +CATCHM.

`components/layout/AppShell.tsx` renders a floating liquid-glass pill tab bar (not full-width, `left/right: 14px`). The active tab gets a frosted-glass capsule (`rgba(255,255,255,0.15)` + `blur(10px)` + `border-radius: 9999px`) that wraps both the icon and label together. The pill position is measured via `getBoundingClientRect()` on wrapper `div` refs and animated with a spring transition. Nav order: DASH → FIND → WISH → CATCHM → LEDGER. Each tab's inner wrapper is fixed at `width: 72px` so the pill stays a uniform oval regardless of label text length.

### TCG links

**Always use `tcgSearchUrl(name, setName?)` from `lib/utils.ts`** for any button or link that opens TCGPlayer. Never use the stored `card.tcgplayer_url` / `card.tcgplayer?.url` — those go through the `prices.pokemontcg.io` redirect service which adds 1–2 network hops of latency.

`tcgSearchUrl` builds a direct `https://www.tcgplayer.com/search/pokemon/product?q=...` URL. All TCG links use `components/ui/TcgLink.tsx`, which calls `window.open(url, '_blank', 'noopener,noreferrer')` to preserve PWA state on iOS (Safari opens as an overlay, keeping the app alive).

TCGPlayer blocks iframes via `frame-ancestors` CSP — never try to embed it in an `<iframe>`.

### Browse page client cache

`browse/page.tsx` keeps a three-tier cache for the default full-art browse:

1. **Module-level `_browseCache`** (`Map<string, CacheEntry>`, 10-min TTL) — survives tab navigation within the same session. Keyed by `"query|set"`. Blank key (`"|"`) is the default browse; searching never pollutes it.
2. **`localStorage` key `catchm_browse_default_v2`** (30-min TTL) — survives page refreshes and new tabs. On mount, `initState` reads from LS if the module cache is cold, warms the module cache from it, and skips the initial API call entirely.
3. **HTTP edge cache** — the route handler emits `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` so Vercel's edge serves repeat requests without hitting Next.js.

`_browseScrollY: number` — saves scroll position on unmount, restored on remount via `requestAnimationFrame`.

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

### Filter-state persistence

Portfolio, Wishlist, and Browse pages persist their filter/sort state to `localStorage` using a module-level `lsGet<T>(key, def)` helper (SSR-safe). Keys: `catchm_p_sort`, `catchm_p_rarity`, `catchm_p_group`, `catchm_p_favonly` (portfolio); `catchm_w_sort`, `catchm_w_rarity` (wishlist); `catchm_b_sort`, `catchm_b_rarity` (browse). Each is written in a dedicated `useEffect` and read via a `useState` lazy initializer.

### Images

`next.config.ts` whitelists three remote image hosts: `images.pokemontcg.io` (TCG API card art), `ydbcfvernfothrukmyty.supabase.co` (future user-uploaded images), and `images.scrydex.com`. Any other image domain requires adding a `remotePatterns` entry there.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://ydbcfvernfothrukmyty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # required for Supabase path to work
POKEMONTCG_API_KEY=               # optional, raises TCG API rate limits
```
