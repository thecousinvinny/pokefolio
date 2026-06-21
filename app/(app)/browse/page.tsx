'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { SearchIcon, HeartIcon, XIcon } from '@/components/ui/Icons'
import { ScanCardButton } from '@/components/ui/ScanCardButton'
import { BrowseTile } from '@/components/cards/CardTile'
import { CardArtwork } from '@/components/cards/CardArtwork'
import { AddToPortfolioModal } from '@/components/cards/AddToPortfolioModal'
import { Sparkline } from '@/components/ui/Sparkline'
import { TcgLink } from '@/components/ui/TcgLink'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, generatePriceHistory, rarityWeight, tcgSearchUrl } from '@/lib/utils'
import { getBestTCGPrice, getBestTCGPriceTiers, tcgCardToPortfolioCard } from '@/types'
import type { TCGCard } from '@/types'

type SortMode = 'premium' | 'newest' | 'price-desc' | 'price-asc' | 'alpha'
type RarityGroup = 'all' | 'fullart' | 'ultra' | 'holo' | 'common'

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

function lsGetDefault(): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const s = localStorage.getItem(BROWSE_LS_KEY)
    if (!s) return null
    const e: CacheEntry = JSON.parse(s)
    return Date.now() - e.ts < LS_TTL_MS ? e : null
  } catch { return null }
}

function lsSaveDefault(e: CacheEntry) {
  try { localStorage.setItem(BROWSE_LS_KEY, JSON.stringify(e)) } catch {}
}

function cacheKey(q: string, set: string) { return `${q}|${set}` }
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
  { key: 'all',     label: 'All' },
  { key: 'fullart', label: 'Full Art' },
  { key: 'ultra',   label: 'Ultra Rare' },
  { key: 'holo',    label: 'Holo' },
  { key: 'common',  label: 'Common' },
]

function rarityGroupMatch(rarity: string | undefined, group: RarityGroup): boolean {
  const w = rarityWeight(rarity)
  switch (group) {
    case 'all':     return true
    case 'fullart': return w >= 80
    case 'ultra':   return w >= 50 && w < 80
    case 'holo':    return w >= 30 && w < 50
    case 'common':  return w < 30
  }
}

