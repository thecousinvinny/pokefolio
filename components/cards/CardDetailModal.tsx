'use client'
import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Sparkline } from '@/components/ui/Sparkline'
import { CardArtwork } from '@/components/cards/CardArtwork'
import { TcgLink } from '@/components/ui/TcgLink'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, formatDate, generatePriceHistory, tcgSearchUrl } from '@/lib/utils'
import { conditionAdjustedValue, CONDITION_ORDER, CONDITION_LABELS, CONDITION_MULTIPLIERS } from '@/types'
import { rarityColor, shortRarity } from '@/components/cards/CardTile'
import { MoveToPortfolioModal } from '@/components/cards/MoveToPortfolioModal'
import { EditCardModal } from '@/components/cards/EditCardModal'
import type { PokemonCard } from '@/types'

function isHoloRarity(rarity?: string | null): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return r.includes('holo') || r.includes('ultra') || r.includes('secret') ||
    r.includes('special') || r.includes('vmax') || r.includes('vstar') ||
    r.includes('double rare') || r.includes('rare ultra') ||
    r.includes('shiny') || r.includes('ace spec') ||
    r.includes('illustration') || r.includes('hyper') || r.includes('rainbow')
}

function formatSetDate(raw?: string | null): string {
  if (!raw) return ''
  const d = new Date(raw.replace(/\//g, '-'))
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface CardDetailModalProps {
  card: PokemonCard | null
  onClose: () => void
  initialView?: 'detail' | 'sell' | 'gift' | 'trade'
  view?: 'portfolio' | 'wishlist'
}

export function CardDetailModal({ card, onClose, initialView = 'detail', view = 'portfolio' }: CardDetailModalProps) {
  const { updateCard, removeCard } = useCollection()
  const [condition, setCondition] = useState<number>(
    card ? CONDITION_ORDER.indexOf(card.condition) : 0
  )
  const [showSell, setShowSell] = useState(initialView === 'sell')
  const [showGift, setShowGift] = useState(initialView === 'gift')
  const [showTrade, setShowTrade] = useState(initialView === 'trade')
  const [showMove, setShowMove] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [editingTarget, setEditingTarget] = useState(false)
  const [editTarget, setEditTarget] = useState('')

  const priceHistory = useMemo(
    () => card?.market_price ? generatePriceHistory(card.market_price) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id]
  )

  if (!card) return null

  const currentCondition = CONDITION_ORDER[condition]
  const adjValue = (card.market_price ?? 0) * CONDITION_MULTIPLIERS[currentCondition]
  const profit = card.price_paid != null ? adjValue - card.price_paid : null
  const profitPct = profit != null && card.price_paid ? (profit / card.price_paid) * 100 : null
  const locked = card.is_favorite || card.is_showcase

  const wlDelta = view === 'wishlist' && card.market_price != null && card.market_at_buy != null
    ? ((card.market_price - card.market_at_buy) / card.market_at_buy) * 100
    : null
  const atTarget = card.target_price != null && card.market_price != null
    && card.market_price <= card.target_price

  const setRef = [
    card.set_number
      ? `#${card.set_number}${card.set_printed_total ? `/${card.set_printed_total}` : ''}`
      : null,
    card.set_release_date ? formatSetDate(card.set_release_date) : null,
  ].filter(Boolean).join(' · ')

  const rc = rarityColor(card.rarity)
  const isRcAccent = !rc.startsWith('rgba')

  const sparkColor = view === 'wishlist'
    ? (atTarget ? 'var(--emerald)' : 'var(--violet)')
    : profit == null ? 'var(--emerald)' : profit >= 0 ? 'var(--emerald)' : 'var(--crimson)'

  async function handleConditionChange(idx: number) {
    setCondition(idx)
    await updateCard(card!.id, { condition: CONDITION_ORDER[idx] })
  }
  function handleToWatch() { updateCard(card!.id, { status: 'wishlist' }); onClose() }
  function handleRemove() { removeCard(card!.id); onClose() }
  function startEditTarget() {
    setEditTarget(card!.target_price != null ? String(card!.target_price) : '')
    setEditingTarget(true)
  }
  function saveTarget() {
    updateCard(card!.id, { target_price: editTarget ? parseFloat(editTarget) : undefined })
    setEditingTarget(false)
  }

  return (
    <>
      <Modal open={!!card && !showSell && !showGift && !showTrade && !showMove && !showEdit} onClose={onClose} maxWidth={520}>
        <div style={{ position: 'relative' }}>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: -4, right: -4,
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.07)', border: 'none',
              color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s, color 0.12s', zIndex: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text3)' }}>
            ✕
          </button>

          {/* ── TOP: card image + identity ── */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>

            {/* Card art */}
            <div
              className={card.is_showcase ? 'showcase-border' : ''}
              style={{
                width: 120, flexShrink: 0,
                borderRadius: 10, overflow: 'hidden',
                position: 'relative', paddingTop: `${120 * 1.39}px`,
                boxShadow: card.is_favorite && !card.is_showcase
                  ? '0 0 0 2px rgba(255,200,69,0.55), 0 0 20px rgba(255,200,69,0.20), 0 6px 24px rgba(0,0,0,0.50)'
                  : '0 6px 24px rgba(0,0,0,0.50)',
              }}>
              <CardArtwork
                types={card.types}
                imageUrl={card.image_lg ?? card.image_sm ?? undefined}
                imageAlt={card.name}
                isHolo={isHoloRarity(card.rarity)}
              />
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <h2 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 800, lineHeight: 1.2, color: 'var(--text)', paddingRight: 32 }}>
                {card.name}
                {card.language === 'JP' && (
                  <span style={{ marginLeft: 7, fontSize: 8, fontWeight: 900, background: '#E53E3E', color: '#fff', padding: '2px 5px', borderRadius: 4, verticalAlign: 'middle' }}>
                    JP
                  </span>
                )}
              </h2>
              {card.rarity && (
                <span style={{
                  display: 'inline-block', marginBottom: 5,
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
                  color: rc,
                  background: isRcAccent ? `${rc}16` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isRcAccent ? `${rc}30` : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 100, padding: '2px 8px', lineHeight: 1.5,
                }}>
                  {shortRarity(card.rarity)}
                </span>
              )}
              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text3)' }}>
                {card.set_name}{setRef ? ` · ${setRef}` : ''}
              </p>
              {card.artist && (
                <p style={{ margin: '0 0 10px', fontSize: 10, color: 'var(--text3)' }}>
                  Illus. {card.artist}
                </p>
              )}

              {/* Condition (portfolio) or Target at-a-glance (wishlist) */}
              {view === 'portfolio' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                      Condition
                    </span>
                    {card.market_price && (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {CONDITION_LABELS[currentCondition]} · <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatPrice(adjValue)}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {CONDITION_ORDER.map((c, i) => (
                      <button key={c} onClick={() => handleConditionChange(i)} style={{
                        flex: 1, padding: '5px 0', borderRadius: 6,
                        fontSize: 10, fontWeight: 700,
                        border: `1px solid ${i === condition ? 'rgba(255,200,69,0.50)' : 'var(--border)'}`,
                        background: i === condition ? 'linear-gradient(135deg, #F0B820, #C07808)' : 'transparent',
                        color: i === condition ? '#fff' : 'var(--text3)',
                        cursor: 'pointer', transition: 'all 0.12s ease',
                      }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {view === 'wishlist' && card.target_price != null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  background: atTarget ? 'rgba(69,219,141,0.10)' : 'rgba(156,114,250,0.08)',
                  border: `1px solid ${atTarget ? 'rgba(69,219,141,0.22)' : 'rgba(156,114,250,0.20)'}`,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: atTarget ? 'var(--emerald)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Target
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: atTarget ? 'var(--emerald)' : 'var(--violet)' }}>
                    {formatPrice(card.target_price)}
                  </span>
                  {atTarget && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--emerald)' }}>✓ AT TARGET!</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

          {/* ── MARKET VALUE ── */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Market Value
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: view === 'wishlist' && atTarget ? 'var(--emerald)' : 'var(--gold)', lineHeight: 1 }}>
                {card.market_price != null ? formatPrice(card.market_price) : '—'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>NM</span>
              {view === 'wishlist' && atTarget && (
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--emerald)', background: 'rgba(69,219,141,0.12)', border: '1px solid rgba(69,219,141,0.25)', padding: '2px 8px', borderRadius: 100 }}>
                  AT TARGET!
                </span>
              )}
            </div>

            {/* NM Low / Mid / High row — always shown */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {([
                { label: 'NM Low', val: card.market_low },
                { label: 'Mid',    val: card.market_mid },
                { label: 'High',   val: card.market_high },
              ] as { label: string; val: number | null | undefined }[]).map(({ label, val }) => (
                <div key={label}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: val != null ? 'var(--text)' : 'var(--text3)' }}>{val != null ? formatPrice(val) : '—'}</p>
                </div>
              ))}
              {card.market_direct_low != null && (
                <div>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>Direct</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatPrice(card.market_direct_low)}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 30-DAY PRICE HISTORY — always shown ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                30-Day Price
              </span>
              {priceHistory.length > 1 && (
                <span style={{ fontSize: 9, color: 'var(--text3)' }}>
                  {formatPrice(Math.min(...priceHistory))} – {formatPrice(Math.max(...priceHistory))}
                </span>
              )}
            </div>
            {priceHistory.length > 1 ? (
              <Sparkline points={priceHistory} color={sparkColor} height={80} />
            ) : (
              <div style={{ height: 100, borderRadius: 8, background: 'var(--s2)', opacity: 0.4 }} />
            )}
          </div>

          {/* ── CARD LORE ── */}
          {card.flavor_text && (
            <p style={{
              margin: '0 0 16px',
              fontSize: 11.5, lineHeight: 1.65,
              color: 'var(--text3)', fontStyle: 'italic',
              borderLeft: '2px solid var(--border2)', paddingLeft: 10,
            }}>
              "{card.flavor_text}"
            </p>
          )}

          {/* ── MY PURCHASE (portfolio) — always shown ── */}
          {view === 'portfolio' && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                My Purchase
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: profit != null ? 8 : 0 }}>
                <MiniStat label="Paid"       value={card.price_paid != null ? formatPrice(card.price_paid) : '—'} />
                <MiniStat label="Mkt at Buy" value={card.market_at_buy != null ? formatPrice(card.market_at_buy) : '—'} />
                <MiniStat label="From"       value={card.bought_from || '—'} />
                <MiniStat label="Date"       value={card.date_added ? formatDate(card.date_added) : '—'} />
              </div>
              {profit != null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  background: profit >= 0 ? 'rgba(69,219,141,0.10)' : 'rgba(242,69,96,0.10)',
                  border: `1px solid ${profit >= 0 ? 'rgba(69,219,141,0.22)' : 'rgba(242,69,96,0.22)'}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
                    {profit >= 0 ? '▲' : '▼'} {formatPrice(Math.abs(profit))} unrealized
                    {profitPct != null && (
                      <span style={{ fontWeight: 600, opacity: 0.75, marginLeft: 4 }}>
                        ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── WHEN ADDED (wishlist) — always shown ── */}
          {view === 'wishlist' && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                When Added
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: wlDelta != null ? 8 : 0 }}>
                <MiniStat label="Market at Add" value={card.market_at_buy != null ? formatPrice(card.market_at_buy) : '—'} />
                <MiniStat label="Date Added"    value={card.date_added ? formatDate(card.date_added) : '—'} />
              </div>
              {wlDelta != null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  background: wlDelta <= 0 ? 'rgba(69,219,141,0.10)' : 'rgba(242,69,96,0.10)',
                  border: `1px solid ${wlDelta <= 0 ? 'rgba(69,219,141,0.22)' : 'rgba(242,69,96,0.22)'}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: wlDelta <= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
                    {wlDelta <= 0 ? '▼' : '▲'} {Math.abs(wlDelta).toFixed(1)}% since added
                    {wlDelta <= 0
                      ? <span style={{ fontWeight: 500, marginLeft: 4, opacity: 0.75 }}>(dropped — good!)</span>
                      : <span style={{ fontWeight: 500, marginLeft: 4, opacity: 0.75 }}>(rose)</span>
                    }
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── TARGET PRICE (wishlist) ── */}
          {view === 'wishlist' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>Target Price</span>
                {!editingTarget && (
                  <button onClick={startEditTarget} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {card.target_price ? 'Edit' : 'Set target'}
                  </button>
                )}
              </div>
              {editingTarget ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>$</span>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={editTarget}
                      onChange={e => setEditTarget(e.target.value)} autoFocus
                      style={{ width: '100%', paddingLeft: 20, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRadius: 7, fontSize: 12, background: 'var(--bg)', border: '1px solid rgba(156,114,250,0.40)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={saveTarget} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingTarget(false)} style={{ padding: '7px 10px', borderRadius: 7, fontSize: 11, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>×</button>
                </div>
              ) : card.target_price ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 8,
                  background: atTarget ? 'rgba(69,219,141,0.10)' : 'rgba(156,114,250,0.08)',
                  border: `1px solid ${atTarget ? 'rgba(69,219,141,0.25)' : 'rgba(156,114,250,0.20)'}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: atTarget ? 'var(--emerald)' : 'var(--violet)' }}>
                    {formatPrice(card.target_price)}
                  </span>
                  <span style={{ fontSize: 10, color: atTarget ? 'var(--emerald)' : 'var(--text3)', fontWeight: 600 }}>
                    {atTarget
                      ? '✓ AT TARGET!'
                      : card.market_price
                      ? `↓ ${formatPrice(card.market_price - card.target_price)} above target`
                      : 'target'}
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>No target set — tap "Set target" to track when price drops.</p>
              )}
            </div>
          )}

          {/* ── ACTION BAR ── */}
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            {view === 'wishlist' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Primary: move to portfolio */}
                <button onClick={() => setShowMove(true)} style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'var(--btn-catchm)', color: '#fff',
                  border: 'none', cursor: 'pointer',
                }}>
                  + CATCHM
                </button>
                {/* Secondary: TCG + alerts + remove */}
                {showRemoveConfirm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(242,69,96,0.08)', border: '1px solid rgba(242,69,96,0.22)' }}>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text3)' }}>Remove from wishlist?</span>
                    <button onClick={handleRemove} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'var(--btn-remove)', color: '#fff', border: 'none', cursor: 'pointer' }}>Remove</button>
                    <button onClick={() => setShowRemoveConfirm(false)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <TcgLink url={tcgSearchUrl(card.name, card.set_name)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      color: '#fff', background: 'var(--btn-info)',
                      border: 'none', textDecoration: 'none',
                      textAlign: 'center', display: 'block',
                    }}>↗ TCGPlayer</TcgLink>
                    <button
                      onClick={() => updateCard(card.id, { alerts_enabled: !card.alerts_enabled })}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: card.alerts_enabled ? 'linear-gradient(135deg, #F0B820, #C07808)' : 'transparent',
                        color: card.alerts_enabled ? '#fff' : 'rgba(255,200,69,0.45)',
                        border: card.alerts_enabled ? 'none' : '1px solid rgba(255,200,69,0.20)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </button>
                    <button onClick={() => setShowRemoveConfirm(true)} style={{
                      width: 36, borderRadius: 8, fontSize: 14, fontWeight: 700,
                      background: 'var(--btn-remove)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                    }}>✕</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Row 1: Sell + Gift + Trade (locked cards skip this) */}
                {!locked && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setShowSell(true)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: 'var(--btn-sell)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                    }}>SELL</button>
                    <button onClick={() => setShowGift(true)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: 'var(--btn-wishlist)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                    }}>GIFT</button>
                    <button onClick={() => setShowTrade(true)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: 'var(--btn-info)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                    }}>TRADE</button>
                  </div>
                )}
                {/* Row 2 */}
                {showRemoveConfirm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9, background: 'rgba(242,69,96,0.08)', border: '1px solid rgba(242,69,96,0.22)' }}>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text3)' }}>Remove this card?</span>
                    <button onClick={handleRemove} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'var(--btn-remove)', color: '#fff', border: 'none', cursor: 'pointer' }}>Remove</button>
                    <button onClick={() => setShowRemoveConfirm(false)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn label="Edit" gradient="var(--btn-info)" onClick={() => setShowEdit(true)} />
                      <Btn label="↗ TCG" gradient="var(--btn-info)" href={tcgSearchUrl(card.name, card.set_name ?? '')} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn label="↩ WISH" gradient="var(--btn-info)" onClick={handleToWatch} />
                      <Btn label="✕" gradient="var(--btn-remove)" onClick={() => setShowRemoveConfirm(true)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {showMove && (
        <MoveToPortfolioModal card={card}
          onClose={() => { setShowMove(false); onClose() }}
          onBack={() => setShowMove(false)} />
      )}
      {showEdit && (
        <EditCardModal card={card}
          onClose={() => { setShowEdit(false); onClose() }}
          onBack={() => setShowEdit(false)} />
      )}
      {showSell && (
        <SellModal card={card} mode="sell"
          onClose={() => { setShowSell(false); onClose() }}
          onBack={() => setShowSell(false)} />
      )}
      {showGift && (
        <SellModal card={card} mode="gift"
          onClose={() => { setShowGift(false); onClose() }}
          onBack={() => setShowGift(false)} />
      )}
      {showTrade && (
        <SellModal card={card} mode="trade"
          onClose={() => { setShowTrade(false); onClose() }}
          onBack={() => setShowTrade(false)} />
      )}
    </>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{value}</p>
    </div>
  )
}


function Btn({ label, color = 'var(--text2)', accentBg, gradient, onClick, href, active, wide }: {
  label: string; color?: string; accentBg?: string; gradient?: string
  onClick?: () => void; href?: string; active?: boolean; wide?: boolean
}) {
  const style: React.CSSProperties = {
    padding: wide ? '6px 18px' : '6px 10px',
    borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.03em',
    color: active ? '#0D0F1A' : (gradient ? '#fff' : color),
    background: active ? color : (gradient ?? accentBg ?? 'transparent'),
    border: (active || gradient) ? 'none' : '1px solid rgba(255,255,255,0.10)',
    cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
    whiteSpace: 'nowrap', transition: 'all 0.12s ease', lineHeight: 1.4,
  }
  if (href) return <TcgLink url={href} style={style}>{label}</TcgLink>
  return <button onClick={onClick} style={{ ...style, outline: 'none' }}>{label}</button>
}

// ─── Sell / Gift / Trade modal ───────────────────────────────────────────────

export function SellModal({ card, mode, onClose, onBack }: {
  card: PokemonCard; mode: 'sell' | 'gift' | 'trade'; onClose: () => void; onBack: () => void
}) {
  const { sellCard } = useCollection()
  const isSell = mode === 'sell'
  const isGift = mode === 'gift'
  const isTrade = mode === 'trade'
  const defaultPrice = isSell ? formatPrice(conditionAdjustedValue(card)).replace('$', '') : ''
  const [soldPrice, setSoldPrice] = useState(defaultPrice)
  const [fees, setFees] = useState('')
  const [shipping, setShipping] = useState('')
  const [saving, setSaving] = useState(false)

  const sp = isSell ? (parseFloat(soldPrice) || 0) : 0
  const f = parseFloat(fees) || 0
  const s = parseFloat(shipping) || 0
  const netProfit = sp - f - s - (card.price_paid ?? 0)

  const title = isSell ? 'Log Sale' : isGift ? 'Log Gift' : 'Log Trade'
  const btnLabel = isSell ? 'Confirm Sale' : isGift ? 'Confirm Gift' : 'Confirm Trade'
  const btnGradient = isSell ? 'var(--btn-sell)' : isGift ? 'var(--btn-wishlist)' : 'var(--btn-info)'
  const saleType = isSell ? 'sale' : isGift ? 'gift' : 'trade'

  async function confirm() {
    if (isSell && !sp) return
    setSaving(true)
    await sellCard(card, { sold_price: sp, fees: f, shipping: s, sale_type: saleType })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open title={title} onClose={onClose} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← {card.name}
        </button>

        {(isGift || isTrade) && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: isGift ? 'rgba(156,114,250,0.08)' : 'rgba(93,169,255,0.08)', border: `1px solid ${isGift ? 'rgba(156,114,250,0.20)' : 'rgba(93,169,255,0.20)'}` }}>
            <p style={{ margin: 0, fontSize: 12, color: isGift ? 'var(--violet)' : 'var(--sky)' }}>
              {isGift ? 'Card will be removed from your portfolio and logged as gifted.' : 'Card will be removed and logged as a trade. Add the card you received separately.'}
            </p>
          </div>
        )}

        {isSell && (
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Sale price *
            </label>
            <PriceInput value={soldPrice} onChange={setSoldPrice} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>Fees</label>
            <PriceInput value={fees} onChange={setFees} placeholder="0.00" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>Shipping</label>
            <PriceInput value={shipping} onChange={setShipping} placeholder="0.00" />
          </div>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 10, textAlign: 'center', background: 'var(--s2)', border: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {isSell ? 'Net Profit' : 'Total Cost'}
          </p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: netProfit >= 0 && isSell ? 'var(--emerald)' : 'var(--crimson)' }}>
            {isSell
              ? `${netProfit >= 0 ? '+' : ''}${formatPrice(netProfit)}`
              : `-${formatPrice(f + s + (card.price_paid ?? 0))}`}
          </p>
          {card.price_paid != null && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>
              Paid {formatPrice(card.price_paid)}{isSell ? ` · Sold ${formatPrice(sp)}` : ''}
            </p>
          )}
        </div>

        <button onClick={confirm} disabled={saving || (isSell && !sp)} style={{
          width: '100%', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: btnGradient,
          color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer',
          opacity: saving || (isSell && !sp) ? 0.55 : 1,
          transition: 'opacity 0.12s',
        }}>
          {saving ? 'Saving…' : btnLabel}
        </button>
      </div>
    </Modal>
  )
}

function PriceInput({ value, onChange, placeholder = '' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, fontSize: 12, color: 'var(--text3)' }}>$</span>
      <input type="number" min="0" step="0.01" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', paddingLeft: 22, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box' }} />
    </div>
  )
}
