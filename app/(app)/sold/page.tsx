'use client'
import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue, unrealizedProfit } from '@/types'
import { formatPrice, formatDate } from '@/lib/utils'
import type { PokemonCard, SaleRecord } from '@/types'

type Tab = 'buy' | 'sell' | 'trade'
const TABS: Tab[] = ['buy', 'sell', 'trade']
const TAB_LABELS: Record<Tab, string> = { buy: 'BUY', sell: 'SELL', trade: 'TRADE' }

export default function LedgerPage() {
  const { cards, sales, loading } = useCollection()
  const [tab, setTab] = useState<Tab>('buy')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; w: number } | null>(null)

  useLayoutEffect(() => {
    const idx = TABS.indexOf(tab)
    const tabEl = tabRefs.current[idx]
    const container = containerRef.current
    if (!tabEl || !container) return
    const cr = container.getBoundingClientRect()
    const tr = tabEl.getBoundingClientRect()
    setPill({ left: tr.left - cr.left, w: tr.width })
  }, [tab])
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const ownedCards = useMemo(() =>
    cards
      .filter(c => c.status === 'owned' || c.status === 'for_sale')
      .sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()),
    [cards]
  )

  const sellHistory = useMemo(() =>
    sales
      .filter(s => s.sale_type === 'sale' || !s.sale_type)
      .sort((a, b) => new Date(b.date_sold).getTime() - new Date(a.date_sold).getTime()),
    [sales]
  )

  const tradeHistory = useMemo(() =>
    sales
      .filter(s => s.sale_type === 'gift' || s.sale_type === 'trade')
      .sort((a, b) => new Date(b.date_sold).getTime() - new Date(a.date_sold).getTime()),
    [sales]
  )

  const buyStats = useMemo(() => {
    const withPrice = ownedCards.filter(c => c.price_paid != null)
    return {
      count: ownedCards.length,
      tracked: withPrice.length,
      invested: withPrice.reduce((s, c) => s + (c.price_paid ?? 0), 0),
      avgPrice: withPrice.length > 0 ? withPrice.reduce((s, c) => s + (c.price_paid ?? 0), 0) / withPrice.length : 0,
    }
  }, [ownedCards])

  const sellStats = useMemo(() => ({
    count: sellHistory.length,
    profit: sellHistory.reduce((s, r) => s + r.net_profit, 0),
    revenue: sellHistory.reduce((s, r) => s + r.sold_price, 0),
    best: sellHistory.length > 0
      ? sellHistory.reduce((best, r) => r.net_profit > best.net_profit ? r : best)
      : null,
  }), [sellHistory])

  const tradeStats = useMemo(() => ({
    count: tradeHistory.length,
    costBasis: tradeHistory.reduce((s, r) => s + r.cost_basis, 0),
  }), [tradeHistory])

  const selectedSale = selectedSaleId ? (sales.find(s => s.id === selectedSaleId) ?? null) : null
  const selectedCard = selectedCardId ? (cards.find(c => c.id === selectedCardId) ?? null) : null

  if (loading) return <LoadingSkeleton />

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight section-enter" style={{ animationDelay: '0ms' }}>
        LEDGER
      </h1>

      {/* 3-pill tab switcher — same spring pill as nav bar */}
      <div ref={containerRef} className="section-enter" style={{
        animationDelay: '40ms',
        position: 'relative',
        display: 'flex', padding: 4,
        borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        {/* Animated gold pill */}
        {pill && (
          <div style={{
            position: 'absolute',
            left: pill.left,
            top: 4,
            width: pill.w,
            height: 'calc(100% - 8px)',
            borderRadius: 13,
            background: 'var(--gold)',
            pointerEvents: 'none',
            zIndex: 0,
            transition: 'left 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }} />
        )}
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={el => { tabRefs.current[i] = el }}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 13,
              fontSize: 11, fontWeight: 900, letterSpacing: '0.1em',
              background: 'transparent',
              color: tab === t ? '#0D0F1A' : 'var(--text2)',
              border: 'none', cursor: 'pointer',
              position: 'relative', zIndex: 1,
              transition: 'color 0.22s ease',
            }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="section-enter" style={{ animationDelay: '80ms' }}>
        {tab === 'buy' && (
          <div className="grid grid-cols-3 gap-3">
            <MiniStatCard label="In Portfolio" value={String(buyStats.count)} />
            <MiniStatCard label="Total Invested" value={formatPrice(buyStats.invested)} color="var(--gold)" />
            <MiniStatCard label="Avg Price" value={formatPrice(buyStats.avgPrice)} />
          </div>
        )}
        {tab === 'sell' && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <MiniStatCard label="Cards Sold" value={String(sellStats.count)} />
              <MiniStatCard
                label="Net Profit"
                value={`${sellStats.profit >= 0 ? '+' : ''}${formatPrice(sellStats.profit)}`}
                color={sellStats.profit >= 0 ? 'var(--emerald)' : 'var(--crimson)'}
              />
              <MiniStatCard label="Revenue" value={formatPrice(sellStats.revenue)} color="var(--gold)" />
            </div>
            {sellStats.best && (
              <div className="surface-card p-3 flex items-center gap-3">
                <div style={{ fontSize: 18 }}>🏆</div>
                <div className="flex-1 min-w-0">
                  <p className="section-label">BEST SALE</p>
                  <p className="font-bold text-sm truncate">{sellStats.best.card_name}</p>
                </div>
                <span className="font-extrabold text-base" style={{ color: 'var(--emerald)', flexShrink: 0 }}>
                  +{formatPrice(sellStats.best.net_profit)}
                </span>
              </div>
            )}
          </div>
        )}
        {tab === 'trade' && (
          <div className="grid grid-cols-2 gap-3">
            <MiniStatCard label="Cards Traded / Gifted" value={String(tradeStats.count)} />
            <MiniStatCard label="Cost Given Away" value={formatPrice(tradeStats.costBasis)} color="var(--crimson)" />
          </div>
        )}
      </div>

      {/* Row list */}
      <div className="section-enter space-y-2" style={{ animationDelay: '130ms' }}>
        {tab === 'buy' && (
          ownedCards.length === 0 ? (
            <EmptyState text="No cards in your portfolio yet. Add cards from the FIND tab." />
          ) : (
            ownedCards.map((card, i) => (
              <div key={card.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <BuyRow card={card} onClick={() => setSelectedCardId(card.id)} />
              </div>
            ))
          )
        )}
        {tab === 'sell' && (
          sellHistory.length === 0 ? (
            <EmptyState text="No sales yet. Use SELL on any owned card to log a sale." />
          ) : (
            sellHistory.map((sale, i) => (
              <div key={sale.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <SellRow sale={sale} onClick={() => setSelectedSaleId(sale.id)} />
              </div>
            ))
          )
        )}
        {tab === 'trade' && (
          tradeHistory.length === 0 ? (
            <EmptyState text="No trades or gifts yet. Use GIFT or TRADE on any owned card." />
          ) : (
            tradeHistory.map((sale, i) => (
              <div key={sale.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <TradeRow sale={sale} onClick={() => setSelectedSaleId(sale.id)} />
              </div>
            ))
          )
        )}
      </div>

      {selectedSale && <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSaleId(null)} />}
      {selectedCard && <BuyDetailModal card={selectedCard} onClose={() => setSelectedCardId(null)} />}
    </div>
  )
}

// ─── BUY row ──────────────────────────────────────────────────────────────────

function BuyRow({ card, onClick }: { card: PokemonCard; onClick: () => void }) {
  const gain = card.price_paid != null && card.market_price != null
    ? unrealizedProfit(card) : null

  return (
    <div onClick={onClick} className="surface-card surface-card-interactive p-3 flex items-center gap-3">
      <div style={{ width: 44, height: 62, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
        {card.image_sm && <Image src={card.image_sm} alt={card.name} fill className="object-cover" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="font-bold text-sm truncate">{card.name}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text3)' }}>
          {card.set_name}{card.set_number ? ` · #${card.set_number}` : ''} · {card.condition}
          {card.language && card.language !== 'EN' ? ` · ${card.language}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          {card.bought_from && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>from {card.bought_from}</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatDate(card.date_added)}</span>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {card.price_paid != null ? (
          <>
            <p className="font-extrabold text-sm" style={{ color: 'var(--gold)' }}>{formatPrice(card.price_paid)}</p>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>paid</p>
          </>
        ) : (
          <p style={{ fontSize: 10, color: 'var(--text3)' }}>—</p>
        )}
        {gain != null && (
          <p style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: gain >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
            {gain >= 0 ? '+' : ''}{formatPrice(gain)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── SELL row ─────────────────────────────────────────────────────────────────

function SellRow({ sale, onClick }: { sale: SaleRecord; onClick: () => void }) {
  return (
    <div onClick={onClick} className="surface-card surface-card-interactive p-3 flex items-center gap-3">
      <div style={{ width: 44, height: 62, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
        {sale.image_sm && <Image src={sale.image_sm} alt={sale.card_name} fill className="object-cover" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="font-bold text-sm truncate">{sale.card_name}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text3)' }}>
          {sale.set_name} · {formatDate(sale.date_sold)}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>sold {formatPrice(sale.sold_price)}</span>
          {sale.cost_basis > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>basis {formatPrice(sale.cost_basis)}</span>
          )}
          {(sale.fees + sale.shipping) > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>fees {formatPrice(sale.fees + sale.shipping)}</span>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p className="font-extrabold text-sm" style={{ color: sale.net_profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
          {sale.net_profit >= 0 ? '+' : ''}{formatPrice(sale.net_profit)}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>net</p>
        {sale.cost_basis > 0 && (
          <p style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: sale.net_profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
            {((sale.net_profit / sale.cost_basis) * 100).toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  )
}

// ─── TRADE row ────────────────────────────────────────────────────────────────

function TradeRow({ sale, onClick }: { sale: SaleRecord; onClick: () => void }) {
  const isTrade = sale.sale_type === 'trade'
  return (
    <div onClick={onClick} className="surface-card surface-card-interactive p-3 flex items-center gap-3">
      <div style={{ width: 44, height: 62, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
        {sale.image_sm && <Image src={sale.image_sm} alt={sale.card_name} fill className="object-cover" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p className="font-bold text-sm truncate">{sale.card_name}</p>
          <span style={{
            fontSize: 8, fontWeight: 900, color: '#fff',
            background: isTrade ? 'var(--sky)' : 'var(--violet)',
            padding: '1px 6px', borderRadius: 100, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {isTrade ? 'TRADE' : 'GIFT'}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text3)' }}>
          {sale.set_name} · {formatDate(sale.date_sold)}
        </p>
        {(sale.fees + sale.shipping) > 0 && (
          <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
            fees {formatPrice(sale.fees + sale.shipping)}
          </p>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p className="font-extrabold text-sm" style={{ color: 'var(--crimson)' }}>
          -{formatPrice(sale.cost_basis + sale.fees + sale.shipping)}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>cost</p>
      </div>
    </div>
  )
}

// ─── Detail modals ────────────────────────────────────────────────────────────

function BuyDetailModal({ card, onClose }: { card: PokemonCard; onClose: () => void }) {
  const gain = card.price_paid != null ? unrealizedProfit(card) : null
  const gainPct = card.price_paid && card.price_paid > 0 && gain != null
    ? (gain / card.price_paid) * 100 : null

  return (
    <Modal open onClose={onClose} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {card.image_sm && (
            <div style={{ position: 'relative', width: 68, height: 95, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
              <Image src={card.image_sm} alt={card.name} fill className="object-cover" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{card.name}</h2>
            {card.set_name && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>{card.set_name}{card.set_number ? ` · #${card.set_number}` : ''}</p>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <DetailStat label="Condition" value={card.condition} />
          {card.language ? <DetailStat label="Language" value={card.language} /> : null}
          {card.price_paid != null ? <DetailStat label="Price Paid" value={formatPrice(card.price_paid)} color="var(--gold)" /> : null}
          {card.market_price != null ? <DetailStat label="Market Now" value={formatPrice(card.market_price)} /> : null}
          {card.bought_from ? <DetailStat label="Bought From" value={card.bought_from} /> : null}
          <DetailStat label="Date Added" value={formatDate(card.date_added)} />
          {card.market_at_buy != null ? <DetailStat label="Mkt at Buy" value={formatPrice(card.market_at_buy)} /> : null}
        </div>

        {gain != null && (
          <div style={{
            padding: '14px', borderRadius: 12, textAlign: 'center',
            background: gain >= 0 ? 'rgba(69,219,141,0.08)' : 'rgba(242,69,96,0.08)',
            border: `1px solid ${gain >= 0 ? 'rgba(69,219,141,0.20)' : 'rgba(242,69,96,0.20)'}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Unrealized Gain
            </p>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: gain >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
              {gain >= 0 ? '+' : ''}{formatPrice(gain)}
            </p>
            {gainPct != null && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>
                {gainPct.toFixed(1)}% return on cost
              </p>
            )}
          </div>
        )}

        {card.notes && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>Notes</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{card.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function SaleDetailModal({ sale, onClose }: { sale: SaleRecord; onClose: () => void }) {
  const isTrade = sale.sale_type === 'trade'
  const isGift = sale.sale_type === 'gift'
  const label = isTrade ? 'TRADE' : isGift ? 'GIFT' : 'SALE'
  const labelColor = isTrade ? 'var(--sky)' : isGift ? 'var(--violet)' : 'var(--emerald)'

  return (
    <Modal open onClose={onClose} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {sale.image_sm && (
            <div style={{ position: 'relative', width: 68, height: 95, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
              <Image src={sale.image_sm} alt={sale.card_name} fill className="object-cover" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{sale.card_name}</h2>
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.05em', color: '#fff', background: labelColor, padding: '2px 7px', borderRadius: 100 }}>
                {label}
              </span>
            </div>
            {sale.set_name && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>{sale.set_name}</p>}
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>{formatDate(sale.date_sold)}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {!isGift && !isTrade && <DetailStat label="Sale Price" value={formatPrice(sale.sold_price)} color="var(--gold)" />}
          <DetailStat label="Cost Basis" value={formatPrice(sale.cost_basis)} />
          {sale.fees > 0 && <DetailStat label="Fees" value={formatPrice(sale.fees)} />}
          {sale.shipping > 0 && <DetailStat label="Shipping" value={formatPrice(sale.shipping)} />}
        </div>

        <div style={{
          padding: '16px', borderRadius: 12, textAlign: 'center',
          background: sale.net_profit >= 0 && !isGift && !isTrade ? 'rgba(69,219,141,0.08)' : 'rgba(242,69,96,0.08)',
          border: `1px solid ${sale.net_profit >= 0 && !isGift && !isTrade ? 'rgba(69,219,141,0.20)' : 'rgba(242,69,96,0.20)'}`,
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {isGift || isTrade ? 'Total Cost' : 'Net Profit'}
          </p>
          <p style={{ margin: 0, fontSize: 34, fontWeight: 900, color: isGift || isTrade ? 'var(--crimson)' : sale.net_profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
            {isGift || isTrade ? '-' : sale.net_profit >= 0 ? '+' : ''}{formatPrice(Math.abs(sale.net_profit))}
          </p>
          {!isGift && !isTrade && sale.cost_basis > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>
              {((sale.net_profit / sale.cost_basis) * 100).toFixed(1)}% return
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MiniStatCard({ label, value, color = 'var(--text)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color }}>{value}</p>
    </div>
  )
}

function DetailStat({ label, value, color = 'var(--text)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color }}>{value}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="surface-card p-8 text-center">
      <p className="text-sm" style={{ color: 'var(--text3)' }}>{text}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <div className="h-8 w-28 rounded-xl img-skeleton" />
      <div className="h-12 rounded-2xl img-skeleton" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl img-skeleton" />)}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl img-skeleton" />
      ))}
    </div>
  )
}
