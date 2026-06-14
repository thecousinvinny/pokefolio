'use client'
import Image from 'next/image'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, formatDate } from '@/lib/utils'
import type { SaleRecord } from '@/types'

export default function SoldPage() {
  const { sales, loading } = useCollection()

  const totalEarned = sales.reduce((s, sale) => s + sale.net_profit, 0)
  const bestSale = sales.reduce<SaleRecord | null>((best, sale) =>
    best == null || sale.net_profit > best.net_profit ? sale : best, null
  )

  if (loading) return <LoadingSkeleton />

  if (sales.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="text-6xl mb-5 opacity-30">📊</div>
        <h2 className="text-2xl font-extrabold mb-2">No sales yet</h2>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>
          When you sell a card from your Portfolio, your profit ledger appears here.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-extrabold tracking-tight">Sold / Traded</h1>

      {/* Summary card */}
      <div className="surface-card p-6">
        <p className="section-label mb-2">LIFETIME NET PROFIT</p>
        <p className="text-5xl font-black"
          style={{ color: totalEarned >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
          {formatPrice(totalEarned)}
        </p>

        {bestSale && (
          <div className="flex items-center gap-3 mt-4 p-3 rounded-xl"
            style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
            <span className="text-xl">🏆</span>
            <div className="flex-1 min-w-0">
              <p className="section-label">BEST SALE EVER</p>
              <p className="font-bold text-sm truncate">{bestSale.card_name}</p>
            </div>
            <span className="font-extrabold text-base" style={{ color: 'var(--emerald)' }}>
              +{formatPrice(bestSale.net_profit)}
            </span>
          </div>
        )}
      </div>

      {/* Monthly bar chart */}
      <MonthlyChart sales={sales} />

      {/* Ledger */}
      <section>
        <h2 className="font-bold text-base mb-3">History</h2>
        <div className="space-y-3">
          {sales.map(sale => (
            <SaleRow key={sale.id} sale={sale} />
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── Monthly chart ────────────────────────────────────────────────────────────

function MonthlyChart({ sales }: { sales: SaleRecord[] }) {
  const buckets = getLast6Months(sales)
  const maxAbs = Math.max(...buckets.map(b => Math.abs(b.profit)), 1)

  return (
    <div className="surface-card p-5">
      <h2 className="font-bold mb-4">Profit per Month</h2>
      <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
        {buckets.map(bucket => {
          const heightPct = (Math.abs(bucket.profit) / maxAbs) * 100
          const isPos = bucket.profit >= 0
          return (
            <div key={bucket.label} className="flex-1 flex flex-col items-center gap-2">
              {bucket.profit !== 0 && (
                <span className="text-xs font-bold" style={{ color: isPos ? 'var(--emerald)' : 'var(--crimson)' }}>
                  {formatPrice(bucket.profit, true)}
                </span>
              )}
              <div className="w-full flex items-end" style={{ height: 120 }}>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${Math.max(4, heightPct)}%`,
                    background: isPos
                      ? 'linear-gradient(to bottom, var(--emerald), rgba(69,219,141,0.4))'
                      : 'linear-gradient(to bottom, var(--crimson), rgba(242,69,96,0.4))',
                  }}
                />
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>{bucket.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getLast6Months(sales: SaleRecord[]): { label: string; profit: number }[] {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const profit = sales
      .filter(s => {
        const sd = new Date(s.date_sold)
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth()
      })
      .reduce((sum, s) => sum + s.net_profit, 0)
    result.push({ label, profit })
  }
  return result
}

// ─── Sale row ─────────────────────────────────────────────────────────────────

function SaleRow({ sale }: { sale: SaleRecord }) {
  return (
    <div className="surface-card p-3 flex items-center gap-3">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 rounded-lg overflow-hidden"
        style={{ width: 44, height: 62, background: 'var(--bg)' }}>
        {sale.image_sm && (
          <Image src={sale.image_sm} alt={sale.card_name} fill className="object-cover" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{sale.card_name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          {formatDate(sale.date_sold)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          Sold {formatPrice(sale.sold_price)}
          {(sale.fees + sale.shipping) > 0 && ` · fees ${formatPrice(sale.fees + sale.shipping)}`}
        </p>
      </div>

      {/* Net profit */}
      <div className="text-right flex-shrink-0">
        <p className="font-extrabold text-base"
          style={{ color: sale.net_profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
          {sale.net_profit >= 0 ? '+' : ''}{formatPrice(sale.net_profit)}
        </p>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl img-skeleton" />
      ))}
    </div>
  )
}
