'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PortfolioTile } from '@/components/cards/CardTile'
import { CardDetailModal } from '@/components/cards/CardDetailModal'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue } from '@/types'
import { formatPrice } from '@/lib/utils'
import type { PokemonCard } from '@/types'

type SortKey = 'value' | 'gain' | 'newest' | 'alpha'

const SORT_LABELS: Record<SortKey, string> = {
  value: 'By Value',
  gain: 'By Gain',
  newest: 'Newest',
  alpha: 'A–Z',
}

export default function PortfolioPage() {
  const { cards, loading } = useCollection()
  const [sort, setSort] = useState<SortKey>('value')
  const [groupBySet, setGroupBySet] = useState(false)
  const [detailCard, setDetailCard] = useState<PokemonCard | null>(null)
  const [detailView, setDetailView] = useState<'detail' | 'sell' | 'gift'>('detail')

  function openCard(card: PokemonCard, view: 'detail' | 'sell' | 'gift' = 'detail') {
    setDetailCard(card)
    setDetailView(view)
  }

  function closeModal() {
    setDetailCard(null)
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
      case 'newest': return arr.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime())
      case 'alpha': return arr.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [owned, sort])

  const groups = useMemo(() => {
    const map = new Map<string, PokemonCard[]>()
    for (const card of sorted) {
      const g = map.get(card.set_name) ?? []
      g.push(card)
      map.set(card.set_name, g)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [sorted])

  const totalValue = owned.reduce((s, c) => s + conditionAdjustedValue(c), 0)

  if (loading) return <LoadingSkeleton />

  if (owned.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="text-6xl mb-5 opacity-30">📋</div>
        <h2 className="text-2xl font-extrabold mb-2">Your vault is empty</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
          Find cards in the Browse tab and add them to your collection.
        </p>
        <Link href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, var(--gold), var(--amber))', color: '#0D0F1A' }}>
          Go to Browse →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Portfolio</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            {owned.length} cards · {formatPrice(totalValue)} total
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3 mb-5">
        {/* Sort chips */}
        <div className="scroll-x flex gap-2">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <button key={k} onClick={() => setSort(k)}
              className={`chip ${sort === k ? 'chip-active' : 'chip-default'}`}>
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>

        {/* Group by set toggle */}
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <div
            className="relative w-10 h-6 rounded-full transition-colors"
            style={{ background: groupBySet ? 'var(--gold)' : 'var(--s2)' }}
            onClick={() => setGroupBySet(g => !g)}>
            <div className="absolute top-1 w-4 h-4 rounded-full transition-transform"
              style={{
                background: groupBySet ? '#0D0F1A' : 'var(--text3)',
                transform: groupBySet ? 'translateX(20px)' : 'translateX(4px)',
              }} />
          </div>
          <span className="text-sm font-semibold">Group by set</span>
        </label>
      </div>

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
            />
          ))}
        </div>
      ) : (
        <CardGrid
          cards={sorted}
          onCardClick={c => openCard(c)}
          onSell={c => openCard(c, 'sell')}
          onGift={c => openCard(c, 'gift')}
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

function SetSection({ setName, cards, onCardClick, onSell, onGift }: {
  setName: string
  cards: PokemonCard[]
  onCardClick: (c: PokemonCard) => void
  onSell: (c: PokemonCard) => void
  onGift: (c: PokemonCard) => void
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
      <CardGrid cards={cards} onCardClick={onCardClick} onSell={onSell} onGift={onGift} />
    </div>
  )
}

function CardGrid({ cards, onCardClick, onSell, onGift }: {
  cards: PokemonCard[]
  onCardClick: (c: PokemonCard) => void
  onSell: (c: PokemonCard) => void
  onGift: (c: PokemonCard) => void
}) {
  return (
    <div className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
      {cards.map(card => (
        <PortfolioTile
          key={card.id}
          card={card}
          onClick={() => onCardClick(card)}
          onSell={e => { e.stopPropagation(); onSell(card) }}
          onGift={e => { e.stopPropagation(); onGift(card) }}
          onLongPress={() => {}}
        />
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
