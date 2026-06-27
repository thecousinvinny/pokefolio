'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { SearchIcon, HeartIcon, XIcon } from '@/components/ui/Icons'
import { ScanCardButton } from '@/components/ui/ScanCardButton'
import { BrowseTile } from '@/components/cards/CardTile'
import { CardArtwork } from '@/components/cards/CardArtwork'
import { AddToPortfolioModal } from '@/components/cards/AddToPortfolioModal'
import { Sparkline } from '@/components/ui/Sparkline'
import { TcgLink } from '@/components/ui/TcgLink'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, generatePriceHistory, isFullArt, rarityWeight, tcgSearchUrl } from '@/lib/utils'
import { getBestTCGPrice, getBestTCGPriceTiers, tcgCardToPortfolioCard } from '@/types'
import type { TCGCard } from '@/types'

type SortMode = 'premium' | 'newest' | 'price-desc' | 'price-asc' | 'alpha'
type RarityGroup = 'all' | 'promo' | 'secret' | 'hyper' | 'sir' | 'ir' | 'ultra' | 'double' | 'rare' | 'uncommon' | 'common'

const PAGE_SIZE = 50
const CACHE_TTL_MS = 30 * 60 * 1000  // 30 min — stale entries still shown instantly while refreshing

let _browseScrollY = 0   // persists across tab switches; restored on remount
let _lastQuery = ''      // restores search query when tab is re-entered
let _lastCardNumber = ''

type CacheEntry = { results: TCGCard[]; totalCount: number; hasMore: boolean; ts: number }
const _browseCache = new Map<string, CacheEntry>()

// Persists default browse across page refreshes / new tabs — 30-min TTL
const BROWSE_LS_KEY = 'catchm_browse_default_v3'
const LS_TTL_MS = 30 * 60 * 1000

// Reads the persisted default browse ignoring TTL — used as a last-resort fallback
// when the live fetch fails, so the FIND tab always shows *something*.
function lsGetDefaultStale(): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const s = localStorage.getItem(BROWSE_LS_KEY)
    return s ? JSON.parse(s) as CacheEntry : null
  } catch { return null }
}

function lsGetDefault(): CacheEntry | null {
  const e = lsGetDefaultStale()
  return e && Date.now() - e.ts < LS_TTL_MS ? e : null
}

function lsSaveDefault(e: CacheEntry) {
  try { localStorage.setItem(BROWSE_LS_KEY, JSON.stringify(e)) } catch {}
}

function cacheKey(q: string, set: string, rarity = '') { return `${q}|${set}${rarity ? `|${rarity}` : ''}` }
function cacheValid(key: string) {
  const e = _browseCache.get(key)
  return !!(e && Date.now() - e.ts < CACHE_TTL_MS)
}

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'premium',    label: 'Full Art First' },
  { key: 'newest',     label: 'Newest' },
  { key: 'price-desc', label: 'Price ↓' },
  { key: 'price-asc',  label: 'Price ↑' },
  { key: 'alpha',      label: 'A→Z' },
]

const RARITY_GROUPS: { key: RarityGroup; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'promo',    label: 'Promo' },
  { key: 'secret',   label: 'Secret Rare' },
  { key: 'hyper',    label: 'Hyper Rare' },
  { key: 'sir',      label: 'Special Illustration Rare' },
  { key: 'ir',       label: 'Illustration Rare' },
  { key: 'ultra',    label: 'Ultra Rare' },
  { key: 'double',   label: 'Double Rare' },
  { key: 'rare',     label: 'Rare' },
  { key: 'uncommon', label: 'Uncommon' },
  { key: 'common',   label: 'Common' },
]

