'use client'
import { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import { CardDetailModal } from '@/components/cards/CardDetailModal'
import { useCollection } from '@/components/CollectionContext'
import { unrealizedProfit } from '@/types'
import { formatPrice, formatDate } from '@/lib/utils'
import type { PokemonCard, SaleRecord } from '@/types'

type Tab = 'buy' | 'sell' | 'trade'
const TABS: Tab[] = ['buy', 'sell', 'trade']
const TAB_LABELS: Record<Tab, string> = { buy: 'BUY', sell: 'SELL', trade: 'TRADE' }

type BuySort = 'newest' | 'oldest' | 'value' | 'paid' | 'alpha'
type SellSort = 'newest' | 'profit' | 'revenue' | 'alpha'
type TradeSort = 'newest' | 'alpha'

const BUY_SORTS: { key: BuySort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'value',  label: 'Value'  },
  { key: 'paid',   label: 'Paid'   },
  { key: 'alpha',  label: 'A–Z'    },
]
const SELL_SORTS: { key: SellSort; label: string }[] = [
  { key: 'newest',  label: 'Newest'  },
  { key: 'profit',  label: 'Profit'  },
  { key: 'revenue', label: 'Revenue' },
  { key: 'alpha',   label: 'A–Z'     },
]
const TRADE_SORTS: { key: TradeSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'alpha',  label: 'A–Z'    },
]

const REVEAL_W = 160
const SNAP_THRESHOLD = REVEAL_W * 0.4
const RESISTANCE = 0.85

function haptic(style: 'medium' | 'light') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(style === 'medium' ? 12 : 6)
  }
}

