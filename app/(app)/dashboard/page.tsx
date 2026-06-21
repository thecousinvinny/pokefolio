'use client'
import { useMemo } from 'react'
import Image from 'next/image'
import { TrendingUpIcon, CardIcon, SparkleIcon } from '@/components/ui/Icons'
import { StatCard } from '@/components/ui/StatCard'
import { RollingNumber } from '@/components/ui/RollingNumber'
import { getArtColors } from '@/components/cards/CardArtwork'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue, unrealizedProfit } from '@/types'
import { formatPrice, formatPercent } from '@/lib/utils'

export default function DashboardPage() {
  const { cards, sales, loading } = useCollection()

  const owned = useMemo(() => cards.filter(c => c.status === 'owned' || c.status === 'for_sale'), [cards])
  const totalValue = useMemo(() => owned.reduce((s, c) => s + conditionAdjustedValue(c), 0), [owned])
  const totalCost = useMemo(() => owned.reduce((s, c) => s + (c.price_paid ?? 0), 0), [owned])
  const unrealized = totalValue - totalCost
  const lifetimeEarned = useMemo(() => sales.reduce((s, sale) => s + sale.net_profit, 0), [sales])
  const showcaseCard = useMemo(() => cards.find(c => c.is_showcase) ?? cards.find(c => c.is_favorite), [cards])
  const topPerformers = useMemo(() => owned
    .filter(c => c.price_paid != null)
    .sort((a, b) => unrealizedProfit(b) - unrealizedProfit(a))
    .slice(0, 3), [owned])

  return (
    <div className="max-w-3xl mx-auto px-4 pt-14 pb-8 space-y-6">
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* ── Portfolio value hero ── */}
          <div className="section-enter" style={{ animationDelay: '40ms' }}>
            <PortfolioHero totalValue={totalValue} unrealized={unrealized} />
          </div>

          {/* ── Stat row ── */}
          <div className="grid grid-cols-2 gap-4 section-enter" style={{ animationDelay: '100ms' }}>
            <StatCard
              label="Lifetime Earned"
              value={formatPrice(lifetimeEarned)}
              icon={<TrendingUpIcon size={24} />}
              color={lifetimeEarned >= 0 ? 'var(--emerald)' : 'var(--crimson)'}
            />
            <StatCard
              label="Cards Owned"
              value={String(owned.length)}
              icon={<CardIcon size={24} />}
              color="var(--sky)"
            />
          </div>

          {/* ── Showcase card ── */}
          <div className="section-enter" style={{ animationDelay: '160ms' }}>
            {showcaseCard ? (
              <ShowcaseSection card={showcaseCard} />
            ) : (
              <ShowcaseEmpty />
            )}
          </div>

          {/* ── Market movers ── */}
          <section className="section-enter" style={{ animationDelay: '220ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-bold">Top Performers</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(69,219,141,0.12)', color: 'var(--emerald)' }}>
                by gain
              </span>
            </div>
            {topPerformers.length === 0 ? (
              <div className="surface-card p-5 text-center" style={{ color: 'var(--text3)' }}>
                <p className="text-sm">Add cards with a price paid to see top performers here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topPerformers.map((card, i) => (
                  <div key={card.id} className="card-enter" style={{ animationDelay: `${280 + i * 50}ms` }}>
                    <MoverRow card={card} />
                  </div>
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
  return (
    <div className="surface-card p-6 text-center"
      style={{ border: '1px solid rgba(255,200,69,0.2)', boxShadow: '0 0 40px rgba(255,200,69,0.05)' }}>
      <p className="section-label mb-2">TOTAL PORTFOLIO VALUE</p>
      <p className="text-5xl font-black tracking-tight pv">
        <RollingNumber value={formatPrice(totalValue)} gradient="linear-gradient(135deg, var(--gold), var(--amber))" />
      </p>
      <div className="flex items-center justify-center gap-1.5 mt-3 text-sm font-semibold"
        style={{ color: unrealized >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
        <span>{unrealized >= 0 ? '▲' : '▼'}</span>
        <span>{formatPrice(Math.abs(unrealized))} unrealized</span>
      </div>
    </div>
  )
}

const SHOWCASE_COND_COLOR: Record<string, string> = {
  NM: '#45DB8D', LP: '#a3e635', MP: '#facc15', HP: '#fb923c', DMG: '#f43f5e',
}

function ShowcaseSection({ card }: { card: import('@/types').PokemonCard }) {
  const value = conditionAdjustedValue(card)
  const profit = unrealizedProfit(card)
  const pct = card.price_paid ? (profit / card.price_paid) * 100 : null
  const [c1, c2] = getArtColors(card.types ?? undefined)
  const condColor = SHOWCASE_COND_COLOR[card.condition] ?? '#888'

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Showcase</span>
        <SparkleIcon size={16} style={{ color: '#fff', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' }} />
      </div>

      {/* Type-color ambient in background; no overflow:hidden so prismatic glow isn't clipped */}
      <div style={{
        background: `radial-gradient(ellipse at 25% 50%, ${c1}22 0%, transparent 65%), var(--surface)`,
        borderRadius: 20,
        border: '1px solid rgba(255,200,69,0.2)',
        padding: 16,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}>
        {/* Card — prismatic glow border via .showcase-border */}
        <div
          className="showcase-border"
          style={{
            flexShrink: 0,
            width: 148,
            aspectRatio: '0.72',
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            background: card.image_lg || card.image_sm ? 'var(--bg)' : `linear-gradient(135deg, ${c1}, ${c2})`,
          }}
        >
          {(card.image_lg || card.image_sm) && (
            <Image
              src={card.image_lg ?? card.image_sm!}
              alt={card.name}
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          )}
        </div>

        {/* Info panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Name + set */}
          <div>
            <p style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{card.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{card.set_name}</p>
          </div>

          {/* Rarity + condition chips */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {card.rarity && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
                background: 'rgba(156,114,250,0.15)', color: 'var(--violet)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {card.rarity}
              </span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
              background: `${condColor}22`,
              color: condColor,
              letterSpacing: '0.04em',
            }}>
              {card.condition}
            </span>
          </div>

          {/* Market value */}
          <div>
            <p style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Market Value
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)', lineHeight: 1.1, marginTop: 1 }}>
              {formatPrice(value)}
            </p>
          </div>

          {/* P/L row */}
          {card.price_paid != null && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <p style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Paid</p>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{formatPrice(card.price_paid)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gain / Loss</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
                  {profit >= 0 ? '+' : ''}{formatPrice(profit)}
                  {pct != null && (
                    <span style={{ fontSize: 11, marginLeft: 3 }}>
                      ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ShowcaseEmpty() {
  return (
    <div className="surface-card p-8 text-center">
      <div className="text-4xl mb-3 opacity-40">◈</div>
      <p className="font-bold mb-1">No showcase card yet</p>
      <p className="text-sm" style={{ color: 'var(--text3)' }}>
        Long-press any card's star in Portfolio to set your showcase card.
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