// Client-side safety net mirroring applyRarityGroup() in lib/catalog.ts (which
// pre-filters server-side). Substring matching folds legacy era names into the
// nearest modern tier. Keep the two in sync.
function rarityGroupMatch(rarity: string | undefined, group: RarityGroup): boolean {
  const r = (rarity ?? '').toLowerCase()
  switch (group) {
    case 'all':      return true
    case 'promo':    return r.includes('promo')
    case 'secret':   return r.includes('secret')
    case 'hyper':    return r.includes('hyper') || r.includes('rainbow')
    case 'sir':      return r.includes('special illustration')
    case 'ir':       return r.includes('illustration rare') && !r.includes('special')
    case 'ultra':    return r.includes('ultra')
    case 'double':   return r.includes('double rare')
    case 'rare':     return r.includes('rare')
      && !r.includes('secret') && !r.includes('hyper') && !r.includes('rainbow')
      && !r.includes('illustration') && !r.includes('ultra') && !r.includes('double')
      && !r.includes('promo')
    case 'uncommon': return r.includes('uncommon')
    case 'common':   return r === 'common'
  }
}

function lsGet<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def
  try { const s = localStorage.getItem(key); return s != null ? JSON.parse(s) as T : def } catch { return def }
}

// Returns a sorted copy. `id` is the final tiebreaker so the order is fully
// deterministic (no "random" reshuffling for cards with equal sort keys).
function sortCards(arr: TCGCard[], sort: SortMode): TCGCard[] {
  const out = [...arr]
  const byPriceDesc = (a: TCGCard, b: TCGCard) => ((getBestTCGPrice(b) ?? 0) - (getBestTCGPrice(a) ?? 0)) || a.id.localeCompare(b.id)
  switch (sort) {
    case 'premium': {
      const dateMs = (c: TCGCard) => c.set.releaseDate ? new Date(c.set.releaseDate.replace(/\//g, '-')).getTime() : Infinity
      // Within each set: chase Pokémon (full art / IR / SIR) → other Pokémon →
      // Trainers → Energy/other. Cheap Trainer "Item" cards naturally sink to the
      // bottom of the Trainer block via the price tiebreaker below.
      const group = (c: TCGCard) => {
        if (c.supertype === 'Pokémon') return isFullArt(c.rarity) ? 0 : 1
        if (c.supertype === 'Trainer') return 2
        return 3   // Energy / other
      }
      out.sort((a, b) => {
        const dDiff = dateMs(b) - dateMs(a); if (dDiff !== 0) return dDiff
        const gDiff = group(a) - group(b); if (gDiff !== 0) return gDiff
        // Within a group, full-art first (puts chase Trainers atop the Trainer block)
        const fDiff = (isFullArt(b.rarity) ? 1 : 0) - (isFullArt(a.rarity) ? 1 : 0); if (fDiff !== 0) return fDiff
        const pDiff = (getBestTCGPrice(b) ?? 0) - (getBestTCGPrice(a) ?? 0); if (pDiff !== 0) return pDiff
        return a.id.localeCompare(b.id)
      })
      break
    }
    case 'price-desc': out.sort(byPriceDesc); break
    case 'price-asc':  out.sort((a, b) => ((getBestTCGPrice(a) ?? 0) - (getBestTCGPrice(b) ?? 0)) || a.id.localeCompare(b.id)); break
    case 'alpha':      out.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)); break
    case 'newest':     break  // keep server release-date order
  }
  return out
}

function dedupById(arr: TCGCard[]): TCGCard[] {
  const seen = new Set<string>()
  const out: TCGCard[] = []
  for (const c of arr) if (!seen.has(c.id)) { seen.add(c.id); out.push(c) }
  return out
}