export default function LedgerPage() {
  const { cards, sales, loading } = useCollection()
  const [tab, setTab] = useState<Tab>('buy')
  const [search, setSearch] = useState('')
  const [buySort, setBuySort] = useState<BuySort>('newest')
  const [sellSort, setSellSort] = useState<SellSort>('newest')
  const [tradeSort, setTradeSort] = useState<TradeSort>('newest')

  // Spring pill
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; w: number } | null>(null)

  // Swipe + modal state
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [actionCard, setActionCard] = useState<{ card: PokemonCard; mode: 'sell' | 'gift' } | null>(null)
  const [confirmFav, setConfirmFav] = useState<{ card: PokemonCard; mode: 'sell' | 'gift' } | null>(null)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  useEffect(() => { setSearch(''); setSwipedId(null) }, [tab])

  useLayoutEffect(() => {
    const idx = TABS.indexOf(tab)
    const tabEl = tabRefs.current[idx]
    const container = containerRef.current
    if (!tabEl || !container) return
    const cr = container.getBoundingClientRect()
    const tr = tabEl.getBoundingClientRect()
    setPill({ left: tr.left - cr.left, w: tr.width })
  }, [tab])

  // ── Full (unfiltered) data for stats ────────────────────────────────────────
  const allOwned = useMemo(
    () => cards.filter(c => c.status === 'owned' || c.status === 'for_sale'),
    [cards]
  )
  const allSells = useMemo(
    () => sales.filter(s => s.sale_type === 'sale' || !s.sale_type),
    [sales]
  )
  const allTrades = useMemo(
    () => sales.filter(s => s.sale_type === 'gift' || s.sale_type === 'trade'),
    [sales]
  )

  // ── Filtered + sorted display lists ─────────────────────────────────────────
  const ownedCards = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? allOwned.filter(c => c.name.toLowerCase().includes(q) || c.set_name.toLowerCase().includes(q))
      : allOwned
    const sorters: Record<BuySort, (a: PokemonCard, b: PokemonCard) => number> = {
      newest: (a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime(),
      oldest: (a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime(),
      value:  (a, b) => (b.market_price ?? 0) - (a.market_price ?? 0),
      paid:   (a, b) => (b.price_paid ?? 0) - (a.price_paid ?? 0),
      alpha:  (a, b) => a.name.localeCompare(b.name),
    }
    return [...filtered].sort(sorters[buySort])
  }, [allOwned, search, buySort])

  const sellHistory = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? allSells.filter(s => s.card_name.toLowerCase().includes(q) || (s.set_name ?? '').toLowerCase().includes(q))
      : allSells
    const sorters: Record<SellSort, (a: SaleRecord, b: SaleRecord) => number> = {
      newest:  (a, b) => new Date(b.date_sold).getTime() - new Date(a.date_sold).getTime(),
      profit:  (a, b) => b.net_profit - a.net_profit,
      revenue: (a, b) => b.sold_price - a.sold_price,
      alpha:   (a, b) => a.card_name.localeCompare(b.card_name),
    }
    return [...filtered].sort(sorters[sellSort])
  }, [allSells, search, sellSort])

  const tradeHistory = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? allTrades.filter(s => s.card_name.toLowerCase().includes(q) || (s.set_name ?? '').toLowerCase().includes(q))
      : allTrades
    const sorters: Record<TradeSort, (a: SaleRecord, b: SaleRecord) => number> = {
      newest: (a, b) => new Date(b.date_sold).getTime() - new Date(a.date_sold).getTime(),
      alpha:  (a, b) => a.card_name.localeCompare(b.card_name),
    }
    return [...filtered].sort(sorters[tradeSort])
  }, [allTrades, search, tradeSort])

  // ── Stats (always full-set data) ─────────────────────────────────────────────
  const buyStats = useMemo(() => {
    const withPrice = allOwned.filter(c => c.price_paid != null)
    return {
      count: allOwned.length,
      invested: withPrice.reduce((s, c) => s + (c.price_paid ?? 0), 0),
      avgPrice: withPrice.length > 0
        ? withPrice.reduce((s, c) => s + (c.price_paid ?? 0), 0) / withPrice.length
        : 0,
    }
  }, [allOwned])

  const sellStats = useMemo(() => ({
    count: allSells.length,
    profit: allSells.reduce((s, r) => s + r.net_profit, 0),
    revenue: allSells.reduce((s, r) => s + r.sold_price, 0),
    best: allSells.length > 0
      ? allSells.reduce((best, r) => r.net_profit > best.net_profit ? r : best)
      : null,
  }), [allSells])

  const tradeStats = useMemo(() => ({
    count: allTrades.length,
    costBasis: allTrades.reduce((s, r) => s + r.cost_basis, 0),
  }), [allTrades])

  // ── Action handlers ──────────────────────────────────────────────────────────
  const handleSell = useCallback((card: PokemonCard) => {
    setSwipedId(null)
    if (card.is_favorite) setConfirmFav({ card, mode: 'sell' })
    else setActionCard({ card, mode: 'sell' })
  }, [])

  const handleGift = useCallback((card: PokemonCard) => {
    setSwipedId(null)
    if (card.is_favorite) setConfirmFav({ card, mode: 'gift' })
    else setActionCard({ card, mode: 'gift' })
  }, [])

  const selectedSale = selectedSaleId ? (sales.find(s => s.id === selectedSaleId) ?? null) : null
  const selectedCard = selectedCardId ? (cards.find(c => c.id === selectedCardId) ?? null) : null

  if (loading) return <LoadingSkeleton />

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight section-enter" style={{ animationDelay: '0ms' }}>
        LEDGER
      </h1>

      {/* Spring pill tab switcher */}
      <div ref={containerRef} className="section-enter" style={{
        animationDelay: '40ms',
        position: 'relative', display: 'flex', padding: 4,
        borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        {pill && (
          <div style={{
            position: 'absolute', left: pill.left, top: 4,
            width: pill.w, height: 'calc(100% - 8px)',
            borderRadius: 13, background: 'var(--gold)',
            pointerEvents: 'none', zIndex: 0,
            transition: 'left 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }} />
        )}
        {TABS.map((t, i) => (
          <button key={t} ref={el => { tabRefs.current[i] = el }} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', borderRadius: 13,
            fontSize: 11, fontWeight: 900, letterSpacing: '0.1em',
            background: 'transparent', color: tab === t ? '#0D0F1A' : 'var(--text2)',
            border: 'none', cursor: 'pointer', position: 'relative', zIndex: 1,
            transition: 'color 0.22s ease',
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="section-enter" style={{ animationDelay: '70ms', position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          fontSize: 13, color: 'var(--text3)', pointerEvents: 'none',
        }}>
          &#128269;
        </span>
        <input
          type="text"
          placeholder={`Search ${tab === 'buy' ? 'cards' : tab === 'sell' ? 'sales' : 'trades'}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '11px 36px 11px 34px',
            borderRadius: 14, fontSize: 14, outline: 'none',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', boxSizing: 'border-box',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 18, lineHeight: 1, padding: '0 2px',
          }}>
            ×
          </button>
        )}
      </div>

      {/* Sort chips */}
      <div className="section-enter" style={{
        animationDelay: '90ms',
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none',
      } as React.CSSProperties}>
        {tab === 'buy' && BUY_SORTS.map(({ key, label }) => (
          <button key={key} onClick={() => setBuySort(key)}
            className={`chip flex-shrink-0 ${buySort === key ? 'chip-active' : 'chip-default'}`}>
            {label}
          </button>
        ))}
        {tab === 'sell' && SELL_SORTS.map(({ key, label }) => (
          <button key={key} onClick={() => setSellSort(key)}
            className={`chip flex-shrink-0 ${sellSort === key ? 'chip-active' : 'chip-default'}`}>
            {label}
          </button>
        ))}
        {tab === 'trade' && TRADE_SORTS.map(({ key, label }) => (
          <button key={key} onClick={() => setTradeSort(key)}
            className={`chip flex-shrink-0 ${tradeSort === key ? 'chip-active' : 'chip-default'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="section-enter" style={{ animationDelay: '110ms' }}>
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
                <div style={{ fontSize: 18 }}>&#127942;</div>
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
            <MiniStatCard label="Traded / Gifted" value={String(tradeStats.count)} />
            <MiniStatCard label="Cost Given Away" value={formatPrice(tradeStats.costBasis)} color="var(--crimson)" />
          </div>
        )}
      </div>

      {/* Row list */}
      <div className="section-enter space-y-2" style={{ animationDelay: '150ms' }}>
        {tab === 'buy' && (
          ownedCards.length === 0 ? (
            <EmptyState text={search
              ? `No cards matching “${search}”.`
              : 'No cards in your portfolio yet. Add cards from the FIND tab.'} />
          ) : (
            ownedCards.map((card, i) => (
              <div key={card.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <SwipeRow
                  card={card}
                  isOpen={swipedId === card.id}
                  onOpen={() => setSwipedId(card.id)}
                  onClose={() => setSwipedId(null)}
                  onSell={() => handleSell(card)}
                  onGift={() => handleGift(card)}
                  onView={() => setSelectedCardId(card.id)}
                />
              </div>
            ))
          )
        )}
        {tab === 'sell' && (
          sellHistory.length === 0 ? (
            <EmptyState text={search
              ? `No sales matching “${search}”.`
              : 'No sales yet. Use SELL on any owned card to log a sale.'} />
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
            <EmptyState text={search
              ? `No trades matching “${search}”.`
              : 'No trades or gifts yet. Use GIFT or TRADE on any owned card.'} />
          ) : (
            tradeHistory.map((sale, i) => (
              <div key={sale.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <TradeRow sale={sale} onClick={() => setSelectedSaleId(sale.id)} />
              </div>
            ))
          )
        )}
      </div>

      {/* Favorite confirmation */}
      {confirmFav && (
        <Modal open onClose={() => setConfirmFav(null)} maxWidth={320}>
          <div style={{ textAlign: 'center', padding: '4px 0 0' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>&#11088;</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>This card is a favorite</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text)' }}>{confirmFav.card.name}</strong> is in your
              favorites. Are you sure you want to {confirmFav.mode} it?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmFav(null)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'var(--surface)', color: 'var(--text)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}>
                Keep it
              </button>
              <button
                onClick={() => {
                  setActionCard({ card: confirmFav.card, mode: confirmFav.mode })
                  setConfirmFav(null)
                }}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: confirmFav.mode === 'sell' ? 'var(--btn-sell)' : 'var(--btn-wishlist)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                }}>
                {confirmFav.mode === 'sell' ? 'Yes, Sell' : 'Yes, Gift'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Sell / Trade action modal */}
      {actionCard && (
        <CardDetailModal
          card={actionCard.card}
          initialView={actionCard.mode}
          onClose={() => setActionCard(null)}
        />
      )}

      {/* Tap-anywhere-to-close backdrop when a row is swiped open */}
      {swipedId && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 5 }}
          onClick={() => setSwipedId(null)}
        />
      )}

      {selectedSale && <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSaleId(null)} />}
      {selectedCard && <BuyDetailModal card={selectedCard} onClose={() => setSelectedCardId(null)} />}
    </div>
  )
}

// ─── Swipe-to-reveal BUY row ──────────────────────────────────────────────────

function SwipeRow({
  card, isOpen, onOpen, onClose, onSell, onGift, onView,
}: {
  card: PokemonCard
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onSell: () => void
  onGift: () => void
  onView: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragX, setDragX] = useState(0)

  const isOpenRef = useRef(isOpen)
  const cbRef = useRef({ onOpen, onClose })
  // Tracks whether the pointer moved enough to be a real drag — suppresses the
  // click event that always fires after mouseup/touchend on the same element.
  const didDragRef = useRef(false)
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])
  useEffect(() => { cbRef.current = { onOpen, onClose } }, [onOpen, onClose])
  useEffect(() => { setDragX(0); setDragging(false) }, [isOpen])

  useEffect(() => {
    const el = rowRef.current
    if (!el) return

    // ── Touch (direction-aware so vertical page scroll still works) ───────────
    let tStartX = 0, tStartY = 0, tDecided = false, tHoriz = false

    function onTouchStart(e: TouchEvent) {
      tStartX = e.touches[0].clientX
      tStartY = e.touches[0].clientY
      tDecided = false; tHoriz = false
      didDragRef.current = false
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - tStartX
      const dy = e.touches[0].clientY - tStartY
      if (!tDecided) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        tHoriz = Math.abs(dx) > Math.abs(dy)
        tDecided = true
      }
      if (!tHoriz) return
      e.preventDefault()
      didDragRef.current = true
      const base = isOpenRef.current ? -REVEAL_W : 0
      setDragX(Math.max(-REVEAL_W, Math.min(0, base + dx * RESISTANCE)))
      setDragging(true)
    }

    function onTouchEnd(e: TouchEvent) {
      setDragging(false)
      setDragX(0)
      if (!tDecided || !tHoriz) return
      const dx = e.changedTouches[0].clientX - tStartX
      if (isOpenRef.current) {
        if (dx > SNAP_THRESHOLD) { haptic('light'); cbRef.current.onClose() }
      } else {
        if (dx < -SNAP_THRESHOLD) { haptic('medium'); cbRef.current.onOpen() }
      }
    }

    // ── Mouse (completely separate state — never corrupts touch in progress) ──
    let mActive = false, mStartX = 0

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      mActive = true
      mStartX = e.clientX
      didDragRef.current = false
    }

    function onMouseMove(e: MouseEvent) {
      if (!mActive) return
      const dx = e.clientX - mStartX
      if (Math.abs(dx) < 4) return
      didDragRef.current = true
      const base = isOpenRef.current ? -REVEAL_W : 0
      setDragX(Math.max(-REVEAL_W, Math.min(0, base + dx * RESISTANCE)))
      setDragging(true)
    }

    function onMouseUp(e: MouseEvent) {
      if (!mActive) return
      mActive = false
      setDragging(false)
      setDragX(0)
      if (!didDragRef.current) return
      const dx = e.clientX - mStartX
      if (isOpenRef.current) {
        if (dx > SNAP_THRESHOLD) { haptic('light'); cbRef.current.onClose() }
      } else {
        if (dx < -SNAP_THRESHOLD) { haptic('medium'); cbRef.current.onOpen() }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const translateX = dragging ? dragX : isOpen ? -REVEAL_W : 0
  // Overshoot spring — overflow:hidden clips the excess so the bounce looks like
  // hitting a wall and springing back, not flying off-screen
  const transition = dragging ? 'none' : 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)'
  const gain = card.price_paid != null && card.market_price != null ? unrealizedProfit(card) : null

  return (
    // background: var(--surface) makes spring overshoot gaps seamless in both directions
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, zIndex: isOpen ? 6 : 'auto', background: 'var(--surface)' }}>

      {/* Full-width layer: surface spacer absorbs overshoot past -REVEAL_W on the left */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 0 }}>
        <div style={{ flex: 1, background: 'var(--surface)' }} />
        <button
          aria-label={`Sell ${card.name}`}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onSell() }}
          style={{
            width: 80, background: 'var(--btn-sell)', color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.06em' }}>SELL</span>
        </button>
        <button
          aria-label={`Gift ${card.name}`}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onGift() }}
          style={{
            width: 80, background: 'var(--btn-wishlist)', color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
            borderRadius: '0 16px 16px 0',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 12 20 22 4 22 4 12"/>
            <rect x="2" y="7" width="20" height="5"/>
            <line x1="12" y1="22" x2="12" y2="7"/>
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.06em' }}>GIFT</span>
        </button>
      </div>

      {/* Sliding card — sits above buttons, fully covers them at rest */}
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        aria-label={`${card.name}, ${card.set_name}${card.price_paid != null ? `, paid ${formatPrice(card.price_paid)}` : ''}`}
        style={{
          transform: `translateX(${translateX}px)`, transition,
          position: 'relative', zIndex: 1, background: 'var(--surface)',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
        onClick={() => {
          // Every mouseup/touchend on this element also fires a click. Swallow it
          // after a real drag so we don't accidentally open the detail modal.
          if (didDragRef.current) { didDragRef.current = false; return }
          isOpen ? onClose() : onView()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? onClose() : onView() }
          if (e.key === 'Escape') onClose()
        }}
      >
        <div className="surface-card p-3 flex items-center gap-3"
          style={{ userSelect: 'none', position: 'relative' }}>

          <div style={{ width: 44, height: 62, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
            {card.image_sm && <Image src={card.image_sm} alt={card.name} fill className="object-cover" />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <p className="font-bold text-sm truncate">{card.name}</p>
              {card.is_favorite && (
                <span style={{ fontSize: 10, flexShrink: 0, color: 'var(--gold)' }}>&#11088;</span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text3)' }}>
              {card.set_name}{card.set_number ? ` · #${card.set_number}` : ''} · {card.condition}
              {card.language && card.language !== 'EN' ? ` · ${card.language}` : ''}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
              {card.bought_from && <span style={{ fontSize: 10, color: 'var(--text3)' }}>from {card.bought_from}</span>}
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatDate(card.date_added)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
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
      <div className="h-10 rounded-2xl img-skeleton" />
      <div className="h-8 rounded-xl img-skeleton" style={{ width: '60%' }} />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl img-skeleton" />)}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl img-skeleton" />
      ))}
    </div>
  )
}
