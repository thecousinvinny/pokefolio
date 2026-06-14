'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue, unrealizedProfit } from '@/types'
import { formatPrice, formatPercent } from '@/lib/utils'

export default function DashboardPage() {
  const { cards, sales, loading } = useCollection()

  const owned = cards.filter(c => c.status === 'owned' || c.status === 'for_sale')
  const totalValue = owned.reduce((s, c) => s + conditionAdjustedValue(c), 0)
  const totalCost = owned.reduce((s, c) => s + (c.price_paid ?? 0), 0)
  const unrealized = totalValue - totalCost
  const lifetimeEarned = sales.reduce((s, sale) => s + sale.net_profit, 0)
  const favoriteCard = cards.find(c => c.is_favorite)

  // Top performers by unrealized profit
  const topPerformers = owned
    .filter(c => c.price_paid != null)
    .sort((a, b) => unrealizedProfit(b) - unrealizedProfit(a))
    .slice(0, 3)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* ── Portfolio value hero ── */}
          <PortfolioHero totalValue={totalValue} unrealized={unrealized} />

          {/* ── Stat row ── */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Lifetime Earned"
              value={formatPrice(lifetimeEarned)}
              icon="💵"
              color={lifetimeEarned >= 0 ? 'var(--emerald)' : 'var(--crimson)'}
            />
            <StatCard
              label="Cards Owned"
              value={String(owned.length)}
              icon="🃏"
              color="var(--sky)"
            />
          </div>

          {/* ── Favorite card ── */}
          {favoriteCard ? (
            <FavoriteSection card={favoriteCard} />
          ) : (
            <FavoriteEmpty />
          )}

          {/* ── Market movers ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-bold">Top Performers</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(69,219,141,0.12)', color: 'var(--emerald)' }}>
                📈 by gain
              </span>
            </div>
            {topPerformers.length === 0 ? (
              <div className="surface-card p-5 text-center" style={{ color: 'var(--text3)' }}>
                <p className="text-sm">Add cards with a price paid to see top performers here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topPerformers.map(card => (
                  <MoverRow key={card.id} card={card} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PortfolioHero({ totalValue, unrealized }: { totalValue: number; unrealized: number }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (totalValue === 0) return
    let start = 0
    const step = totalValue / 40
    const timer = setInterval(() => {
      start = Math.min(start + step, totalValue)
      setDisplayed(start)
      if (start >= totalValue) clearInterval(timer)
    }, 25)
    return () => clearInterval(timer)
  }, [totalValue])

  return (
    <div className="surface-card p-6 text-center"
      style={{ border: '1px solid rgba(255,200,69,0.2)', boxShadow: '0 0 40px rgba(255,200,69,0.05)' }}>
      <p className="section-label mb-2">TOTAL PORTFOLIO VALUE</p>
      <p className="text-5xl font-black tracking-tight"
        style={{ background: 'linear-gradient(135deg, var(--gold), var(--amber))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {formatPrice(displayed)}
      </p>
      <div className="flex items-center justify-center gap-1.5 mt-3 text-sm font-semibold"
        style={{ color: unrealized >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
        <span>{unrealized >= 0 ? '▲' : '▼'}</span>
        <span>{formatPrice(Math.abs(unrealized))} unrealized</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
      <p className="section-label mt-1">{label.toUpperCase()}</p>
    </div>
  )
}

function FavoriteSection({ card }: { card: import('@/types').PokemonCard }) {
  const value = conditionAdjustedValue(card)
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base font-bold">Favorite Card</span>
        <span className="text-gold">★</span>
      </div>
      <div className="surface-card overflow-hidden"
        style={{ border: '1px solid rgba(255,200,69,0.35)', boxShadow: '0 10px 40px rgba(255,200,69,0.15)' }}>
        <div className="relative w-full" style={{ paddingTop: '70%', background: 'var(--bg)' }}>
          {card.image_lg || card.image_sm ? (
            <Image
              src={card.image_lg ?? card.image_sm!}
              alt={card.name}
              fill
              className="object-contain object-top"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl font-black opacity-20">
              {card.name[0]}
            </div>
          )}
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-lg font-extrabold">{card.name}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>{card.set_name}</p>
          </div>
          <p className="text-2xl font-extrabold" style={{ color: 'var(--gold)' }}>
            {formatPrice(value, true)}
          </p>
        </div>
      </div>
    </section>
  )
}

function FavoriteEmpty() {
  return (
    <div className="surface-card p-8 text-center">
      <div className="text-4xl mb-3 opacity-40">★</div>
      <p className="font-bold mb-1">No favorite yet</p>
      <p className="text-sm" style={{ color: 'var(--text3)' }}>
        Long-press any card in your Portfolio or Wishlist to crown your favorite.
      </p>
    </div>
  )
}

function MoverRow({ card }: { card: import('@/types').PokemonCard }) {
  const value = conditionAdjustedValue(card)
  const profit = card.price_paid != null ? value - card.price_paid : 0
  const pct = card.price_paid ? (profit / card.price_paid) * 100 : 0

  return (
    <div className="surface-card p-3 flex items-center gap-3">
      <div className="relative flex-shrink-0 rounded-lg overflow-hidden"
        style={{ width: 44, height: 62, background: 'var(--bg)' }}>
        {card.image_sm && (
          <Image src={card.image_sm} alt={card.name} fill className="object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{card.name}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text3)' }}>
          {card.set_name} · {card.condition}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-extrabold text-sm" style={{ color: 'var(--gold)' }}>{formatPrice(value)}</p>
        <p className="text-xs font-bold mt-0.5"
          style={{ color: profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
          {profit >= 0 ? '▲' : '▼'} {formatPercent(pct)}
        </p>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl img-skeleton" />
      ))}
    </div>
  )
}
