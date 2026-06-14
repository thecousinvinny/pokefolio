'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Sparkline } from '@/components/ui/Sparkline'
import { useCollection } from '@/components/CollectionContext'
import { generatePriceHistory, formatPrice } from '@/lib/utils'
import { conditionAdjustedValue } from '@/types'
import type { PokemonCard } from '@/types'

export default function WishlistPage() {
  const { cards, updateCard, addCard, removeCard, loading } = useCollection()
  const [showBudget, setShowBudget] = useState(false)

  const wishlist = cards.filter(c => c.status === 'wishlist')
  const owned = cards.filter(c => c.status === 'owned' || c.status === 'for_sale')

  if (loading) return <LoadingSkeleton />

  if (wishlist.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="text-6xl mb-5 opacity-30">♡</div>
        <h2 className="text-2xl font-extrabold mb-2">No cards on your wishlist</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
          Tap the ♡ on any card in Browse to track its price and set a target.
        </p>
        <Link href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, var(--violet), var(--sky))', color: '#fff' }}>
          Go to Browse →
        </Link>
      </div>
    )
  }

  async function addAllToPortfolio() {
    for (const card of wishlist) {
      await removeCard(card.id)
      await addCard({
        ...card,
        status: 'owned',
        condition: 'NM',
        price_paid: card.target_price ?? card.market_price,
        date_added: new Date().toISOString(),
      })
    }
  }

  async function clearSpikedAlerts() {
    for (const card of wishlist) {
      if (card.alerts_enabled && card.target_price != null && (card.market_price ?? 0) > card.target_price) {
        await updateCard(card.id, { alerts_enabled: false })
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Wishlist</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>{wishlist.length} cards tracked</p>
        </div>
        <button
          onClick={() => setShowBudget(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,200,69,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,200,69,0.2)' }}>
          💰 Budget Mode
        </button>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={addAllToPortfolio}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(69,219,141,0.12)', color: 'var(--emerald)', border: '1px solid rgba(69,219,141,0.2)' }}>
          ✚ Add all to Portfolio
        </button>
        <button
          onClick={clearSpikedAlerts}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
          🔕 Clear spiked alerts
        </button>
      </div>

      {/* Grid */}
      <div className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {wishlist.map(card => (
          <WishlistCard key={card.id} card={card} />
        ))}
      </div>

      {/* Budget mode modal */}
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

// ─── Wishlist card ────────────────────────────────────────────────────────────

function WishlistCard({ card }: { card: PokemonCard }) {
  const { updateCard, removeCard, addCard } = useCollection()
  const atTarget = card.target_price != null && (card.market_price ?? 0) <= card.target_price
  const priceHistory = generatePriceHistory(card.market_price ?? 10)

  async function toggleAlert() {
    await updateCard(card.id, { alerts_enabled: !card.alerts_enabled })
  }

  async function moveToPortfolio() {
    await removeCard(card.id)
    await addCard({
      ...card,
      status: 'owned',
      condition: 'NM',
      price_paid: card.target_price ?? card.market_price,
      date_added: new Date().toISOString(),
    })
  }

  return (
    <div className="surface-card overflow-hidden card-hover"
      style={{
        borderColor: atTarget ? 'rgba(69,219,141,0.4)' : 'var(--border)',
        boxShadow: atTarget ? '0 0 20px rgba(69,219,141,0.1)' : undefined,
      }}>
      {/* Image */}
      <div className="relative w-full" style={{ paddingTop: '140%', background: 'var(--bg)' }}>
        {card.image_sm ? (
          <Image src={card.image_sm} alt={card.name} fill className="object-cover"
            sizes="(max-width: 640px) 50vw, 25vw" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black opacity-20">
            {card.name[0]}
          </div>
        )}
        {atTarget && (
          <div className="absolute top-2 right-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'var(--emerald)', color: '#0D0F1A' }}>
              AT TARGET!
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="font-bold text-sm truncate">{card.name}</p>

        <div className="flex items-center justify-between">
          <span className="font-extrabold text-base"
            style={{ color: atTarget ? 'var(--emerald)' : 'var(--text)' }}>
            {card.market_price != null ? formatPrice(card.market_price, true) : '—'}
          </span>
          <button onClick={toggleAlert} className="transition-opacity hover:opacity-70">
            {card.alerts_enabled
              ? <span style={{ color: 'var(--gold)' }}>🔔</span>
              : <span style={{ color: 'var(--text3)' }}>🔕</span>}
          </button>
        </div>

        {card.target_price != null && (
          <p className="text-xs font-semibold" style={{ color: 'var(--violet)' }}>
            Buy if ≤ {formatPrice(card.target_price)}
          </p>
        )}

        {/* Sparkline */}
        <div style={{ height: 28 }}>
          <Sparkline
            points={priceHistory}
            color={atTarget ? '#45DB8D' : '#9C72FA'}
            height={28}
            fill={false}
          />
        </div>

        {/* Move to portfolio */}
        <button
          onClick={moveToPortfolio}
          className="w-full py-2 rounded-xl text-xs font-bold"
          style={{ background: 'rgba(69,219,141,0.1)', color: 'var(--emerald)' }}>
          ✚ Add to Portfolio
        </button>
      </div>
    </div>
  )
}

// ─── Budget Mode ──────────────────────────────────────────────────────────────

function BudgetModeModal({ wishlist, owned, onClose }: {
  wishlist: PokemonCard[]
  owned: PokemonCard[]
  onClose: () => void
}) {
  // Greedy: sell highest-value owned cards to afford top wishlist cards
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
      proceeds += conditionAdjustedValue(next) * 0.88 // ~12% fees
    }
    if (proceeds >= cost + target) {
      buyList.push(wish)
      cost += target
    } else break
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

          <BudgetSection
            title={`Sell these ${sellList.length}`}
            subtitle={`Est. net ${formatPrice(proceeds)}`}
            cards={sellList}
            color="var(--amber)"
          />

          <div className="text-center text-2xl" style={{ color: 'var(--text3)' }}>↓</div>

          <BudgetSection
            title={`Afford these ${buyList.length}`}
            subtitle={`Cost ${formatPrice(cost)}`}
            cards={buyList}
            color="var(--emerald)"
            useTargetPrice
          />
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
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--s2)' }}>
        <span className="font-bold">{title}</span>
        <span className="font-extrabold text-sm" style={{ color }}>{subtitle}</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {cards.map(card => (
          <div key={card.id} className="flex items-center gap-3 p-3">
            <div className="relative flex-shrink-0 rounded-lg overflow-hidden"
              style={{ width: 36, height: 50, background: 'var(--bg)' }}>
              {card.image_sm && <Image src={card.image_sm} alt={card.name} fill className="object-cover" />}
            </div>
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
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl img-skeleton" style={{ height: 280 }} />
        ))}
      </div>
    </div>
  )
}
