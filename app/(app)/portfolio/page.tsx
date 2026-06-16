'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { PortfolioTile } from '@/components/cards/CardTile'
import { CardDetailModal } from '@/components/cards/CardDetailModal'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue } from '@/types'
import { formatPrice, rarityWeight } from '@/lib/utils'
import type { PokemonCard } from '@/types'

type SortKey = 'value' | 'gain' | 'rarity' | 'newest' | 'alpha'
type RarityGroup = 'all' | 'fullart' | 'ultra' | 'holo' | 'common'

const SORT_LABELS: Record<SortKey, string> = {
  value:  'Value',
  gain:   'Gain',
  rarity: 'Rarity',
  newest: 'Newest',
  alpha:  'A–Z',
}

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

export default function PortfolioPage() {
  const { cards, loading, setFavorite, setShowcase } = useCollection()
  const [sort, setSort] = useState<SortKey>(() => lsGet('catchm_p_sort', 'value'))
  const [rarityGroup, setRarityGroup] = useState<RarityGroup>(() => lsGet('catchm_p_rarity', 'all'))
  const [groupBySet, setGroupBySet] = useState<boolean>(() => lsGet('catchm_p_group', false))
  const [favOnly, setFavOnly] = useState<boolean>(() => lsGet('catchm_p_favonly', true))
  const [showFilter, setShowFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [detailCardId, setDetailCardId] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<'detail' | 'sell' | 'gift'>('detail')

  const detailCard = useMemo(
    () => detailCardId ? (cards.find(c => c.id === detailCardId) ?? null) : null,
    [cards, detailCardId]
  )

  function openCard(card: PokemonCard, view: 'detail' | 'sell' | 'gift' = 'detail') {
    setDetailCardId(card.id)
    setDetailView(view)
  }

  function closeModal() {
    setDetailCardId(null)
    setDetailView('detail')
  }

  const owned = useMemo(() =>
    cards.filter(c => c.status === 'owned' || c.status === 'for_sale'),
    [cards]
  )

  const sorted = useMemo(() => {
    const arr = [...owned]
    switch (sort) {
      case 'value': return arr.sort((a, b) => conditionAdjustedValue(b) - conditionAdjustedValue(a))
      case 'gain': {
        return arr.sort((a, b) => {
          const ga = a.price_paid ? conditionAdjustedValue(a) - a.price_paid : -Infinity
          const gb = b.price_paid ? conditionAdjustedValue(b) - b.price_paid : -Infinity
          return gb - ga
        })
      }
      case 'rarity': return arr.sort((a, b) => rarityWeight(b.rarity) - rarityWeight(a.rarity))
      case 'newest': return arr.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime())
      case 'alpha': return arr.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [owned, sort])

  useEffect(() => { try { localStorage.setItem('catchm_p_sort', JSON.stringify(sort)) } catch {} }, [sort])
  useEffect(() => { try { localStorage.setItem('catchm_p_rarity', JSON.stringify(rarityGroup)) } catch {} }, [rarityGroup])
  useEffect(() => { try { localStorage.setItem('catchm_p_group', JSON.stringify(groupBySet)) } catch {} }, [groupBySet])
  useEffect(() => { try { localStorage.setItem('catchm_p_favonly', JSON.stringify(favOnly)) } catch {} }, [favOnly])

  const filtered = useMemo(() => {
    let arr = sorted
    if (favOnly) arr = arr.filter(c => c.is_favorite || c.is_showcase)
    if (rarityGroup !== 'all') arr = arr.filter(c => rarityGroupMatch(c.rarity, rarityGroup))
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(c => c.name.toLowerCase().includes(q) || c.set_name.toLowerCase().includes(q))
    }
    return arr
  }, [sorted, favOnly, rarityGroup, search])

  const groups = useMemo(() => {
    const map = new Map<string, PokemonCard[]>()
    for (const card of filtered) {
      const g = map.get(card.set_name) ?? []
      g.push(card)
      map.set(card.set_name, g)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const totalValue = owned.reduce((s, c) => s + conditionAdjustedValue(c), 0)

  const filterCount = (sort !== 'value' ? 1 : 0) + (rarityGroup !== 'all' ? 1 : 0) + (groupBySet ? 1 : 0) + (!favOnly ? 1 : 0)

  if (loading) return <LoadingSkeleton />

  if (owned.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <h2 className="text-2xl font-extrabold mb-2">Your vault is empty</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
          Find cards in the FIND tab and add them to your collection.
        </p>
        <Link href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
          style={{ background: 'var(--btn-catchm)', color: '#fff' }}>
          Go to FIND →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">CATCHM</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
          {owned.length} cards · {formatPrice(totalValue)} total
        </p>
      </div>

      {/* Search + filter icon */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            style={{ color: 'var(--text3)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search your portfolio…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--text3)', fontSize: 14, lineHeight: 1 }}>✕</button>
          )}
        </div>
        <button
          onClick={() => setShowFilter(f => !f)}
          style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: filterCount > 0 ? 'rgba(255,200,69,0.12)' : 'var(--surface)',
            color: filterCount > 0 ? 'var(--gold)' : 'var(--text2)',
            border: `1px solid ${filterCount > 0 ? 'rgba(255,200,69,0.30)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: 'pointer',
          }}>
          <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          {filterCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 6,
              minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--gold)', color: '#0D0F1A',
              fontSize: 8, fontWeight: 900, lineHeight: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="rounded-2xl p-4 mb-5 space-y-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="section-label mb-2">Sort</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <button key={k} onClick={() => setSort(k)}
                  className={`chip ${sort === k ? 'chip-active' : 'chip-default'}`}>
                  {SORT_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="section-label mb-2">Rarity</p>
            <div className="flex flex-wrap gap-2">
              {RARITY_GROUPS.map(({ key, label }) => (
                <button key={key} onClick={() => setRarityGroup(key)}
                  className={`chip ${rarityGroup === key ? 'chip-active' : 'chip-default'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold">Favorites only</span>
              <div className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: favOnly ? 'var(--gold)' : 'var(--s2)' }}
                onClick={() => setFavOnly(f => !f)}>
                <div className="absolute top-1 w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: favOnly ? '#0D0F1A' : 'var(--text3)',
                    transform: favOnly ? 'translateX(20px)' : 'translateX(4px)',
                  }} />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold">Group by set</span>
              <div className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: groupBySet ? 'var(--gold)' : 'var(--s2)' }}
                onClick={() => setGroupBySet(g => !g)}>
                <div className="absolute top-1 w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: groupBySet ? '#0D0F1A' : 'var(--text3)',
                    transform: groupBySet ? 'translateX(20px)' : 'translateX(4px)',
                  }} />
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Results count */}
      {filtered.length !== owned.length && (
        <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>
          {filtered.length} of {owned.length} cards
        </p>
      )}

      {/* Grid / Groups */}
      {groupBySet ? (
        <div className="space-y-8">
          {groups.map(([setName, setCards]) => (
            <SetSection
              key={setName}
              setName={setName}
              cards={setCards}
              onCardClick={c => openCard(c)}
              onSell={c => openCard(c, 'sell')}
              onGift={c => openCard(c, 'gift')}
              onFavorite={c => setFavorite(c.id)}
              onShowcase={c => setShowcase(c.id)}
            />
          ))}
        </div>
      ) : filtered.length === 0 && favOnly ? (
        <div className="text-center py-16">
          <p style={{ fontSize: 36, marginBottom: 12, opacity: 0.25 }}>★</p>
          <p className="font-bold mb-1">No favorites yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>
            Long-press the star on any card to mark it as a favorite.
          </p>
          <button onClick={() => setFavOnly(false)}
            className="px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--surface)', color: 'var(--gold)', border: '1px solid rgba(255,200,69,0.3)', cursor: 'pointer' }}>
            Show all cards
          </button>
        </div>
      ) : (
        <CardGrid
          cards={filtered}
          onCardClick={c => openCard(c)}
          onSell={c => openCard(c, 'sell')}
          onGift={c => openCard(c, 'gift')}
          onFavorite={c => setFavorite(c.id)}
          onShowcase={c => setShowcase(c.id)}
        />
      )}

      <CardDetailModal
        key={detailCard?.id}
        card={detailCard}
        initialView={detailView}
        onClose={closeModal}
      />
    </div>
  )
}

