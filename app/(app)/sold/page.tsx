'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, formatDate } from '@/lib/utils'
import type { SaleRecord } from '@/types'

export default function SoldPage() {
  const { sales, loading } = useCollection()
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const selectedSale = selectedSaleId ? (sales.find(s => s.id === selectedSaleId) ?? null) : null

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
          When you sell a card from CATCHM, your profit ledger appears here.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-extrabold tracking-tight">LEDGER</h1>

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
            <SaleRow key={sale.id} sale={sale} onClick={() => setSelectedSaleId(sale.id)} />
          ))}
        </div>
      </section>

      {selectedSale && (
        <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSaleId(null)} />
      )}
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

function SaleRow({ sale, onClick }: { sale: SaleRecord; onClick: () => void }) {
  const isGift = sale.sale_type === 'gift'
  return (
    <div
      onClick={onClick}
      className="surface-card p-3 flex items-center gap-3"
      style={{ cursor: 'pointer', transition: 'opacity 0.12s' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 rounded-lg overflow-hidden"
        style={{ width: 44, height: 62, background: 'var(--bg)' }}>
        {sale.image_sm && (
          <Image src={sale.image_sm} alt={sale.card_name} fill className="object-cover" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate">{sale.card_name}</p>
          {isGift && (
            <span style={{ fontSize: 8, fontWeight: 900, color: '#fff', background: 'var(--violet)', padding: '1px 5px', borderRadius: 100, whiteSpace: 'nowrap' }}>GIFT</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          {sale.set_name} · {formatDate(sale.date_sold)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          {isGift ? 'Gifted' : `Sold ${formatPrice(sale.sold_price)}`}
          {(sale.fees + sale.shipping) > 0 && ` · fees ${formatPrice(sale.fees + sale.shipping)}`}
        </p>
      </div>

      {/* Net profit */}
      <div className="text-right flex-shrink-0">
        <p className="font-extrabold text-base"
          style={{ color: sale.net_profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
          {sale.net_profit >= 0 ? '+' : ''}{formatPrice(sale.net_profit)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>net</p>
      </div>
    </div>
  )
}

// ─── Sale detail modal ────────────────────────────────────────────────────────

function SaleDetailModal({ sale, onClose }: { sale: SaleRecord; onClose: () => void }) {
  const isGift = sale.sale_type === 'gift'

  return (
    <Modal open onClose={onClose} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Card header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {sale.image_sm && (
            <div style={{ position: 'relative', width: 68, height: 95, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
              <Image src={sale.image_sm} alt={sale.card_name} fill className="object-cover" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{sale.card_name}</h2>
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: '0.05em',
                color: '#fff', background: isGift ? 'var(--violet)' : 'var(--emerald)',
                padding: '2px 7px', borderRadius: 100,
              }}>
                {isGift ? 'GIFT' : 'SALE'}
              </span>
            </div>
            {sale.set_name && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>{sale.set_name}</p>
            )}
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>{formatDate(sale.date_sold)}</p>
          </div>
        </div>

        {/* Financials */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {!isGift && (
            <StatCard label="Sale Price" value={formatPrice(sale.sold_price)} color="var(--gold)" />
          )}
          <StatCard label="Cost Basis" value={formatPrice(sale.cost_basis)} />
          {sale.fees > 0 && <StatCard label="Fees" value={formatPrice(sale.fees)} />}
          {sale.shipping > 0 && <StatCard label="Shipping" value={formatPrice(sale.shipping)} />}
        </div>

        {/* Net profit big display */}
        <div style={{
          padding: '16px', borderRadius: 12, textAlign: 'center',
          background: sale.net_profit >= 0 ? 'rgba(69,219,141,0.08)' : 'rgba(242,69,96,0.08)',
          border: `1px solid ${sale.net_profit >= 0 ? 'rgba(69,219,141,0.20)' : 'rgba(242,69,96,0.20)'}`,
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            Net {isGift ? 'Cost' : 'Profit'}
          </p>
          <p style={{ margin: 0, fontSize: 34, fontWeight: 900, color: sale.net_profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
            {sale.net_profit >= 0 ? '+' : ''}{formatPrice(sale.net_profit)}
          </p>
          {!isGift && sale.cost_basis > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>
              {((sale.net_profit / sale.cost_basis) * 100).toFixed(1)}% return
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function StatCard({ label, value, color = 'var(--text)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color }}>{value}</p>
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
