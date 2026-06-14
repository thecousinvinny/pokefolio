'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { BrowseTile } from '@/components/cards/CardTile'
import { AddToPortfolioModal } from '@/components/cards/AddToPortfolioModal'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice } from '@/lib/utils'
import { getBestTCGPrice } from '@/types'
import type { TCGCard } from '@/types'

const TYPES = ['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless']
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Holo Rare', 'Ultra Rare', 'Special Art Rare', 'Secret Rare']

export default function BrowsePage() {
  const { cards } = useCollection()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [results, setResults] = useState<TCGCard[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [addTarget, setAddTarget] = useState<TCGCard | null>(null)
  const [addDefaultStatus, setAddDefaultStatus] = useState<'owned' | 'wishlist'>('owned')
  const [detailCard, setDetailCard] = useState<TCGCard | null>(null)

  const ownedTcgIds = new Set(cards.filter(c => c.status === 'owned' || c.status === 'for_sale').map(c => c.tcg_id))
  const wishlistTcgIds = new Set(cards.filter(c => c.status === 'wishlist').map(c => c.tcg_id))

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string, type: string, rarity: string, p: number, append: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (type) params.set('type', type)
      if (rarity) params.set('rarity', rarity)
      params.set('page', String(p))
      params.set('pageSize', '20')

      const res = await fetch(`/api/tcg/search?${params}`)
      const data = await res.json()

      if (append) {
        setResults(prev => [...prev, ...data.data])
      } else {
        setResults(data.data ?? [])
      }
      setTotalCount(data.totalCount ?? 0)
      setHasMore(p * 20 < (data.totalCount ?? 0))
    } catch {
      if (!append) setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      search(query, typeFilter, rarityFilter, 1, false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, typeFilter, rarityFilter, search])

  function loadMore() {
    const next = page + 1
    setPage(next)
    search(query, typeFilter, rarityFilter, next, true)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Browse</h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            style={{ color: 'var(--text3)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, set, artist…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--text3)' }}>✕</button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className="px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          style={{
            background: showFilters ? 'var(--gold)' : 'var(--surface)',
            color: showFilters ? '#0D0F1A' : 'var(--text2)',
            border: '1px solid var(--border)',
          }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filters
        </button>
      </div>

      {/* Type chips */}
      <div className="scroll-x flex gap-2 mb-3 pb-1">
        <button onClick={() => setTypeFilter('')}
          className={`chip ${!typeFilter ? 'chip-active' : 'chip-default'}`}>
          All
        </button>
        {TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
            className={`chip ${typeFilter === t ? 'chip-active' : 'chip-default'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="mb-4 p-4 rounded-xl space-y-3 animate-fade-in"
          style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          <div>
            <p className="section-label mb-2">RARITY</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setRarityFilter('')}
                className={`chip ${!rarityFilter ? 'chip-active' : 'chip-default'}`} style={{ fontSize: 12 }}>
                Any
              </button>
              {RARITIES.map(r => (
                <button key={r} onClick={() => setRarityFilter(rarityFilter === r ? '' : r)}
                  className={`chip ${rarityFilter === r ? 'chip-active' : 'chip-default'}`} style={{ fontSize: 12 }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>
        {loading && results.length === 0
          ? 'Searching…'
          : totalCount > 0
          ? `${totalCount.toLocaleString()} cards found`
          : results.length > 0
          ? `${results.length} results`
          : ''}
      </p>

      {/* Grid */}
      {results.length === 0 && !loading ? (
        <EmptyBrowse hasQuery={!!query || !!typeFilter || !!rarityFilter} />
      ) : (
        <>
          <div className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {results.map(card => (
              <BrowseTile
                key={card.id}
                card={card}
                onClick={() => setDetailCard(card)}
                onAddToPortfolio={() => { setAddTarget(card); setAddDefaultStatus('owned') }}
                onAddToWishlist={() => { setAddTarget(card); setAddDefaultStatus('wishlist') }}
                inCollection={ownedTcgIds.has(card.id)}
                inWishlist={wishlistTcgIds.has(card.id)}
              />
            ))}
            {loading && [...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl img-skeleton" style={{ height: 280 }} />
            ))}
          </div>

          {hasMore && !loading && (
            <div className="flex justify-center mt-8">
              <button onClick={loadMore}
                className="px-8 py-3 rounded-full font-bold text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Card detail modal */}
      {detailCard && (
        <BrowseDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onAddToPortfolio={() => { setAddTarget(detailCard); setAddDefaultStatus('owned'); setDetailCard(null) }}
          onAddToWishlist={() => { setAddTarget(detailCard); setAddDefaultStatus('wishlist'); setDetailCard(null) }}
          inCollection={ownedTcgIds.has(detailCard.id)}
          inWishlist={wishlistTcgIds.has(detailCard.id)}
        />
      )}

      {/* Add modal */}
      <AddToPortfolioModal
        card={addTarget}
        onClose={() => setAddTarget(null)}
        defaultStatus={addDefaultStatus}
      />
    </div>
  )
}

function BrowseDetailModal({ card, onClose, onAddToPortfolio, onAddToWishlist, inCollection, inWishlist }: {
  card: TCGCard
  onClose: () => void
  onAddToPortfolio: () => void
  onAddToWishlist: () => void
  inCollection: boolean
  inWishlist: boolean
}) {
  const price = getBestTCGPrice(card)

  return (
    <Modal open onClose={onClose} maxWidth={480}>
      <div className="space-y-5">
        {/* Big card image */}
        <div className="flex justify-center">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: 200, height: 280, background: 'var(--bg)' }}>
            <Image src={card.images.large || card.images.small} alt={card.name} fill className="object-cover" />
          </div>
        </div>

        {/* Info */}
        <div className="text-center">
          <h2 className="text-xl font-extrabold">{card.name}</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            {card.set.name} · #{card.number}
          </p>
          {card.rarity && (
            <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'var(--s2)', color: 'var(--text2)' }}>
              {card.rarity}
            </span>
          )}
          {price != null && (
            <p className="mt-3 text-3xl font-extrabold" style={{ color: 'var(--gold)' }}>
              {formatPrice(price)}
              <span className="text-xs font-medium ml-1" style={{ color: 'var(--text3)' }}>TCGPlayer</span>
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {[
            ['Set', card.set.name],
            ['Number', card.number],
            ['Rarity', card.rarity],
            ['Type', card.types?.join(', ')],
            ['Artist', card.artist],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text3)' }}>{label}</span>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onAddToPortfolio}
            disabled={inCollection}
            className="flex-1 py-3.5 rounded-xl font-bold text-sm"
            style={{
              background: inCollection ? 'rgba(69,219,141,0.1)' : 'linear-gradient(135deg, var(--emerald), var(--sky))',
              color: inCollection ? 'rgba(69,219,141,0.5)' : '#0D0F1A',
            }}>
            {inCollection ? '✓ In Portfolio' : '+ Add to Portfolio'}
          </button>
          <button
            onClick={onAddToWishlist}
            disabled={inWishlist}
            className="px-4 py-3.5 rounded-xl font-bold text-sm"
            style={{
              background: inWishlist ? 'rgba(156,114,250,0.1)' : 'rgba(156,114,250,0.2)',
              color: inWishlist ? 'rgba(156,114,250,0.5)' : 'var(--violet)',
            }}>
            {inWishlist ? '♥' : '♡'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function EmptyBrowse({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4 opacity-30">🔍</div>
      <p className="font-bold text-lg mb-2">
        {hasQuery ? 'No cards found' : 'Search for any card'}
      </p>
      <p className="text-sm" style={{ color: 'var(--text3)' }}>
        {hasQuery
          ? 'Try a different name, set, or remove filters.'
          : 'Type a Pokémon name, set name, or artist to get started.'}
      </p>
    </div>
  )
}