export default function BrowsePage() {
  const { cards, addCard, removeCard } = useCollection()
  const [query, setQuery] = useState(() => _lastQuery)
  const [cardNumber, setCardNumber] = useState(() => _lastCardNumber)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>(() => lsGet('catchm_b_sort', 'premium'))
  const [rarityGroup, setRarityGroup] = useState<RarityGroup>(() => lsGet('catchm_b_rarity', 'all'))
  const [showFilters, setShowFilters] = useState(false)
  const [setFilter, setSetFilter] = useState('')
  const [sets, setSets] = useState<{ name: string }[]>([])
  const [showTop, setShowTop] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const defaultKey = cacheKey('', '')

  // Set list for the filter dropdown (cached endpoint; sets change rarely)
  useEffect(() => {
    let active = true
    fetch('/api/sets')
      .then(r => (r.ok ? r.json() : { sets: [] }))
      .then(d => { if (active) setSets(d.sets ?? []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Compute initial data once: module cache (fastest) → localStorage → nothing
  const [initState] = useState(() => {
    if (cacheValid(defaultKey)) {
      const c = _browseCache.get(defaultKey)!
      return { results: c.results, hasMore: c.hasMore, totalCount: c.totalCount, ready: true }
    }
    const ls = lsGetDefault()
    if (ls) {
      // Warm the module cache so in-session navigation stays instant
      _browseCache.set(defaultKey, { ...ls, ts: Date.now() })
      return { results: ls.results, hasMore: ls.hasMore, totalCount: ls.totalCount, ready: true }
    }
    return { results: [] as TCGCard[], hasMore: false, totalCount: 0, ready: false }
  })

  const [rawResults, setRawResults] = useState<TCGCard[]>(initState.results)
  const [loading, setLoading] = useState(!initState.ready)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initState.hasMore)
  const [totalCount, setTotalCount] = useState(initState.totalCount)
  const skipInitialLoad = useRef(initState.ready)
  const [addTarget, setAddTarget] = useState<TCGCard | null>(null)
  const [addDefaultStatus, setAddDefaultStatus] = useState<'owned' | 'wishlist'>('owned')
  const [detailCard, setDetailCard] = useState<TCGCard | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { try { localStorage.setItem('catchm_b_sort', JSON.stringify(sort)) } catch {} }, [sort])
  useEffect(() => { try { localStorage.setItem('catchm_b_rarity', JSON.stringify(rarityGroup)) } catch {} }, [rarityGroup])

  // Sync query/cardNumber to module-level vars so tab re-entry restores them
  useEffect(() => { _lastQuery = query }, [query])
  useEffect(() => { _lastCardNumber = cardNumber }, [cardNumber])

  // Save scroll on unmount, restore on mount when cache is warm; abort any in-flight fetch
  useEffect(() => {
    if (cacheValid(cacheKey('', '')) && _browseScrollY > 0) {
      const y = _browseScrollY
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
    return () => {
      _browseScrollY = window.scrollY
      abortRef.current?.abort()
    }
  }, [])

  // Show a "back to top" FAB once the user has scrolled past the first screen —
  // the only way back to the search bar after a deep infinite scroll.
  useEffect(() => {
    setMounted(true)
    const onScroll = () => setShowTop(window.scrollY > 700)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])


  const ownedTcgIds = useMemo(() =>
    new Set(cards.filter(c => c.status === 'owned' || c.status === 'for_sale').map(c => c.tcg_id)),
    [cards])
  const wishlistTcgIds = useMemo(() =>
    new Set(cards.filter(c => c.status === 'wishlist').map(c => c.tcg_id)),
    [cards])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const sortRef = useRef(sort)
  sortRef.current = sort

  // A chosen rarity bucket is served server-side (dense pages) rather than by
  // client-discarding most of each catalog page. '' (= "all") means no gate.
  // The client filter in displayResults still applies as a safety net.
  const serverRarity = rarityGroup === 'all' ? '' : rarityGroup

  // Re-sort the accumulated list when the user changes sort (a deliberate reorder,
  // unlike scroll-append which must NOT move already-shown cards).
  useEffect(() => { setRawResults(prev => sortCards(prev, sort)) }, [sort])

  const search = useCallback(async (q: string, set: string, p: number, append: boolean, num = '', rarity = '') => {
    if (loadingRef.current && append) return

    const key = cacheKey(q, set, rarity)

    // Fresh cache: serve immediately, skip network
    if (!append && p === 1 && !num && cacheValid(key)) {
      const cached = _browseCache.get(key)!
      setRawResults(cached.results)
      setTotalCount(cached.totalCount)
      setHasMore(cached.hasMore)
      setLoading(false)
      return
    }

    // Stale cache: show immediately so user isn't staring at a spinner,
    // then fall through to fetch fresh data in background
    const stale = !append && p === 1 && !num ? _browseCache.get(key) : null
    if (stale) {
      setRawResults(stale.results)
      setTotalCount(stale.totalCount)
      setHasMore(stale.hasMore)
      setLoading(false)
    } else {
      if (!append) setRawResults([])
      setLoading(true)
    }

    // Cancel any previous in-flight request so stale responses can't overwrite newer ones
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    setSearchError(null)

    const isDefaultReq = !q && !set && !num && !append

    // Unified failure handler with a graded fallback chain:
    //   1. already showing stale module-cache → keep it, soft-note the error
    //   2. default browse → fall back to persisted (even expired) LS cache
    //   3. nothing to show → surface the error + retry banner
    const handleFailure = (msg: string) => {
      if (stale) { setSearchError(msg); return }
      const fb = isDefaultReq ? lsGetDefaultStale() : null
      if (fb && fb.results.length) {
        setRawResults(sortCards(fb.results, sortRef.current))
        setTotalCount(fb.totalCount)
        setHasMore(fb.hasMore)
        setSearchError('Showing saved cards — live data unavailable.')
        return
      }
      setSearchError(msg)
      if (!append) setRawResults([])
    }

    loadingRef.current = true
    try {
      const params = new URLSearchParams()
      if (q)   params.set('q', q)
      if (set) params.set('set', set)
      if (num) params.set('number', num)
      // Default browse covers the whole catalog (premium sort surfaces full-arts
      // first); no rarity gate, so infinite scroll runs all the way through.
      // A selected rarity bucket pushes server-side so pages come back dense for
      // that rarity instead of the client discarding most of every page.
      if (rarity) params.set('rarityGroup', rarity)
      params.set('page', String(p))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/tcg/search?${params}`, { signal })
      if (!res.ok) {
        handleFailure(res.status === 504 ? 'Search timed out — tap retry.' : `Search failed (${res.status})`)
        return
      }
      setSearchError(null)
      const data = await res.json()
      const batch: TCGCard[] = data.data ?? []
      const nextHasMore = p * PAGE_SIZE < (data.totalCount ?? 0)
      setRawResults(prev => {
        // Sort each batch on its own and append below; existing cards never move.
        const incoming = sortCards(batch, sortRef.current)
        const next = append ? dedupById([...prev, ...incoming]) : incoming
        const cEntry: CacheEntry = { results: next, totalCount: data.totalCount ?? 0, hasMore: nextHasMore, ts: Date.now() }
        _browseCache.set(key, cEntry)
        // Persist only the first page to LS for a fast cross-session paint — the
        // full-catalog scroll would otherwise blow past the localStorage quota.
        if (!q && !set && !num && !append && !rarity) lsSaveDefault(cEntry)
        return next
      })
      setTotalCount(data.totalCount ?? 0)
      setHasMore(nextHasMore)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return  // superseded by newer query or unmount — ignore
      handleFailure('Search failed — tap retry.')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Don't skip the initial load when a rarity bucket is active on mount
    // (persisted) — the warm cache is the all-cards default, not that stream.
    if (skipInitialLoad.current && !query && !setFilter && !serverRarity) {
      skipInitialLoad.current = false
      return
    }
    skipInitialLoad.current = false
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = query || setFilter ? 350 : 0
    debounceRef.current = setTimeout(() => {
      setPage(1)
      search(query, setFilter, 1, false, cardNumber, serverRarity)
    }, delay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, setFilter, cardNumber, search, serverRarity])

  // Reset the rarity bucket to "all" when entering or leaving a text search, so
  // a query always shows everything that matches before the user re-narrows.
  const prevQueryRef = useRef('')
  useEffect(() => {
    const wasSearching = !!prevQueryRef.current.trim()
    const isSearching = !!query.trim()
    if (!wasSearching && isSearching) {
      setRarityGroup('all')
    } else if (wasSearching && !isSearching) {
      setRarityGroup('all')
    }
    prevQueryRef.current = query
  }, [query])

  // rawResults is already sorted incrementally (each batch sorted on append, and
  // re-sorted wholesale only on a deliberate sort change), so here we only filter.
  const displayResults = useMemo(() => {
    let arr = rawResults
    if (rarityGroup !== 'all') arr = arr.filter(c => rarityGroupMatch(c.rarity, rarityGroup))
    if (priceMin || priceMax) {
      const pMin = parseFloat(priceMin) || 0
      const pMax = parseFloat(priceMax) || Infinity
      arr = arr.filter(c => { const p = getBestTCGPrice(c) ?? 0; return p >= pMin && p <= pMax })
    }
    return arr
  }, [rawResults, rarityGroup, priceMin, priceMax])

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return
    const next = pageRef.current + 1
    setPage(next)
    search(query, setFilter, next, true, cardNumber, serverRarity)
  }, [hasMore, search, query, setFilter, cardNumber, serverRarity])

  const handleCardClick = useCallback((card: TCGCard) => setDetailCard(card), [])
  const handleAddToPortfolio = useCallback((card: TCGCard) => { setAddTarget(card); setAddDefaultStatus('owned') }, [])
  const handleToggleWishlist = useCallback((card: TCGCard) => {
    const existing = cards.find(c => c.status === 'wishlist' && c.tcg_id === card.id)
    if (existing) {
      removeCard(existing.id)
    } else {
      addCard({
        ...tcgCardToPortfolioCard(card),
        status: 'wishlist',
        condition: 'NM',
        market_at_buy: getBestTCGPrice(card),
        alerts_enabled: true,
        is_favorite: false,
        date_added: new Date().toISOString(),
      })
    }
  }, [cards, addCard, removeCard])

  // Rebuild the observer after every batch (length) and when a load finishes
  // (loading → false). An IntersectionObserver only fires on a false→true
  // crossing; appending cards keeps the sentinel continuously intersecting, so
  // without re-observing it would never re-fire and auto-load would stall after
  // one page (the user had to scroll up and back down to retrigger). Re-observing
  // delivers a fresh initial callback that loads the next page if still parked
  // at the bottom — and naturally stops once the sentinel scrolls out of margin.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '400px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, displayResults.length, loading])

  const activeFilterCount = [
    sort !== 'premium',
    rarityGroup !== 'all',
    !!priceMin,
    !!priceMax,
    !!setFilter,
  ].filter(Boolean).length
  const hasFilters = activeFilterCount > 0

  function clearAllFilters() {
    setSort('premium')
    setRarityGroup('all')
    setPriceMin('')
    setPriceMax('')
    setSetFilter('')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-14 pb-8 animate-fade-in">

      {/* Search bar + icon-only filter button */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            style={{ color: 'var(--text3)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search cards or sets…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCardNumber('') }}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setCardNumber('') }} style={{ color: 'var(--text3)', display: 'flex' }}><XIcon size={16} /></button>
          )}
        </div>

        <ScanCardButton onResult={(name, num) => {
          // Bust the cache so scan always hits the server fresh
          _browseCache.delete(cacheKey(name, ''))
          setQuery(name)
          setCardNumber(num ?? '')
        }} />

        {/* Icon-only filter button */}
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: hasFilters ? 'rgba(255,200,69,0.12)' : 'var(--surface)',
            color: hasFilters ? 'var(--gold)' : 'var(--text2)',
            border: `1px solid ${hasFilters ? 'rgba(255,200,69,0.30)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: 'pointer',
          }}>
          <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          {activeFilterCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 6,
              minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--gold)', color: '#0D0F1A',
              fontSize: 8, fontWeight: 900, lineHeight: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-5 p-4 rounded-xl animate-fade-in"
          style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          <p className="section-label mb-2">SORT BY</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button key={key} onClick={() => setSort(key)}
                className={`chip ${sort === key ? 'chip-active' : 'chip-default'}`}
                style={{ fontSize: 12 }}>
                {label}
              </button>
            ))}
          </div>

          <p className="section-label mb-2">RARITY</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {RARITY_GROUPS.map(({ key, label }) => (
              <button key={key} onClick={() => setRarityGroup(key)}
                className={`chip ${rarityGroup === key ? 'chip-active' : 'chip-default'}`}
                style={{ fontSize: 12 }}>
                {label}
              </button>
            ))}
          </div>

          <p className="section-label mb-3">ADVANCED</p>
          <div className="flex gap-3 flex-wrap">
            <div style={{ flex: '1 1 140px' }}>
              <label className="section-label block mb-1.5">Set</label>
              <select value={setFilter}
                onChange={e => setSetFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                <option value="">All sets</option>
                {sets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label className="section-label block mb-1.5">Min Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text3)' }}>$</span>
                <input type="number" min="0" step="0.01" placeholder="0" value={priceMin}
                  onChange={e => setPriceMin(e.target.value)}
                  className="w-full pl-6 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label className="section-label block mb-1.5">Max Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text3)' }}>$</span>
                <input type="number" min="0" step="0.01" placeholder="∞" value={priceMax}
                  onChange={e => setPriceMax(e.target.value)}
                  className="w-full pl-6 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearAllFilters} className="mt-3 text-xs font-bold"
              style={{ color: 'var(--crimson)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              × Clear all
            </button>
          )}
        </div>
      )}

      {/* Search error / retry banner */}
      {searchError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', marginBottom: 12, borderRadius: 10,
          background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.28)',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(251,146,60,0.95)' }}>{searchError}</span>
          <button
            onClick={() => { setSearchError(null); search(query, setFilter, 1, false, cardNumber, serverRarity) }}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              background: 'var(--btn-info)', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >↺ Retry</button>
        </div>
      )}

      {/* Results count */}
      {(!loading || displayResults.length > 0) && displayResults.length > 0 && (
        <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>
          {displayResults.length}{totalCount > rawResults.length ? '+' : ''} cards
        </p>
      )}

      {/* Grid */}
      {loading && rawResults.length === 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {[...Array(15)].map((_, i) => (
            <div key={`sk-${i}`} className="rounded-2xl img-skeleton" style={{ height: 280 }} />
          ))}
        </div>
      ) : displayResults.length === 0 ? (
        <EmptyBrowse hasQuery={!!query || !!setFilter || hasFilters} hasError={!!searchError} />
      ) : (
        <>
          <div className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {displayResults.map((card, i) => (
              <div key={card.id} className="card-enter"
                style={{
                  // Stagger only the first row-ful; the rest appear instantly so
                  // scrolled-in cards don't lag behind a delay.
                  animationDelay: i < 12 ? `${i * 0.028}s` : '0s',
                  // Skip rendering off-screen cards so thousands stay smooth.
                  contentVisibility: 'auto',
                  containIntrinsicSize: '0 300px',
                }}>
                <BrowseTile
                  card={card}
                  onClick={handleCardClick}
                  onAddToPortfolio={handleAddToPortfolio}
                  onAddToWishlist={handleToggleWishlist}
                  inCollection={ownedTcgIds.has(card.id)}
                  inWishlist={wishlistTcgIds.has(card.id)}
                />
              </div>
            ))}
          </div>

          <div ref={sentinelRef} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
            {loading && (
              <div className="animate-spin-gold" style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--gold)',
              }} />
            )}
          </div>
        </>
      )}

      {detailCard && (
        <BrowseDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onAddToPortfolio={() => { setAddTarget(detailCard); setAddDefaultStatus('owned'); setDetailCard(null) }}
          onAddToWishlist={() => handleToggleWishlist(detailCard)}
          inCollection={ownedTcgIds.has(detailCard.id)}
          inWishlist={wishlistTcgIds.has(detailCard.id)}
        />
      )}

      <AddToPortfolioModal
        card={addTarget}
        onClose={() => setAddTarget(null)}
        defaultStatus={addDefaultStatus}
      />

      {/* Back to top — portaled to <body> so the page's fade-in transform can't
          trap its position:fixed. Sits just above the global Scan FAB. */}
      {mounted && createPortal(
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          style={{
            position: 'fixed',
            bottom: 'calc(156px + env(safe-area-inset-bottom))',
            right: 22,
            zIndex: 101,
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(30, 32, 51, 0.55)',
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: 'var(--text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            opacity: showTop ? 1 : 0,
            transform: showTop ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
            pointerEvents: showTop ? 'auto' : 'none',
            transition: 'opacity 0.25s ease, transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
          <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>,
        document.body
      )}
    </div>
  )
}

