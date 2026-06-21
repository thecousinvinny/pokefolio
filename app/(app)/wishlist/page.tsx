'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { XIcon, TrendingUpIcon, CardIcon } from '@/components/ui/Icons'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { PortfolioTile } from '@/components/cards/CardTile'
import { CardDetailModal } from '@/components/cards/CardDetailModal'
import { MoveToPortfolioModal } from '@/components/cards/MoveToPortfolioModal'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue } from '@/types'
import { formatPrice, rarityWeight } from '@/lib/utils'
import type { PokemonCard } from '@/types'

type WLSort = 'rarity' | 'price-desc' | 'price-asc' | 'target' | 'newest' | 'delta'
type RarityGroup = 'all' | 'fullart' | 'ultra' | 'holo' | 'common'

const WL_SORT_LABELS: Record<WLSort, string> = {
  rarity:       'Rarity',
  'price-desc': 'Price ↓',
  'price-asc':  'Price ↑',
  target:       'Target',
  newest:       'Newest',
  delta:        'Dropped',
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

export default function WishlistPage() {
  const { cards, loading, removeCard } = useCollection()
  const [detailCardId, setDetailCardId] = useState<string | null>(null)
  const [showBudget, setShowBudget] = useState(false)
  const [sort, setSort] = useState<WLSort>(() => lsGet('catchm_w_sort', 'rarity'))
  const [rarityGroup, setRarityGroup] = useState<RarityGroup>(() => lsGet('catchm_w_rarity', 'all'))
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [moveCard, setMoveCard] = useState<PokemonCard | null>(null)

  useEffect(() => { try { localStorage.setItem('catchm_w_sort', JSON.stringify(sort)) } catch {} }, [sort])
  useEffect(() => { try { localStorage.setItem('catchm_w_rarity', JSON.stringify(rarityGroup)) } catch {} }, [rarityGroup])

  const wishlistRaw = useMemo(() => cards.filter(c => c.status === 'wishlist'), [cards])
  const owned = useMemo(() => cards.filter(c => c.status === 'owned' || c.status === 'for_sale'), [cards])
  const ownedTcgIds = useMemo(() => new Set(owned.map(c => c.tcg_id)), [owned])

  const wishlist = useMemo(() => {
    let arr = [...wishlistRaw]
    if (rarityGroup !== 'all') arr = arr.filter(c => rarityGroupMatch(c.rarity, rarityGroup))
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(c => c.name.toLowerCase().includes(q) || c.set_name.toLowerCase().includes(q))
    }
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
        return arr.sort((a, b) => pct(a) - pct(b))
      }
      default: return arr
    }
  }, [wishlistRaw, sort, rarityGroup, search])

  const detailCard = useMemo(
    () => detailCardId ? (wishlistRaw.find(c => c.id === detailCardId) ?? null) : null,
    [wishlistRaw, detailCardId]
  )

  const filterCount = (sort !== 'rarity' ? 1 : 0) + (rarityGroup !== 'all' ? 1 : 0)

  if (loading) return <LoadingSkeleton />

  if (wishlistRaw.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <h2 className="text-2xl font-extrabold mb-2">No cards on your wishlist</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
          Tap the heart on any card in FIND to track its price and set a target.
        </p>
        <Link href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
          style={{ background: 'var(--btn-wishlist)', color: '#fff' }}>
          Go to FIND →
        </Link>
      </div>
    )
  }

  const totalMarket = wishlistRaw.reduce((s, c) => s + (c.market_price ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 pt-14 pb-8 animate-fade-in">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Market Value" value={formatPrice(totalMarket, true)} icon={<TrendingUpIcon size={22} />} color="var(--gold)" />
        <StatCard label="Cards" value={String(wishlistRaw.length)} icon={<CardIcon size={22} />} color="var(--sky)" />
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
            placeholder="Search your wishlist…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--text3)', display: 'flex' }}><XIcon size={16} /></button>
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
              {(Object.keys(WL_SORT_LABELS) as WLSort[]).map(k => (
                <button key={k} onClick={() => setSort(k)}
                  className={`chip ${sort === k ? 'chip-active' : 'chip-default'}`}>
                  {WL_SORT_LABELS[k]}
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
        </div>
      )}

      {/* Results count */}
      {wishlist.length !== wishlistRaw.length && (
        <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>
          {wishlist.length} of {wishlistRaw.length} cards
        </p>
      )}

      {/* Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {wishlist.map((card, i) => (
          <div key={card.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 0.028}s` }}>
            <PortfolioTile
              card={card}
              onClick={() => setDetailCardId(card.id)}
              inCollection={ownedTcgIds.has(card.tcg_id)}
              onAddToPortfolio={() => setMoveCard(card)}
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

      {/* Move to portfolio modal (from tile) */}
      <MoveToPortfolioModal
        card={moveCard}
        onClose={() => setMoveCard(null)}
      />

      {showBudget && (
        <BudgetModeModal
          wishlist={wishlistRaw}
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
    <Modal open onClose={onClose} title="Budget Mode" maxWidth={480}>
      {buyList.length === 0 ? (
        <div className="text-center py-8">
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
