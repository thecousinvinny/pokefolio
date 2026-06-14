'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { PortfolioTile } from '@/components/cards/CardTile'
import { CardDetailModal } from '@/components/cards/CardDetailModal'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue } from '@/types'
import { formatPrice, rarityWeight } from '@/lib/utils'
import type { PokemonCard } from '@/types'

type WLSort = 'rarity' | 'price-desc' | 'price-asc' | 'target' | 'newest' | 'delta'

const WL_SORT_LABELS: Record<WLSort, string> = {
  rarity:     '✨ Rarity',
  'price-desc': '💰 Price ↓',
  'price-asc':  '💰 Price ↑',
  target:     '🎯 Target',
  newest:     '🆕 Newest',
  delta:      '📉 Dropped',
}

export default function WishlistPage() {
  const { cards, loading, updateCard, removeCard } = useCollection()
  const [detailCardId, setDetailCardId] = useState<string | null>(null)
  const [showBudget, setShowBudget] = useState(false)
  const [sort, setSort] = useState<WLSort>('rarity')

  const wishlistRaw = useMemo(() => cards.filter(c => c.status === 'wishlist'), [cards])
  const owned    = useMemo(() => cards.filter(c => c.status === 'owned' || c.status === 'for_sale'), [cards])
  const ownedTcgIds = useMemo(() => new Set(owned.map(c => c.tcg_id)), [owned])

  const wishlist = useMemo(() => {
    const arr = [...wishlistRaw]
    switch (sort) {
      case 'rarity':
        return arr.sort((a, b) => rarityWeight(b.rarity) - rarityWeight(a.rarity))
      case 'price-desc':
        return arr.sort((a, b) => (b.market_price ?? 0) - (a.market_price ?? 0))
      case 'price-asc':
        return arr.sort((a, b) => (a.market_price ?? 0) - (b.market_price ?? 0))
      case 'target':
        return arr.sort((a, b) => (b.target_price ?? b.market_price ?? 0) - (a.target_price ?? a.market_price ?? 0))
      case 'newest':
        return arr.sort((a, b) => new Date(b.date_added ?? 0).getTime() - new Date(a.date_added ?? 0).getTime())
      case 'delta': {
        const pct = (c: PokemonCard) => c.market_price != null && c.market_at_buy
          ? (c.market_price - c.market_at_buy) / c.market_at_buy
          : 0
        return arr.sort((a, b) => pct(a) - pct(b))  // most dropped first
      }
      default: return arr
    }
  }, [wishlistRaw, sort])

  const detailCard = useMemo(
    () => detailCardId ? (wishlist.find(c => c.id === detailCardId) ?? null) : null,
    [wishlist, detailCardId]
  )

  if (loading) return <LoadingSkeleton />

  if (wishlistRaw.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="text-6xl mb-5 opacity-30">♡</div>
        <h2 className="text-2xl font-extrabold mb-2">No cards on your wishlist</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
          Tap ♡ on any card in Browse to track its price and set a target.
        </p>
        <Link href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, var(--violet), var(--sky))', color: '#fff' }}>
          Go to Browse →
        </Link>
      </div>
    )
  }

  const totalMarket = wishlistRaw.reduce((s, c) => s + (c.market_price ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Wishlist</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            {wishlistRaw.length} cards · {formatPrice(totalMarket)} market value
          </p>
        </div>
        <button
          onClick={() => setShowBudget(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,200,69,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,200,69,0.2)' }}>
          💰 Budget Mode
        </button>
      </div>

      {/* Sort chips */}
      <div className="scroll-x flex gap-2 mb-5 pb-1">
        {(Object.keys(WL_SORT_LABELS) as WLSort[]).map(k => (
          <button key={k} onClick={() => setSort(k)}
            className={`chip ${sort === k ? 'chip-active' : 'chip-default'}`} style={{ fontSize: 12 }}>
            {WL_SORT_LABELS[k]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {wishlist.map((card, i) => (
          <div key={card.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 0.028}s` }}>
            <PortfolioTile
              card={card}
              onClick={() => setDetailCardId(card.id)}
              inCollection={ownedTcgIds.has(card.tcg_id)}
              onAddToPortfolio={() => {
                updateCard(card.id, { status: 'owned', condition: 'NM', market_at_buy: card.market_price })
              }}
              onRemove={() => removeCard(card.id)}
            />
          </div>
        ))}
      </div>

      {/* Wishlist detail modal */}
      <CardDetailModal
        key={detailCard?.id}
        card={detailCard}
        view="wishlist"
        onClose={() => setDetailCardId(null)}
      />

      {showBudget && (
        <BudgetModeModal
          wishlist={wishlist}
          owned={owned}
          onClose={() => setShowBudget(false)}
        />
      )}
    </div>
  )
}

// ─── Budget Mode ──────────────────────────────────────────────────────────────

function BudgetModeModal({ wishlist, owned, onClose }: {
  wishlist: PokemonCard[]
  owned: PokemonCard[]
  onClose: () => void
}) {
  const topWishes = [...wishlist].sort((a, b) =>
    (b.target_price ?? b.market_price ?? 0) - (a.target_price ?? a.market_price ?? 0)
  )
  const sellCandidates = [...owned].sort((a, b) =>
    conditionAdjustedValue(b) - conditionAdjustedValue(a)
  )

  let sellList: PokemonCard[] = []
  let buyList: PokemonCard[] = []
  let proceeds = 0
  let cost = 0

  for (const wish of topWishes) {
    const target = wish.target_price ?? wish.market_price ?? 0
    while (proceeds < cost + target && sellList.length < sellCandidates.length) {
      const next = sellCandidates[sellList.length]
      sellList.push(next)
      proceeds += conditionAdjustedValue(next) * 0.88
    }
    if (proceeds >= cost + target) { buyList.push(wish); cost += target } else break
  }

  return (
    <Modal open onClose={onClose} title="💰 Budget Mode" maxWidth={480}>
      {buyList.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-4xl mb-4">🤷</p>
          <p className="font-bold mb-2">No plan yet</p>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>
            Add owned cards and wishlist targets to get a sell-to-buy plan.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-center font-bold">
            Sell {sellList.length} to afford your top {buyList.length}
          </p>
          <BudgetSection title={`Sell these ${sellList.length}`} subtitle={`Est. net ${formatPrice(proceeds)}`} cards={sellList} color="var(--amber)" />
          <div className="text-center text-2xl" style={{ color: 'var(--text3)' }}>↓</div>
          <BudgetSection title={`Afford these ${buyList.length}`} subtitle={`Cost ${formatPrice(cost)}`} cards={buyList} color="var(--emerald)" useTargetPrice />
        </div>
      )}
    </Modal>
  )
}

function BudgetSection({ title, subtitle, cards, color, useTargetPrice }: {
  title: string; subtitle: string; cards: PokemonCard[]; color: string; useTargetPrice?: boolean
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--s2)' }}>
        <span className="font-bold">{title}</span>
        <span className="font-extrabold text-sm" style={{ color }}>{subtitle}</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {cards.map(card => (
          <div key={card.id} className="flex items-center gap-3 p-3">
            {card.image_sm && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image_sm} alt={card.name} className="flex-shrink-0 rounded-lg object-cover" style={{ width: 36, height: 50 }} />
            )}
            <span className="flex-1 text-sm font-semibold truncate">{card.name}</span>
            <span className="font-bold text-sm" style={{ color }}>
              {formatPrice(useTargetPrice ? (card.target_price ?? card.market_price ?? 0) : conditionAdjustedValue(card))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="h-8 w-32 rounded-xl img-skeleton mb-6" />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl img-skeleton" style={{ height: 280 }} />
        ))}
      </div>
    </div>
  )
}