function lsGet<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def
  try { const s = localStorage.getItem(key); return s != null ? JSON.parse(s) as T : def } catch { return def }
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
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const defaultKey = cacheKey('', '')

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const ownedTcgIds = useMemo(() =>
    new Set(cards.filter(c => c.status === 'owned' || c.status === 'for_sale').map(c => c.tcg_id)),
    [cards])
  const wishlistTcgIds = useMemo(() =>
    new Set(cards.filter(c => c.status === 'wishlist').map(c => c.tcg_id)),
    [cards])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (q: string, set: string, p: number, append: boolean, num = '') => {
    if (loadingRef.current && append) return

    const key = cacheKey(q, set)

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

    loadingRef.current = true
    try {
      const params = new URLSearchParams()
      if (q)   params.set('q', q)
      if (set) params.set('set', set)
      if (num) params.set('number', num)
      if (!q && !set && !num) params.set('fullArtOnly', 'true')
      params.set('page', String(p))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/tcg/search?${params}`, { signal })
      if (!res.ok) {
        setSearchError(res.status === 504 ? 'Search timed out — tap retry.' : `Search failed (${res.status})`)
        if (!append && !stale) setRawResults([])
        return
      }
      setSearchError(null)
      const data = await res.json()
      const batch: TCGCard[] = data.data ?? []
      const nextHasMore = p * PAGE_SIZE < (data.totalCount ?? 0)
      setRawResults(prev => {
        const next = append ? [...prev, ...batch] : batch
        const cEntry: CacheEntry = { results: next, totalCount: data.totalCount ?? 0, hasMore: nextHasMore, ts: Date.now() }
        _browseCache.set(key, cEntry)
        if (!q && !set && !num) lsSaveDefault(cEntry)
        return next
      })
      setTotalCount(data.totalCount ?? 0)
      setHasMore(nextHasMore)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return  // superseded by newer query or unmount — ignore
      setSearchError('Search failed — tap retry.')
      if (!append && !stale) setRawResults([])
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (skipInitialLoad.current && !query && !setFilter) {
      skipInitialLoad.current = false
      return
    }
    skipInitialLoad.current = false
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = query || setFilter ? 350 : 0
    debounceRef.current = setTimeout(() => {
      setPage(1)
      search(query, setFilter, 1, false, cardNumber)
    }, delay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, setFilter, cardNumber, search])

  // Auto-switch rarity: browsing = all (server already filters to full arts)
  //                     searching = all (show everything matching the query)
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

  const displayResults = useMemo(() => {
    let arr = [...rawResults]
    if (rarityGroup !== 'all') arr = arr.filter(c => rarityGroupMatch(c.rarity, rarityGroup))
    if (priceMin || priceMax) {
      const pMin = parseFloat(priceMin) || 0
      const pMax = parseFloat(priceMax) || Infinity
      arr = arr.filter(c => { const p = getBestTCGPrice(c) ?? 0; return p >= pMin && p <= pMax })
    }
    switch (sort) {
      case 'premium': {
        // SET (newest first, nulls → top) > FULL ART > POKEMON > TRAINER > price
        const dateMs = (c: TCGCard) => {
          if (!c.set.releaseDate) return Infinity
          return new Date(c.set.releaseDate.replace(/\//g, '-')).getTime()
        }
        const supertypeRank = (s?: string) => s === 'Pokémon' ? 2 : s === 'Trainer' ? 1 : 0
        arr.sort((a, b) => {
          const dDiff = dateMs(b) - dateMs(a)
          if (dDiff !== 0) return dDiff
          const rwA = rarityWeight(a.rarity), rwB = rarityWeight(b.rarity)
          const fullA = rwA >= 80 ? 1 : 0, fullB = rwB >= 80 ? 1 : 0
          if (fullB !== fullA) return fullB - fullA
          const stDiff = supertypeRank(b.supertype) - supertypeRank(a.supertype)
          if (stDiff !== 0) return stDiff
          return (getBestTCGPrice(b) ?? 0) - (getBestTCGPrice(a) ?? 0)
        })
        break
      }
      case 'newest':
        // Keep API's release-date ordering as-is (already sorted server-side)
        break
      case 'price-desc':
        arr.sort((a, b) => (getBestTCGPrice(b) ?? 0) - (getBestTCGPrice(a) ?? 0))
        break
      case 'price-asc':
        arr.sort((a, b) => (getBestTCGPrice(a) ?? 0) - (getBestTCGPrice(b) ?? 0))
        break
      case 'alpha':
        arr.sort((a, b) => a.name.localeCompare(b.name))
        break
    }
    return arr
  }, [rawResults, rarityGroup, priceMin, priceMax, sort])

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return
    const next = pageRef.current + 1
    setPage(next)
    search(query, setFilter, next, true, cardNumber)
  }, [hasMore, search, query, setFilter, cardNumber])

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

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '400px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

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
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-2xl font-extrabold tracking-tight mb-5">FIND</h1>

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
              <label className="section-label block mb-1.5">Set Name</label>
              <input type="text" placeholder="Surging Sparks…" value={setFilter}
                onChange={e => setSetFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
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
            onClick={() => { setSearchError(null); search(query, setFilter, 1, false, cardNumber) }}
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
          {!query && !setFilter && ' · Full Art'}
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
        <EmptyBrowse hasQuery={!!query || !!setFilter || hasFilters} />
      ) : (
        <>
          <div className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {displayResults.map((card, i) => (
              <div key={card.id} className="card-enter"
                style={{ animationDelay: `${Math.min(i, 16) * 0.028}s` }}>
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

function EmptyBrowse({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="text-center py-20">
      <div className="mb-4 opacity-30 flex justify-center"><SearchIcon size={48} /></div>
      <p className="font-bold text-lg mb-2">{hasQuery ? 'No cards found' : 'Loading cards…'}</p>
      <p className="text-sm" style={{ color: 'var(--text3)' }}>
        {hasQuery ? 'Try a different name, set, or remove filters.' : ''}
      </p>
    </div>
  )
}