// ─── Browse Detail Modal ──────────────────────────────────────────────────────

function BrowseDetailModal({ card, onClose, onAddToPortfolio, onAddToWishlist, inCollection, inWishlist }: {
  card: TCGCard
  onClose: () => void
  onAddToPortfolio: () => void
  onAddToWishlist: () => void
  inCollection: boolean
  inWishlist: boolean
}) {
  const price = getBestTCGPrice(card)
  const tiers = getBestTCGPriceTiers(card)
  const priceHistory = useMemo(
    () => price != null ? generatePriceHistory(price) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id]
  )
  const rcColor = rarityColorBrowse(card.rarity)
  const isAccent = !rcColor.startsWith('rgba')

  const setRef = [
    card.number ? `#${card.number}${card.set.printedTotal ? `/${card.set.printedTotal}` : ''}` : null,
    card.set.releaseDate ? new Date(card.set.releaseDate.replace(/\//g, '-')).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <Modal open onClose={onClose} maxWidth={520}>
      <div style={{ position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: -4, right: -4,
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(255,255,255,0.07)', border: 'none',
          color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}><XIcon size={14} /></button>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{
            width: 120, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
            position: 'relative', paddingTop: `${Math.round(120 * 1.39)}px`,
            boxShadow: '0 6px 24px rgba(0,0,0,0.50)',
          }}>
            <CardArtwork types={card.types} imageUrl={card.images.large || card.images.small}
              imageAlt={card.name} isHolo={rarityWeight(card.rarity) >= 30} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <h2 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 800, lineHeight: 1.2, paddingRight: 32 }}>
              {card.name}
            </h2>
            {card.rarity && (
              <span style={{
                display: 'inline-block', marginBottom: 5,
                fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', color: rcColor,
                background: isAccent ? `${rcColor}16` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isAccent ? `${rcColor}30` : 'rgba(255,255,255,0.10)'}`,
                borderRadius: 100, padding: '2px 8px', lineHeight: 1.5,
              }}>{card.rarity}</span>
            )}
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text3)' }}>
              {card.set.name}{setRef ? ` · ${setRef}` : ''}
            </p>
            {card.artist && <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text3)' }}>Illus. {card.artist}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {card.hp && <MiniStat label="HP" value={card.hp} />}
              {card.types && <MiniStat label="Type" value={card.types.join(' / ')} />}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>Market Value</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
              {price != null ? formatPrice(price) : '—'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>NM</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {([
              { label: 'NM Low', val: tiers?.low },
              { label: 'Mid',    val: tiers?.mid },
              { label: 'High',   val: tiers?.high },
            ] as { label: string; val: number | undefined }[]).map(({ label, val }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
                <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: val != null ? 'var(--text)' : 'var(--text3)' }}>{val != null ? formatPrice(val) : '—'}</p>
              </div>
            ))}
            {tiers?.directLow != null && (
              <div>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>Direct</p>
                <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatPrice(tiers.directLow)}</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>30-Day Price</span>
            {priceHistory.length > 1 && (
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>{formatPrice(Math.min(...priceHistory))} – {formatPrice(Math.max(...priceHistory))}</span>
            )}
          </div>
          {priceHistory.length > 1 ? (
            <Sparkline points={priceHistory} color="var(--emerald)" height={80} />
          ) : (
            <div style={{ height: 100, borderRadius: 8, background: 'var(--s2)', opacity: 0.4 }} />
          )}
        </div>

        {card.flavorText && (
          <p style={{ margin: '0 0 16px', fontSize: 11.5, lineHeight: 1.65, color: 'var(--text3)', fontStyle: 'italic', borderLeft: '2px solid var(--border2)', paddingLeft: 10 }}>
            "{card.flavorText}"
          </p>
        )}

        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Primary: Watchlist + CATCHM side by side */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onAddToWishlist}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: inWishlist ? 'var(--btn-wishlist)' : 'transparent',
                color: inWishlist ? '#fff' : 'var(--text3)',
                border: inWishlist ? 'none' : '1px solid rgba(255,255,255,0.10)',
                cursor: 'pointer',
              }}>
              <HeartIcon size={12} filled={inWishlist} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              {inWishlist ? 'In WISH' : 'WISH'}
            </button>
            <button onClick={onAddToPortfolio}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: 'var(--btn-catchm)',
                color: '#fff',
                border: 'none', cursor: 'pointer',
              }}>
              {inCollection ? '+ Add Another' : '+ Add to CATCHM'}
            </button>
          </div>
          {/* Secondary: TCG link, full width */}
          <TcgLink url={tcgSearchUrl(card.name, card.set.name)} style={{
            display: 'block', textAlign: 'center',
            padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
            color: '#fff', background: 'var(--btn-info)',
            border: 'none', textDecoration: 'none',
          }}>↗ View on TCGPlayer</TcgLink>
        </div>
      </div>
    </Modal>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

function rarityColorBrowse(rarity?: string | null): string {
  if (!rarity) return 'rgba(255,255,255,0.38)'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return '#FFC845'
  if (r.includes('illustration rare'))    return '#D166F2'
  if (r.includes('hyper rare') || r.includes('rainbow')) return '#73D9D9'
  if (r.includes('secret'))     return '#5DA9FF'
  if (r.includes('vmax') || r.includes('vstar')) return '#FF9E2E'
  if (r.includes('amazing'))    return '#73D9D9'
  if (r.includes('ultra rare') || r.includes(' ex') || r.includes(' gx')) return '#FF9E2E'
  if (r.includes('holo'))       return 'rgba(200,210,255,0.75)'
  return 'rgba(255,255,255,0.38)'
}

function EmptyBrowse({ hasQuery, hasError }: { hasQuery: boolean; hasError?: boolean }) {
  const title = hasError ? 'Couldn’t load cards' : hasQuery ? 'No cards found' : 'Loading cards…'
  const sub = hasError
    ? 'Check your connection, then tap retry above.'
    : hasQuery ? 'Try a different name, set, or remove filters.' : ''
  return (
    <div className="text-center py-20">
      <div className="mb-4 opacity-30 flex justify-center"><SearchIcon size={48} /></div>
      <p className="font-bold text-lg mb-2">{title}</p>
      <p className="text-sm" style={{ color: 'var(--text3)' }}>{sub}</p>
    </div>
  )
}