function SetSection({ setName, cards, onCardClick, onSell, onGift, onFavorite, onShowcase }: {
  setName: string
  cards: PokemonCard[]
  onCardClick: (c: PokemonCard) => void
  onSell: (c: PokemonCard) => void
  onGift: (c: PokemonCard) => void
  onFavorite: (c: PokemonCard) => void
  onShowcase: (c: PokemonCard) => void
}) {
  const setTotal = cards.reduce((s, c) => s + conditionAdjustedValue(c), 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold">{setName}</h3>
        <span className="font-extrabold text-sm" style={{ color: 'var(--gold)' }}>
          {formatPrice(setTotal)}
        </span>
      </div>
      <CardGrid cards={cards} onCardClick={onCardClick} onSell={onSell} onGift={onGift}
        onFavorite={onFavorite} onShowcase={onShowcase} />
    </div>
  )
}

function CardGrid({ cards, onCardClick, onSell, onGift, onFavorite, onShowcase }: {
  cards: PokemonCard[]
  onCardClick: (c: PokemonCard) => void
  onSell: (c: PokemonCard) => void
  onGift: (c: PokemonCard) => void
  onFavorite: (c: PokemonCard) => void
  onShowcase: (c: PokemonCard) => void
}) {
  return (
    <div className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
      {cards.map((card, i) => (
        <div key={card.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 0.028}s` }}>
          <PortfolioTile
            card={card}
            onClick={() => onCardClick(card)}
            onSell={e => { e.stopPropagation(); onSell(card) }}
            onGift={e => { e.stopPropagation(); onGift(card) }}
            onFavorite={() => onFavorite(card)}
            onShowcase={() => onShowcase(card)}
          />
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="h-8 w-40 rounded-xl img-skeleton mb-6" />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl img-skeleton" style={{ height: 240 }} />
        ))}
      </div>
    </div>
  )
}
